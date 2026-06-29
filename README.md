# Mattermost Message Forwarder

A highly lightweight, containerized Go service that allows users to batch-forward recent messages in any Mattermost channel using the `/forward` slash command and a native interactive dialog.

---

## Features
- 🚀 **Ultra-lightweight**: Built on a Go backend (minimal memory, sub-30MB Docker image).
- 💬 **Interactive Dialog**: Prompts native pop-up for destination selection and quantity control.
- 🔍 **Searchable dropdowns**: Supports selection of target **Public Channels** or **Direct Message Users**.
- 🛠️ **Error Validation**: Displays input validation errors directly inside the Mattermost UI dialog.
- 📦 **Docker Ready**: Configured to run out-of-the-box using Docker Compose.

---

## Mattermost Setup Steps

To run this integration, you need admin access to your Mattermost instance.

### 1. Create a Bot Account
1. Open the Mattermost **Main Menu** -> **Integrations** -> **Bot Accounts**.
2. Click **Add Bot Account**.
3. Set the details:
   - **Username**: `message-forwarder`
   - **Display Name**: `Message Forwarder`
   - **Description**: `Forwards messages between channels.`
   - **Role**: `Member` (or `System Admin` if you want it to be able to post to private channels).
4. Click **Create Bot Account**.
5. **Copy the generated Bot Token**. You will need this for the `MATTERMOST_BOT_TOKEN` environment variable.

### 2. Create the Slash Command
1. Open **Main Menu** -> **Integrations** -> **Slash Commands**.
2. Click **Add Slash Command**.
3. Set the details:
   - **Title**: `Message Forwarder`
   - **Description**: `Batch forward recent messages.`
   - **Command Trigger Word**: `forward`
   - **Request URL**: `http://<your-server-ip>:8080/forward` (Replace with the URL where this service is exposed to Mattermost).
   - **Request Method**: `POST`
   - **Autocomplete**: `Yes`
   - **Autocomplete Hint**: `[batch forward recent channel messages]`
4. Click **Save**.
5. **Copy the generated token**. This is your `SLASH_COMMAND_TOKEN` used to verify requests.

---

## Deployment Instructions

### 1. Configure Environment Variables
Create a `.env` file in the project directory:

```env
# The external URL where this forwarder service is reachable by Mattermost
SERVER_URL=http://<your-server-ip>:8080

# Your Mattermost Server URL
MATTERMOST_URL=http://<your-mattermost-ip>:8065

# The Bot Access Token created in Step 1
MATTERMOST_BOT_TOKEN=your_mattermost_bot_token

# The Slash Command Token created in Step 2 (Optional, for request verification)
SLASH_COMMAND_TOKEN=your_slash_command_token

# Port for the integration service to listen on
PORT=8080
```

### 2. Start the Container
Run the following command to build and launch the service:

```bash
docker compose up -d --build
```

To stop the service:

```bash
docker compose down
```

---

## How to Use

1. Go to any Mattermost channel.
2. Type `/forward` and hit Enter.
3. An interactive dialog will pop up:
   - **Number of Messages to Forward**: Enter how many recent messages you want to grab (e.g., `5`, max `50`).
   - **Destination Channel**: Select a channel from the searchable list.
   - **Destination User (Direct Message)**: Alternatively, select a user to forward the messages to as a private DM.
4. Click **Forward**.
5. The selected messages will be consolidated and posted in the destination with clean markdown quoting, indicating who originally sent them and when. You will receive a private confirmation message in the source channel.
