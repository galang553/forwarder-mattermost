package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"forwarder-mattermost/config"
	"forwarder-mattermost/mattermost"
)

func TestHandleSlashCommand(t *testing.T) {
	dialogOpened := false
	mockMattermost := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v4/actions/dialogs/open" {
			dialogOpened = true
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"OK"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockMattermost.Close()

	cfg := config.Config{
		ServerURL:         "http://localhost:8080",
		MattermostURL:     mockMattermost.URL,
		BotToken:          "mock-token",
		SlashCommandToken: "command-secret-token",
	}
	client := mattermost.NewClient(cfg.MattermostURL, cfg.BotToken)
	hCtx := NewHandlerContext(cfg, client)

	form := url.Values{}
	form.Set("token", "command-secret-token")
	form.Set("trigger_id", "test-trigger-id")
	form.Set("channel_id", "test-channel-id")
	form.Set("user_id", "test-user-id")

	req := httptest.NewRequest(http.MethodPost, "/forward", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()

	hCtx.HandleSlashCommand(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", resp.StatusCode)
	}

	for i := 0; i < 20; i++ {
		if dialogOpened {
			break
		}
		t.Log("Waiting for async dialog open...")
		time.Sleep(10 * time.Millisecond)
	}

	if !dialogOpened {
		t.Error("expected dialog open API to be called on Mattermost server, but it wasn't")
	}
}

func TestHandleDialogSubmissionValidation(t *testing.T) {
	cfg := config.Config{
		ServerURL:     "http://localhost:8080",
		MattermostURL: "http://localhost:8065",
		BotToken:      "mock-token",
	}
	client := mattermost.NewClient(cfg.MattermostURL, cfg.BotToken)
	hCtx := NewHandlerContext(cfg, client)

	tests := []struct {
		name           string
		submissionBody string
		expectedErrors map[string]string
	}{
		{
			name: "Invalid message count",
			submissionBody: `{
				"type": "dialog_submission",
				"callback_id": "forward_messages",
				"state": "{}",
				"submission": {
					"num_messages": "-5",
					"dest_channel_id": "chan-id",
					"dest_user_id": ""
				}
			}`,
			expectedErrors: map[string]string{
				"num_messages": "Please enter a valid positive number.",
			},
		},
		{
			name: "Too many messages requested",
			submissionBody: `{
				"type": "dialog_submission",
				"callback_id": "forward_messages",
				"state": "{}",
				"submission": {
					"num_messages": "55",
					"dest_channel_id": "chan-id",
					"dest_user_id": ""
				}
			}`,
			expectedErrors: map[string]string{
				"num_messages": "You can forward a maximum of 50 messages at a time.",
			},
		},
		{
			name: "No destination selected",
			submissionBody: `{
				"type": "dialog_submission",
				"callback_id": "forward_messages",
				"state": "{}",
				"submission": {
					"num_messages": "5",
					"dest_channel_id": "",
					"dest_user_id": ""
				}
			}`,
			expectedErrors: map[string]string{
				"dest_channel_id": "Select either a Destination Channel OR a Destination User.",
				"dest_user_id":    "Select either a Destination Channel OR a Destination User.",
			},
		},
		{
			name: "Both destinations selected",
			submissionBody: `{
				"type": "dialog_submission",
				"callback_id": "forward_messages",
				"state": "{}",
				"submission": {
					"num_messages": "5",
					"dest_channel_id": "chan-1",
					"dest_user_id": "user-2"
				}
			}`,
			expectedErrors: map[string]string{
				"dest_channel_id": "Select only ONE destination (Channel or User).",
				"dest_user_id":    "Select only ONE destination (Channel or User).",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/dialog-submit", strings.NewReader(tt.submissionBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			hCtx.HandleDialogSubmission(w, req)

			resp := w.Result()
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
			}

			bodyBytes, _ := io.ReadAll(resp.Body)
			var respMap map[string]map[string]string
			if err := json.Unmarshal(bodyBytes, &respMap); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			errs, exists := respMap["errors"]
			if !exists {
				t.Fatalf("expected errors in response, got none. Body: %s", string(bodyBytes))
			}

			for k, v := range tt.expectedErrors {
				if errs[k] != v {
					t.Errorf("expected error for field %s to be %q, got %q", k, v, errs[k])
				}
			}
		})
	}
}
