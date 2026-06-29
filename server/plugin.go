package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
}

type ForwardRequest struct {
	PostID              string   `json:"post_id"`
	NumMessages         int      `json:"num_messages"`
	SkipMessages        int      `json:"skip_messages"`
	DestinationChannels []string `json:"destination_channels"`
	DestinationUsers    []string `json:"destination_users"`
}

func (p *Plugin) OnActivate() error {
	p.API.LogInfo("Successfully activated Message Forwarder Plugin.")
	return nil
}

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests on /forward
	if r.Method != http.MethodPost || r.URL.Path != "/forward" {
		http.NotFound(w, r)
		return
	}

	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ForwardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Validate bounds
	if req.NumMessages <= 0 {
		req.NumMessages = 1
	} else if req.NumMessages > 50 {
		req.NumMessages = 50
	}
	if req.SkipMessages < 0 {
		req.SkipMessages = 0
	}

	go func() {
		err := p.ExecuteForwardPipeline(userID, req.PostID, req.NumMessages, req.SkipMessages, req.DestinationChannels, req.DestinationUsers)
		if err != nil {
			p.API.LogError(fmt.Sprintf("Failed to execute forwarding pipeline: %v", err))
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"OK"}`))
}

func (p *Plugin) ExecuteForwardPipeline(triggerUserID, srcPostID string, num, skip int, destChannelIDs, destUserIDs []string) error {
	p.API.LogDebug(fmt.Sprintf("Starting plugin forwarding pipeline for User: %s, PostID: %s, Count: %d, Skip: %d", triggerUserID, srcPostID, num, skip))

	// 1. Fetch the source post to identify the source channel
	srcPost, err := p.API.GetPost(srcPostID)
	if err != nil {
		return fmt.Errorf("failed to fetch trigger post %s: %w", srcPostID, err)
	}

	srcChannel, err := p.API.GetChannel(srcPost.ChannelId)
	if err != nil {
		return fmt.Errorf("failed to fetch source channel details: %w", err)
	}

	fetchLimit := num + skip + 10
	if fetchLimit > 100 {
		fetchLimit = 100
	}
	postList, err := p.API.GetPostsForChannel(srcPost.ChannelId, 0, fetchLimit)
	if err != nil {
		return fmt.Errorf("failed to fetch posts: %w", err)
	}

	var userPosts []*model.Post
	for _, postID := range postList.Order {
		post, ok := postList.Posts[postID]
		if !ok {
			continue
		}
		if post.Type == "" {
			userPosts = append(userPosts, post)
		}
	}

	if len(userPosts) <= skip {
		return fmt.Errorf("no user messages found to forward after skipping %d messages", skip)
	}

	// Slice history range
	endIdx := skip + num
	if endIdx > len(userPosts) {
		endIdx = len(userPosts)
	}
	selectedPosts := userPosts[skip:endIdx]

	// Reverse to sort chronologically (oldest first)
	for i, j := 0, len(selectedPosts)-1; i < j; i, j = i+1, j-1 {
		selectedPosts[i], selectedPosts[j] = selectedPosts[j], selectedPosts[i]
	}

	// Map usernames
	usernameLookup := make(map[string]string)
	resolveUser := func(id string) string {
		if cached, ok := usernameLookup[id]; ok {
			return cached
		}
		u, err := p.API.GetUser(id)
		if err != nil {
			return "user_" + id[:6]
		}
		usernameLookup[id] = u.Username
		return u.Username
	}

	triggerUsername := resolveUser(triggerUserID)

	// Build message content
	var buffer strings.Builder
	buffer.WriteString(fmt.Sprintf("### 🔄 Forwarded messages from **~%s** (requested by @%s):\n\n", srcChannel.DisplayName, triggerUsername))

	var fileIDs []string
	for _, post := range selectedPosts {
		author := resolveUser(post.UserId)
		postTime := time.UnixMilli(post.CreateAt).UTC().Format("Jan 02, 15:04:05 UTC")

		buffer.WriteString(fmt.Sprintf("> **@%s** [%s]:\n", author, postTime))

		msgText := post.Message
		if strings.TrimSpace(msgText) == "" {
			msgText = "*[Attachment(s) / Empty Message]*"
		}

		lines := strings.Split(msgText, "\n")
		for _, line := range lines {
			buffer.WriteString(fmt.Sprintf("> %s\n", line))
		}
		buffer.WriteString("> \n")

		// Collect files to attach (limit to 5)
		for _, fid := range post.FileIds {
			if len(fileIDs) < 5 {
				fileIDs = append(fileIDs, fid)
			}
		}
	}

	finalMessage := strings.TrimSuffix(buffer.String(), "> \n")

	// 3. Post to Channels
	for _, chanID := range destChannelIDs {
		if chanID == "" {
			continue
		}
		post := &model.Post{
			ChannelId: chanID,
			UserId:    triggerUserID,
			Message:   finalMessage,
			FileIds:   fileIDs,
		}
		if _, err := p.API.CreatePost(post); err != nil {
			p.API.LogError(fmt.Sprintf("Failed to forward post to channel %s: %v", chanID, err))
		}
	}

	// 4. Post to Users (DMs)
	for _, destUserID := range destUserIDs {
		if destUserID == "" {
			continue
		}
		dmChannel, err := p.API.GetDirectChannel(triggerUserID, destUserID)
		if err != nil {
			p.API.LogError(fmt.Sprintf("Failed to get DM channel between %s and %s: %v", triggerUserID, destUserID, err))
			continue
		}
		post := &model.Post{
			ChannelId: dmChannel.Id,
			UserId:    triggerUserID,
			Message:   finalMessage,
			FileIds:   fileIDs,
		}
		if _, err := p.API.CreatePost(post); err != nil {
			p.API.LogError(fmt.Sprintf("Failed to forward post to DM with User %s: %v", destUserID, err))
		}
	}

	return nil
}
