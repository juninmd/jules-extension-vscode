# jules-extension-vscode

A Visual Studio Code extension to use [Google Jules](https://jules.google) AI coding agent directly inside VS Code.

## Features

- 🤖 **Chat interface** — Sidebar panel to describe coding tasks and track their progress
- 🔑 **Secure API key storage** — API key is stored in VS Code's secret storage (never in plaintext)
- 📎 **Code context** — Select code in the editor and attach it to a Jules task with one click
- 🔄 **Live task polling** — Task status updates automatically every 5 seconds
- 🔗 **Pull Request links** — Open the PR created by Jules directly from VS Code
- ⌨️ **Keyboard shortcut** — `Ctrl+Shift+J` (`Cmd+Shift+J` on Mac) to open the panel

## Getting Started

1. Install the extension in VS Code
2. Press `Ctrl+Shift+J` or open the Jules icon in the Activity Bar
3. Click **Configure API Key** and paste your Jules API key
4. Start describing coding tasks!

## Getting an API Key

Visit [jules.google](https://jules.google) to sign up and get your API key.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `jules.apiBaseUrl` | `https://jules.googleapis.com/v1` | Jules API base URL (advanced) |
| `jules.autoOpenOnStartup` | `false` | Auto-open the Jules panel when VS Code starts |
| `jules.language` | `en` | Display language for the Jules interface |

The API key is stored securely using VS Code's built-in secret storage and never written to settings files.

## Commands

| Command | Shortcut | Description |
|---|---|---|
| Jules: Open Jules Panel | `Ctrl+Shift+J` | Open the Jules sidebar |
| Jules: Configure API Key | — | Set or update your API key |
| Jules: New Task | — | Start a new task (with selected code if any) |
| Jules: Clear Chat | — | Clear the task list in the panel |

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## License

MIT
