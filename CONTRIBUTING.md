# Contributing to Jules VS Code Extension

First off, thank you for considering contributing to the Jules VS Code Extension! It's people like you that make Jules such a great tool.

## CI/CD Pipeline

We use GitHub Actions to automate our testing and deployment process. Our CI/CD pipeline consists of the following stages:

### 1. Linting
Code is linted automatically using `eslint`. To run it locally:
```bash
npm run lint
```

### 2. Testing and Coverage
We require a strict minimum of **95%** code coverage for the `src` directory. Tests run automatically on every pull request. To run locally:
```bash
# Run tests
npm run test

# Run coverage
npm run coverage
```
> **Note:** If you are running tests on headless Linux (like in CI), use `xvfb-run -a npm run test`.

### 3. Build & Package
The extension is built and packaged into a `.vsix` file using `vsce`. To verify the build locally:
```bash
npm run compile
npm run package
```

### 4. Deployments
Deployments are fully automated via GitHub Actions:
- **Staging Deployment:** Triggers automatically upon merging a pull request into `main` or `develop`.
- **Production Deployment:** Triggers on pushes to the `main` branch. This environment requires a manual approval gate before the actual release happens.

## Pre-commit Hooks
We enforce a `precommit` step in `package.json` to ensure code is verified before changes are committed:
```bash
npm run precommit
```
This runs linting and test coverage. Please make sure everything passes before opening a PR!

## Security Guidelines
- Always validate user inputs.
- Never commit secrets (API keys, tokens). They should be handled securely.
- Only mock network requests in tests (no mocks in production).
