# Message Forwarder Plugin for Mattermost

A native Mattermost plugin that adds a premium, interactive side-by-side modal to batch-forward recent messages. Simply click **"Forward Message(s)"** from any post's hover options menu, select your target channels or users, check/uncheck messages in a chronological preview feed (with image thumbnail support), and forward them instantly.

---

## Features

- 📎 **Dropdown Hover Action**: Launch the batch-forwarding interface directly from any post's hover options menu.
- 🖱️ **Click-to-Select Timeline**: Shows a chronological timeline centered on your clicked post. Directly toggle messages in the preview box to include/exclude them from the forward.
- 🖼️ **Inline Image Previews**: Automatically renders thumbnails of image attachments inside the preview box before forwarding.
- 🚀 **Auto-Redirect & Close**: Seamlessly redirects your view to the target channel or DM after a successful forward, then auto-closes after 1.5 seconds.
- 🌓 **Mattermost Theme Alignment**: Dynamically inherits styles using native CSS variables (`--center-channel-bg`, `--button-bg`, etc.) and native opacity fallbacks to match dark, light, or custom themes.
- 🕒 **Local Time Zone Conversion**: Automatically parses UTC timestamps to the local time zone (`GMT+7`) for the forwarded message header quotes.
- 🔒 **Secure Attachment Forwarding**: Re-uploads original file attachments to target destinations so they inherit target channel permissions. In-place Markdown file ID replacement prevents double rendering or broken access.

---

## Build Instructions

### Prerequisites
- **Go** 1.18+ (for server compilation)
- **Node.js** 16+ & **npm** (for webapp compilation)

### Packaging the Plugin
Run the package command from the root project folder to compile the backend executable for all target OS distributions (Linux, Windows, Darwin) and bundle the React webapp:

```bash
make package
```

The output package will be generated at:
`dist/com.rivestudy.message-forwarder.tar.gz`

---

## Installation Steps

1. Log in to your Mattermost instance as a **System Administrator**.
2. Navigate to **System Console** -> **Plugins** -> **Plugin Management**.
3. Under **Upload Plugin**, choose the generated `dist/com.rivestudy.message-forwarder.tar.gz` and upload it.
4. Locate **"Message Forwarder by rivestudy"** in the list of installed plugins and click **Enable**.

---

## How to Use

1. Hover over any post in a channel or DM chat.
2. Click the **`...` (More Actions)** menu and select **`📎 Forward Message(s)`**.
3. In the modal:
   - **Left Column**: Displays a chronological preview of messages. Click any message card to check/uncheck it. (The trigger message is selected by default). Image attachments will show as inline previews.
   - **Right Column**: Search for destination channels or direct messages under the **Channels** or **Users / DMs** tabs.
4. Click **Forward**. The status will update, automatically slide your channel view to the forwarded channel, and close the dialog in 1.5 seconds.

---

## Sandbox Preview Environment

We have provided a standalone preview environment for testing the React components without installing a Mattermost server:

```bash
cd webapp
npm run sandbox
```

This starts a local dev server at `http://localhost:3000/` with live-reloading. Any change to `ForwardModal.jsx` will be instantly reflected in the browser mockup.
