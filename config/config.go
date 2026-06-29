package config

import (
	"log"
	"os"
	"strings"
)

type Config struct {
	Port              string
	MattermostURL     string
	BotToken          string
	SlashCommandToken string
	ServerURL         string // URL of this service, used for dialog submission callback

	// Database config
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
}

// LoadConfig reads variables from environment and performs basic validation
func LoadConfig() Config {
	cfg := Config{
		Port:              getEnv("PORT", "8080"),
		MattermostURL:     strings.TrimSuffix(getEnv("MATTERMOST_URL", ""), "/"),
		BotToken:          getEnv("MATTERMOST_BOT_TOKEN", ""),
		SlashCommandToken: getEnv("SLASH_COMMAND_TOKEN", ""),
		ServerURL:         strings.TrimSuffix(getEnv("SERVER_URL", "http://localhost:8080"), "/"),

		DBHost:     getEnv("DB_HOST", "mattermost-db"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "mmuser"),
		DBPassword: getEnv("DB_PASSWORD", "mostest"),
		DBName:     getEnv("DB_NAME", "mattermost"),
	}

	if cfg.MattermostURL == "" {
		log.Fatal("ERROR: MATTERMOST_URL environment variable is required.")
	}
	if cfg.BotToken == "" {
		log.Fatal("ERROR: MATTERMOST_BOT_TOKEN environment variable is required.")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
