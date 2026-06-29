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
	log.Printf("[INFO] Starting ExecuteForwardPipeline. SourceChannel: %s, Initiator: %s, MessageCountRequested: %d", srcChannelID, triggerUserID, num)

	srcChannel, err := client.GetChannel(srcChannelID)
	if err != nil {
		return fmt.Errorf("failed to fetch source channel details: %w", err)
	}
	log.Printf("[INFO] Source channel resolved: %s (Type: %s)", srcChannel.DisplayName, srcChannel.Type)

	fetchLimit := num + 10
	if fetchLimit > 100 {
		fetchLimit = 100
	}
	log.Printf("[INFO] Fetching posts from source channel. Limit: %d", fetchLimit)
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
	log.Printf("[INFO] Found %d actual user messages out of %d fetched items", len(userPosts), len(postList.Order))

	if len(userPosts) == 0 {
		return fmt.Errorf("no user messages found to forward in the channel")
	}

	// Reverse the order so they are sorted chronologically (oldest first)
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

	log.Printf("[INFO] Resolving usernames for %d unique User IDs...", len(userIDs))
	users, err := client.GetUsersByIDs(userIDs)
	if err != nil {
		log.Printf("[WARN] Failed to resolve user names: %v. Falling back to raw User IDs.", err)
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
	log.Printf("[INFO] Action requested by @%s", triggerUsername)

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
		log.Printf("[INFO] Target is a Direct Message to UserID: %s. Resolving DM channel...", destUserID)
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
		log.Printf("[INFO] DM channel resolved: %s", targetChannelID)
	} else {
		log.Printf("[INFO] Target is ChannelID: %s. Fetching details...", destChannelID)
		destChan, err := client.GetChannel(destChannelID)
		if err == nil {
			destName = "~" + destChan.DisplayName
		} else {
			destName = "channel"
			log.Printf("[WARN] Could not fetch target channel display name: %v", err)
		}
	}

	log.Printf("[INFO] Sending consolidated forwarded message to target channel %s...", targetChannelID)
	err = client.CreatePost(targetChannelID, finalMessage)
	if err != nil {
		return fmt.Errorf("failed to send forwarded message to destination: %w", err)
	}
	log.Printf("[INFO] Consolidated message posted successfully.")

	successMessage := fmt.Sprintf("✅ Successfully forwarded the last %d message(s) to **%s**.", len(userPosts), destName)
	log.Printf("[INFO] Sending ephemeral success confirmation to initiator user...")
	err = client.CreateEphemeralPost(triggerUserID, srcChannelID, successMessage)
	if err != nil {
		log.Printf("[WARN] Failed to send confirmation ephemeral post: %v", err)
	} else {
		log.Printf("[INFO] Ephemeral confirmation sent successfully. Pipeline complete.")
	}

	return nil
}
