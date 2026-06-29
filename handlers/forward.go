package handlers

import (
	"bytes"
	"fmt"
	"log"
	"strings"
	"time"

	"forwarder-mattermost/mattermost"
)

func ExecuteForwardPipeline(client *mattermost.Client, srcChannelID, triggerUserID string, num int, destChannelID, destUserID string) error {
	log.Printf("Executing forward: source=%s, user=%s, count=%d, dest_chan=%s, dest_user=%s", srcChannelID, triggerUserID, num, destChannelID, destUserID)

	srcChannel, err := client.GetChannel(srcChannelID)
	if err != nil {
		return fmt.Errorf("failed to fetch source channel details: %w", err)
	}

	fetchLimit := num + 10
	if fetchLimit > 100 {
		fetchLimit = 100
	}
	postList, err := client.GetPosts(srcChannelID, fetchLimit)
	if err != nil {
		return fmt.Errorf("failed to fetch posts: %w", err)
	}

	var userPosts []mattermost.Post
	for _, postID := range postList.Order {
		post, ok := postList.Posts[postID]
		if !ok {
			continue
		}

		if post.Type == "" && strings.TrimSpace(post.Message) != "" {
			userPosts = append(userPosts, post)
		}
		if len(userPosts) == num {
			break
		}
	}

	if len(userPosts) == 0 {
		return fmt.Errorf("no user messages found to forward in the channel")
	}

	for i, j := 0, len(userPosts)-1; i < j; i, j = i+1, j-1 {
		userPosts[i], userPosts[j] = userPosts[j], userPosts[i]
	}

	userIDMap := make(map[string]bool)
	userIDMap[triggerUserID] = true
	for _, p := range userPosts {
		userIDMap[p.UserID] = true
	}

	userIDs := make([]string, 0, len(userIDMap))
	for id := range userIDMap {
		userIDs = append(userIDs, id)
	}

	users, err := client.GetUsersByIDs(userIDs)
	if err != nil {
		log.Printf("Warning: failed to resolve user names: %v. Falling back to raw User IDs.", err)
		users = []mattermost.User{}
	}

	usernameLookup := make(map[string]string)
	for _, u := range users {
		usernameLookup[u.ID] = u.Username
	}

	triggerUsername, ok := usernameLookup[triggerUserID]
	if !ok {
		triggerUsername = "unknown"
	}

	var buffer bytes.Buffer
	buffer.WriteString(fmt.Sprintf("### 🔄 Forwarded messages from **~%s** (requested by @%s):\n\n", srcChannel.DisplayName, triggerUsername))

	for _, p := range userPosts {
		author, ok := usernameLookup[p.UserID]
		if !ok {
			author = "user_" + p.UserID[:6]
		}
		postTime := time.UnixMilli(p.CreateAt).UTC().Format("Jan 02, 15:04:05 UTC")

		buffer.WriteString(fmt.Sprintf("> **@%s** [%s]:\n", author, postTime))

		lines := strings.Split(p.Message, "\n")
		for _, line := range lines {
			buffer.WriteString(fmt.Sprintf("> %s\n", line))
		}
		buffer.WriteString("> \n")
	}

	finalMessage := strings.TrimSuffix(buffer.String(), "> \n")

	targetChannelID := destChannelID
	var destName string

	if destUserID != "" {
		botID, err := client.GetBotUserID()
		if err != nil {
			return fmt.Errorf("failed to get bot user ID: %w", err)
		}
		dmChannelID, err := client.CreateDirectChannel(botID, destUserID)
		if err != nil {
			return fmt.Errorf("failed to create DM channel: %w", err)
		}
		targetChannelID = dmChannelID
		destName = "Direct Message"
	} else {
		destChan, err := client.GetChannel(destChannelID)
		if err == nil {
			destName = "~" + destChan.DisplayName
		} else {
			destName = "channel"
		}
	}

	err = client.CreatePost(targetChannelID, finalMessage)
	if err != nil {
		return fmt.Errorf("failed to send forwarded message to destination: %w", err)
	}

	successMessage := fmt.Sprintf("✅ Successfully forwarded the last %d message(s) to **%s**.", len(userPosts), destName)
	err = client.CreateEphemeralPost(triggerUserID, srcChannelID, successMessage)
	if err != nil {
		log.Printf("Warning: failed to send confirmation ephemeral post: %v", err)
	}

	return nil
}
