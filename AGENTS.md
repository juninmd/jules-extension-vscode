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

<!-- base-actions-main-policy -->
## GitHub Actions — padrão obrigatório (@main)

- Referencie as actions internas sempre pelo branch, nunca por SHA:
  - `uses: juninmd/base-actions/<action>@main`
  - `uses: juninmd/base-actions/.github/workflows/<arquivo>.yml@main`
- Não fixe `@<sha>` em `juninmd/base-actions`: a atualização é centralizada no
  `main` e passa a valer no próximo run.
- PRs cujos checks não iniciam por billing/spending limit são mesclados pelo bot central
  `juninmd/base-actions/.github/workflows/auto-merge-billing-blocked.yml`.
  Para impedir o merge automático de um PR, aplique a label `do-not-merge`.