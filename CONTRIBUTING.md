# Contributing to Jules VS Code Extension

First of all, thank you for taking the time to contribute!

## Development Environment Setup

1. Make sure you have Node.js 20+ installed.
2. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/juninmd/jules-extension-vscode.git
   cd jules-extension-vscode
   npm ci
   ```

## CI/CD Guidelines

This project utilizes GitHub Actions for continuous integration and deployment. All pull requests and commits to the `main` and `develop` branches trigger the CI/CD pipeline (`.github/workflows/ci.yml`).

### Requirements

To ensure high code quality, every PR must pass the following checks:
- **Linting:** Code must adhere to our ESLint rules. Run `npm run lint` locally before pushing.
- **Testing:** We require a minimum of 80% code coverage. All unit and integration tests must pass.
  Run `npm run test` or `npm run coverage` locally.
- **Build Optimization:** The extension is compiled and minified using `esbuild`. Ensure your changes do not break the `npm run esbuild` and `npm run package` commands.
- **Formatting:** Ensure your code is formatted properly and follows the existing conventions.

### Pull Requests

1. Create a branch named according to the feature or fix (e.g., `feat/my-new-feature` or `fix/issue-description`).
2. Write unit tests for all business logic. Do not use mock or fake implementations in production code; restrict mocks strictly to test files.
3. Keep individual source code files strictly under **180 lines**.
4. Open a pull request against `main`. Provide a detailed description of the changes.
5. The CI pipeline will automatically lint, test, and attempt a build. Ensure all checks pass.

### Security First

Never hardcode or commit API keys or secrets. Our codebase uses VS Code's native `SecretStorage` for any sensitive configurations. Adhere to OWASP principles.