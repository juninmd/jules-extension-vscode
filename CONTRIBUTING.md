# Contributing to Jules Extension for VS Code

First off, thank you for considering contributing to Jules Extension! It's people like you that make Jules a great tool for everyone.

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Compile the extension: `npm run compile` (or `npm run watch` for auto-recompilation)
4. Open the project in VS Code and press `F5` to open a new VS Code window with the extension loaded.

## Testing

All features and bug fixes must include corresponding tests. We use Mocha, Chai, and Sinon for testing.

- Run tests: `xvfb-run npm run test` (or just `npm run test` if you have a display server available)
- Run tests with coverage: `xvfb-run npm run coverage`

**Important:** We require a minimum test coverage of 80% for statements, branches, functions, and lines. Pull requests will fail CI if coverage drops below this threshold.

## Code Style

- We use TypeScript and ESLint.
- Run `npm run lint` to check for style issues.
- Please ensure your code follows the existing style and conventions.
- **File Length Limit:** To keep our codebase modular and maintainable, no file should exceed 180 lines of code.

## Pull Request Process

1. Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`).
2. Make your changes and write tests.
3. Ensure all tests pass (`npm run test`) and coverage is sufficient (`npm run coverage`).
4. Ensure linting passes (`npm run lint`).
5. Commit your changes with descriptive commit messages.
6. Push your branch and open a Pull Request against the `main` branch.
7. The CI/CD pipeline will automatically run linting, security scans, and tests. All checks must pass before merging.

## CI/CD Pipeline

Our GitHub Actions workflow automatically runs:
- **Linting:** Checks code style using ESLint.
- **Security:** Scans dependencies for vulnerabilities using `npm audit`.
- **Testing:** Runs the test suite with coverage reporting.
- **Build:** Compiles the TypeScript code and packages the extension into a `.vsix` file.

Thank you for contributing!
