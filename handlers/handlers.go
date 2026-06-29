package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"forwarder-mattermost/config"
	"forwarder-mattermost/mattermost"
)

type HandlerContext struct {
	Config config.Config
	Client *mattermost.Client
}

func NewHandlerContext(cfg config.Config, client *mattermost.Client) *HandlerContext {
	return &HandlerContext{
		Config: cfg,
		Client: client,
	}
}

func (h *HandlerContext) HandleSlashCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		log.Printf("Error parsing slash command form: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if h.Config.SlashCommandToken != "" {
		incomingToken := r.FormValue("token")
		if incomingToken != h.Config.SlashCommandToken {
			log.Printf("Unauthorized Slash Command request. Token mismatch.")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	triggerID := r.FormValue("trigger_id")
	sourceChannelID := r.FormValue("channel_id")
	triggeringUserID := r.FormValue("user_id")

	if triggerID == "" || sourceChannelID == "" || triggeringUserID == "" {
		log.Printf("Missing trigger_id, channel_id, or user_id in Slash Command payload")
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	stateBytes, err := json.Marshal(mattermost.DialogState{
		SourceChannelID:  sourceChannelID,
		TriggeringUserID: triggeringUserID,
	})
	if err != nil {
		log.Printf("Error marshaling dialog state: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	dialogReq := mattermost.OpenDialogRequest{
		TriggerID: triggerID,
		URL:       fmt.Sprintf("%s/dialog-submit", h.Config.ServerURL),
		Dialog: mattermost.Dialog{
			CallbackID:       "forward_messages",
			Title:            "Forward Recent Messages",
			IntroductionText: "Select destination and specify how many messages to grab.",
			SubmitLabel:      "Forward",
			NotifyOnCancel:   false,
			State:            string(stateBytes),
			Elements: []mattermost.DialogElement{
				{
					DisplayName: "Number of Messages to Forward",
					Name:        "num_messages",
					Type:        "text",
					SubType:     "number",
					Default:     "5",
					HelpText:    "Enter a value between 1 and 50.",
				},
				{
					DisplayName: "Destination Channel",
					Name:        "dest_channel_id",
					Type:        "select",
					DataSource:  "channels",
					Optional:    true,
					HelpText:    "Choose a channel to forward messages to.",
				},
				{
					DisplayName: "Destination User (Direct Message)",
					Name:        "dest_user_id",
					Type:        "select",
					DataSource:  "users",
					Optional:    true,
					HelpText:    "Or choose a user to forward messages directly.",
				},
			},
		},
	}

	go func() {
		if err := h.Client.OpenDialog(dialogReq); err != nil {
			log.Printf("Error opening interactive dialog: %v", err)
		}
	}()

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(""))
}
func (h *HandlerContext) HandleDialogSubmission(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading submission body: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var submissionReq mattermost.DialogSubmissionRequest
	if err := json.Unmarshal(bodyBytes, &submissionReq); err != nil {
		log.Printf("Error unmarshaling submission: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	errors := make(map[string]string)
	numStr := submissionReq.Submission["num_messages"]
	num, err := strconv.Atoi(strings.TrimSpace(numStr))
	if err != nil || num <= 0 {
		errors["num_messages"] = "Please enter a valid positive number."
	} else if num > 50 {
		errors["num_messages"] = "You can forward a maximum of 50 messages at a time."
	}

	destChannel := submissionReq.Submission["dest_channel_id"]
	destUser := submissionReq.Submission["dest_user_id"]

	if destChannel == "" && destUser == "" {
		errors["dest_channel_id"] = "Select either a Destination Channel OR a Destination User."
		errors["dest_user_id"] = "Select either a Destination Channel OR a Destination User."
	} else if destChannel != "" && destUser != "" {
		errors["dest_channel_id"] = "Select only ONE destination (Channel or User)."
		errors["dest_user_id"] = "Select only ONE destination (Channel or User)."
	}

	if len(errors) > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{"errors": errors})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
	var state mattermost.DialogState
	if err := json.Unmarshal([]byte(submissionReq.State), &state); err != nil {
		log.Printf("Error parsing state from submission: %v", err)
		return
	}

	go func() {
		err := ExecuteForwardPipeline(h.Client, state.SourceChannelID, state.TriggeringUserID, num, destChannel, destUser)
		if err != nil {
			log.Printf("Failed to execute forwarding pipeline: %v", err)
			_ = h.Client.CreateEphemeralPost(state.TriggeringUserID, state.SourceChannelID, fmt.Sprintf("⚠️ Message forwarding failed: %v", err))
		}
	}()
}
