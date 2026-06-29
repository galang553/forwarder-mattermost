package main

import (
	"log"
	"net/http"
	"time"

	"forwarder-mattermost/config"
	"forwarder-mattermost/handlers"
	"forwarder-mattermost/mattermost"
)

func main() {
	cfg := config.LoadConfig()

	client := mattermost.NewClient(cfg.MattermostURL, cfg.BotToken)

	go func() {
		for i := 0; i < 5; i++ {
			id, err := client.FetchBotUserID()
			if err == nil {
				log.Printf("Successfully authenticated with Mattermost. Bot User ID: %s", id)
				break
			}
			log.Printf("Warning: Failed to authenticate with Mattermost (attempt %d/5): %v. Retrying in 5 seconds...", i+1, err)
			time.Sleep(5 * time.Second)
		}
	}()

	hCtx := handlers.NewHandlerContext(cfg, client)

	http.HandleFunc("/forward", hCtx.HandleSlashCommand)
	http.HandleFunc("/dialog-submit", hCtx.HandleDialogSubmission)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	log.Printf("Starting Mattermost Forwarder server on port %s...", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, nil); err != nil {
		log.Fatal(err)
	}
}
