package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	_ "github.com/lib/pq"

	"forwarder-mattermost/config"
	"forwarder-mattermost/handlers"
	"forwarder-mattermost/mattermost"
)

func main() {
	cfg := config.LoadConfig()

	client := mattermost.NewClient(cfg.MattermostURL, cfg.BotToken)

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable connect_timeout=5",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
	db, err := sql.Open("postgres", connStr)
	if err == nil {
		go func() {
			for i := 0; i < 6; i++ {
				err := db.Ping()
				if err == nil {
					log.Printf("[INFO] Successfully connected to Mattermost database at %s:%s", cfg.DBHost, cfg.DBPort)
					break
				}
				log.Printf("[WARN] Failed to connect to Mattermost database (attempt %d/6): %v. Retrying in 10 seconds...", i+1, err)
				time.Sleep(10 * time.Second)
			}
		}()
	} else {
		log.Printf("[WARN] Failed to open database handle: %v", err)
	}

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

	hCtx := handlers.NewHandlerContext(cfg, client, db)

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
