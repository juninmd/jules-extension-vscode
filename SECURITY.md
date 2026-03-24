# Security Policy

## Supported Versions

Currently, only the latest version of the `jules-extension-vscode` extension is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| >= 0.1.x | :white_check_mark: |
| < 0.1.x  | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to the maintainer via the contact information on the GitHub profile. All security vulnerabilities will be promptly addressed.

Please include the following information in your report:
- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

## Security Features

This extension utilizes several security best practices, including:
- **Secrets Management**: Sensitive information like `.env` files and certificates are ignored via `.gitignore`.
- **Automated Dependency Updates**: We use Dependabot to keep dependencies updated and secure against known vulnerabilities.
- **Secure API Key Storage**: The extension utilizes VS Code's SecretStorage to manage API keys securely, never exposing them in plaintext.

## Best Practices
- Never commit `.env` or configuration files containing secrets.
- Always validate and sanitize user inputs where applicable.
- Keep dependencies updated using tools like `npm audit`.
