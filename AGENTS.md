# AGENTS.md - Jules VS Code Extension

## Tech Stack
- **Language:** TypeScript
- **Runtime:** VS Code Extension API
- **Build:** pnpm, esbuild/vite
- **Testing:** Vitest
- **Linting:** ESLint, commitlint
- **Format:** Editorconfig, prettier
- **CI:** GitHub Actions (dependabot)

## Project Structure
```
src/
  extension.ts        # Extension entry point
  julesApiClient.ts   # Jules API client
  julesProvider.ts    # Webview/UI provider
media/                # Extension assets
test/                 # Test files
```

## Key Dependencies
- `@vscode/webview-ui-toolkit` - UI components
- Built with pnpm workspace

## Build & Test
```bash
pnpm install
pnpm run compile    # Build extension
pnpm test           # Run vitest
pnpm run lint       # ESLint check
```

## Environment
- `JULES_API_KEY` - Jules API key (optional, stored in VS Code secret storage)
