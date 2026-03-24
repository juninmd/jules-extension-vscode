# Contributing to Jules Extension

First off, thanks for taking the time to contribute!

## Development Setup

1. Clone the repository
2. Run `npm install`
3. Make your changes in the `src` folder.
4. Run `npm run compile` to build the extension.

## Testing and Quality Requirements

We enforce strict quality standards through our CI/CD pipeline:

1. **Test Coverage**: All new features and changes must include comprehensive tests. Our CI requires **at least 80% code coverage**. Run `npm run coverage` to check your coverage before submitting.
2. **Linting**: Code must conform to ESLint standards. Run `npm run lint` to find any issues.
3. **Security Check**: We regularly audit for vulnerable packages. Ensure `npm audit` passes.

## Submitting Pull Requests

1. Make sure to commit changes to a separate branch.
2. Create your Pull Request against the `develop` or `main` branch.
3. Once created, GitHub Actions will automatically run the CI pipeline, which includes linting, testing, and building the extension.
4. The PR cannot be merged if any of the CI/CD stages fail.

## Deployment Strategy

* Pushes or Pull Request merges to `develop` trigger a staging deployment (uploading `.vsix` as artifact).
* Pushes or Pull Request merges to `main` trigger a production deployment (creating a GitHub Release with the extension `.vsix` file).
