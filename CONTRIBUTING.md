# Contributing to Jules Extension

Thank you for your interest in contributing to the Jules AI VS Code extension!

## Development Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` in VS Code to launch the Extension Development Host

## CI/CD Guidelines

We use GitHub Actions for our Continuous Integration and Continuous Deployment pipeline.
All Pull Requests must pass the automated checks before they can be merged.

### Requirements

- **Linting**: We enforce code style using ESLint. Run `npm run lint` before committing.
- **Testing**: All new features and bug fixes must include tests. We enforce a >95% code coverage for the `src` directory.
  - Run `npm run test` to run the test suite.
  - Run `npm run coverage` to generate a coverage report.
- **Pre-commit**: We have a `precommit` script (`npm run precommit`) that runs both linting and tests to ensure your code is ready.

### Automated Pipeline

Our `.github/workflows/ci.yml` pipeline runs on every PR and push to `main` and `develop` branches.
It includes the following stages:
1. **Lint**: Checks for code style and formatting issues.
2. **Test**: Runs the automated test suite and generates coverage reports. Codecov is integrated for coverage tracking.
3. **Build**: Compiles and builds the extension VSIX package.
4. **Deploy**: Automatically runs when changes are pushed to `main`.

Please make sure your changes pass all stages of the pipeline. If a test fails, you can see the detailed logs in the Actions tab of the repository.

## Submitting a Pull Request

1. Create a new branch for your feature or bugfix.
2. Ensure your code follows the coding conventions and is well-documented.
3. Add or update tests as necessary to maintain coverage.
4. Ensure `npm run precommit` succeeds locally.
5. Create a descriptive PR outlining the changes and the problem it solves.