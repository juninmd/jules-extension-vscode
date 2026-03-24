# Jules – AI Coding Agent for VS Code

<div align="center">

[![CI/CD Pipeline](https://github.com/juninmd/jules-extension-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/juninmd/jules-extension-vscode/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/juninmd/jules-extension-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/juninmd/jules-extension-vscode)

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/juninmd.jules-extension-vscode?style=flat&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=juninmd.jules-extension-vscode)
[![GitHub stars](https://img.shields.io/github/stars/juninmd/jules-extension-vscode?style=flat)](https://github.com/juninmd/jules-extension-vscode)
[![License](https://img.shields.io/github/license/juninmd/jules-extension-vscode?style=flat)](LICENSE)

</div>

Use [Google Jules](https://jules.google) AI coding agent directly inside VS Code.

## What is Jules?

Jules is Google's experimental AI coding agent that can understand your codebase, make changes across multiple files, and handle complex programming tasks. This extension brings Jules into your VS Code workflow.

## Features

- **Chat Interface** — Sidebar panel to describe coding tasks and track their progress
- **Secure API Key Storage** — API key stored in VS Code's secret storage (never in plaintext)
- **Code Context** — Select code in the editor and attach it to a Jules task with one click
- **Live Task Polling** — Task status updates automatically every 5 seconds
- **Pull Request Links** — Open the PR created by Jules directly from VS Code
- **Keyboard Shortcut** — `Ctrl+Shift+J` (`Cmd+Shift+J` on Mac) to open the panel
- **Multi-language UI** — Support for English, Portuguese, Spanish, French, German, Japanese, Korean, and Chinese

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Jules AI"
4. Click **Install**

### From VSIX File

Download the `.vsix` file from [Releases](https://github.com/juninmd/jules-extension-vscode/releases) and install via `Extensions: Install from VSIX`.

## Getting Started

1. Install the extension in VS Code
2. Press `Ctrl+Shift+J` or click the Jules icon in the Activity Bar
3. Click **Configure API Key** and paste your Jules API key
4. Start describing coding tasks!

### Getting an API Key

Visit [jules.google](https://jules.google) to sign up and get your API key.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `jules.apiBaseUrl` | `https://jules.googleapis.com/v1` | Jules API base URL (advanced) |
| `jules.autoOpenOnStartup` | `false` | Auto-open the Jules panel when VS Code starts |
| `jules.language` | `en` | Display language for the Jules interface |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Jules: Open Jules Panel | `Ctrl+Shift+J` | Open the Jules sidebar |
| Jules: Configure API Key | — | Set or update your API key |
| Jules: New Task | — | Start a new task (with selected code if any) |
| Jules: Clear Chat | — | Clear the task list in the panel |

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package the extension
npm run package

# Run tests
npm run test
```

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT License – see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a [Pull Request](https://github.com/juninmd/jules-extension-vscode/pulls).
