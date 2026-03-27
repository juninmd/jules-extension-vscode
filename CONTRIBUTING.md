# Contributing to Jules VS Code Extension

First off, thank you for considering contributing to Jules! It's people like you that make Jules such a great tool.

## CI/CD Guidelines

This project utilizes GitHub Actions for continuous integration and continuous deployment (CI/CD). All pull requests and commits to the `main` branch are automatically checked to ensure they meet our quality and test coverage requirements.

### Testing and Code Coverage
- All business logic **must** have unit tests.
- Minimum required test coverage is **95%** for `src` files.
- You can run the tests locally to ensure your code passes:
  ```bash
  xvfb-run npm run coverage
  ```
- Make sure to add tests for any new feature or bug fix you implement.

### Quality Gates
- **Linting:** Code must pass standard ESLint rules. Run `npm run lint` locally before committing.
- **Type Checking:** All TypeScript files must compile with no errors.
- **Pre-commit checks:** The `package.json` includes a `precommit` script. It is recommended to run `npm run precommit` before pushing changes to automatically run the linters and tests.

### Build Artifacts
- The CI pipeline automatically builds and packages the `.vsix` artifact when the code is pushed to `main`.
- To build locally:
  ```bash
  npx vsce package
  ```
- **Note:** Do not include the `out/` directory in `.vscodeignore` as it is required for the packaged extension to function correctly.

### Pull Requests
1. Fork the repository and create your branch from `main`.
2. Ensure your code strictly adheres to the file limit of **180 lines of code**.
3. Do not use mocks or fake implementations in production code; use mocks **only** in tests.
4. Open your PR and ensure all GitHub Actions checks pass successfully.
