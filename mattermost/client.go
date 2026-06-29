package mattermost

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

type Client struct {
	BaseURL    string
	Token      string
	BotUserID  string
	HTTPClient *http.Client
	mu         sync.RWMutex
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		BaseURL:    baseURL,
		Token:      token,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) OpenDialog(req OpenDialogRequest) error {
	url := fmt.Sprintf("%s/api/v4/actions/dialogs/open", c.BaseURL)
	return c.post(url, req, nil)
}

func (c *Client) GetChannel(channelID string) (*Channel, error) {
	url := fmt.Sprintf("%s/api/v4/channels/%s", c.BaseURL, channelID)
	var channel Channel
	if err := c.get(url, &channel); err != nil {
		return nil, err
	}
	return &channel, nil
}

func (c *Client) GetPosts(channelID string, limit int) (*PostList, error) {
	url := fmt.Sprintf("%s/api/v4/channels/%s/posts?page=0&per_page=%d", c.BaseURL, channelID, limit)
	var postList PostList
	if err := c.get(url, &postList); err != nil {
		return nil, err
	}
	return &postList, nil
}

func (c *Client) GetUsersByIDs(userIDs []string) ([]User, error) {
	if len(userIDs) == 0 {
		return []User{}, nil
	}
	url := fmt.Sprintf("%s/api/v4/users/ids", c.BaseURL)
	var users []User
	if err := c.post(url, userIDs, &users); err != nil {
		return nil, err
	}
	return users, nil
}

func (c *Client) CreateDirectChannel(userID1, userID2 string) (string, error) {
	url := fmt.Sprintf("%s/api/v4/channels/direct", c.BaseURL)
	payload := []string{userID1, userID2}
	var channel Channel
	if err := c.post(url, payload, &channel); err != nil {
		return "", err
	}
	return channel.ID, nil
}

func (c *Client) CreatePost(channelID, message string) error {
	url := fmt.Sprintf("%s/api/v4/posts", c.BaseURL)
	payload := map[string]string{
		"channel_id": channelID,
		"message":    message,
	}
	return c.post(url, payload, nil)
}

func (c *Client) CreateEphemeralPost(userID, channelID, message string) error {
	url := fmt.Sprintf("%s/api/v4/posts/ephemeral", c.BaseURL)
	payload := map[string]interface{}{
		"user_id": userID,
		"post": map[string]string{
			"channel_id": channelID,
			"message":    message,
		},
	}
	return c.post(url, payload, nil)
}

func (c *Client) FetchBotUserID() (string, error) {
	url := fmt.Sprintf("%s/api/v4/users/me", c.BaseURL)
	var user User
	if err := c.get(url, &user); err != nil {
		return "", err
	}
	c.mu.Lock()
	c.BotUserID = user.ID
	c.mu.Unlock()
	return user.ID, nil
}

func (c *Client) GetBotUserID() (string, error) {
	c.mu.RLock()
	id := c.BotUserID
	c.mu.RUnlock()
	if id != "" {
		return id, nil
	}
	return c.FetchBotUserID()
}

func (c *Client) get(url string, target interface{}) error {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[ERROR] Mattermost API GET %s failed (Status %d): %s", url, resp.StatusCode, string(bodyBytes))
		return fmt.Errorf("GET error status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func (c *Client) post(url string, body interface{}, target interface{}) error {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[ERROR] Mattermost API POST %s failed (Status %d): %s", url, resp.StatusCode, string(respBodyBytes))
		return fmt.Errorf("POST error status %d: %s", resp.StatusCode, string(respBodyBytes))
	}

	if target != nil {
		return json.NewDecoder(resp.Body).Decode(target)
	}
	return nil
}
