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
	PostIDs             []string `json:"post_ids"`
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

	go func() {
		err := p.ExecuteForwardPipeline(userID, req.PostIDs, req.DestinationChannels, req.DestinationUsers)
		if err != nil {
			p.API.LogError(fmt.Sprintf("Failed to execute forwarding pipeline: %v", err))
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"OK"}`))
}

func (p *Plugin) ExecuteForwardPipeline(triggerUserID string, postIDs []string, destChannelIDs, destUserIDs []string) error {
	p.API.LogDebug(fmt.Sprintf("Starting plugin forwarding pipeline for User: %s, Posts Count: %d", triggerUserID, len(postIDs)))

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

	// Send each message separately in chronological order
	for _, postID := range postIDs {
		post, err := p.API.GetPost(postID)
		if err != nil {
			p.API.LogError(fmt.Sprintf("Failed to fetch post %s: %v", postID, err))
			continue
		}

		author := resolveUser(post.UserId)
		postTime := time.UnixMilli(post.CreateAt).In(time.FixedZone("GMT+7", 7*3600)).Format("Jan 02, 15:04")

		// Retrieve all file contents for post.FileIds to cache them
		type FileData struct {
			Content  []byte
			Filename string
			MimeType string
		}
		var cachedFiles []FileData
		for _, fileID := range post.FileIds {
			fileInfo, fileInfoErr := p.API.GetFileInfo(fileID)
			if fileInfoErr != nil {
				p.API.LogError(fmt.Sprintf("Failed to get file info for %s: %v", fileID, fileInfoErr))
				continue
			}
			content, fileErr := p.API.GetFile(fileID)
			if fileErr != nil {
				p.API.LogError(fmt.Sprintf("Failed to get file content for %s: %v", fileID, fileErr))
				continue
			}
			cachedFiles = append(cachedFiles, FileData{
				Content:  content,
				Filename: fileInfo.Name,
				MimeType: fileInfo.MimeType,
			})
		}

		// Helper to upload files to a channel (no markdown appended)
		uploadFiles := func(targetChannelID string) []string {
			var newFileIDs []string
			for _, cf := range cachedFiles {
				newFileInfo, uploadErr := p.API.UploadFile(cf.Content, targetChannelID, cf.Filename)
				if uploadErr != nil {
					p.API.LogError(fmt.Sprintf("Failed to upload file %s to channel %s: %v", cf.Filename, targetChannelID, uploadErr))
					continue
				}
				newFileIDs = append(newFileIDs, newFileInfo.Id)
			}
			return newFileIDs
		}

		// 3. Post to Channels
		for _, chanID := range destChannelIDs {
			if chanID == "" {
				continue
			}
			newFileIDs := uploadFiles(chanID)

			// Replace old file IDs with new file IDs in the message text (in-place)
			modifiedMsg := post.Message
			for i, oldID := range post.FileIds {
				if i < len(newFileIDs) {
					modifiedMsg = strings.ReplaceAll(modifiedMsg, oldID, newFileIDs[i])
				}
			}

			// Indent original message text
			var msgLines []string
			lines := strings.Split(modifiedMsg, "\n")
			for _, line := range lines {
				msgLines = append(msgLines, "> "+line)
			}
			if len(msgLines) == 0 || (len(msgLines) == 1 && msgLines[0] == "> ") {
				msgLines = []string{"> *[Empty Message]*"}
			}

			finalMsgText := fmt.Sprintf("🔄 **Forwarded from @%s** [%s]:\n%s", author, postTime, strings.Join(msgLines, "\n"))

			newPost := &model.Post{
				ChannelId: chanID,
				UserId:    triggerUserID,
				Message:   finalMsgText,
				FileIds:   newFileIDs,
			}
			if _, createErr := p.API.CreatePost(newPost); createErr != nil {
				p.API.LogError(fmt.Sprintf("Failed to forward post to channel %s: %v", chanID, createErr))
			}
		}

		// 4. Post to Users (DMs)
		for _, destUserID := range destUserIDs {
			if destUserID == "" {
				continue
			}
			dmChannel, dmErr := p.API.GetDirectChannel(triggerUserID, destUserID)
			if dmErr != nil {
				p.API.LogError(fmt.Sprintf("Failed to get DM channel between %s and %s: %v", triggerUserID, destUserID, dmErr))
				continue
			}
			newFileIDs := uploadFiles(dmChannel.Id)

			// Replace old file IDs with new file IDs in the message text (in-place)
			modifiedMsg := post.Message
			for i, oldID := range post.FileIds {
				if i < len(newFileIDs) {
					modifiedMsg = strings.ReplaceAll(modifiedMsg, oldID, newFileIDs[i])
				}
			}

			// Indent original message text
			var msgLines []string
			lines := strings.Split(modifiedMsg, "\n")
			for _, line := range lines {
				msgLines = append(msgLines, "> "+line)
			}
			if len(msgLines) == 0 || (len(msgLines) == 1 && msgLines[0] == "> ") {
				msgLines = []string{"> *[Empty Message]*"}
			}

			finalMsgText := fmt.Sprintf("🔄 **Forwarded from @%s** [%s]:\n%s", author, postTime, strings.Join(msgLines, "\n"))

			newPost := &model.Post{
				ChannelId: dmChannel.Id,
				UserId:    triggerUserID,
				Message:   finalMsgText,
				FileIds:   newFileIDs,
			}
			if _, createErr := p.API.CreatePost(newPost); createErr != nil {
				p.API.LogError(fmt.Sprintf("Failed to forward post to DM with User %s: %v", destUserID, createErr))
			}
		}

		// Brief delay to ensure database index ordering
		time.Sleep(100 * time.Millisecond)
	}

	return nil
}
