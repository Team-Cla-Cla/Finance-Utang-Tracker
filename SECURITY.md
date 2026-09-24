# Security Policy

## Supported versions

Security fixes are applied to the latest version on the default branch. Older forks and local copies may not receive updates.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability. Use GitHub's private vulnerability reporting feature when it is available for this repository. If it is unavailable, contact a repository maintainer privately through the project owner's GitHub profile and include:

- A short description of the vulnerability
- Affected files or features
- Reproduction steps or a proof of concept that contains no real data
- The potential impact
- Any suggested mitigation

Please allow maintainers reasonable time to investigate before publicly disclosing the issue.

## Sensitive information

Never include any of the following in an issue, pull request, log, screenshot, or test fixture:

- OAuth access or refresh tokens
- Google client secrets
- Private spreadsheet URLs or IDs
- Personal financial records
- Browser storage exports
- Passwords or other credentials

The application stores financial data locally by default. Google Sheets synchronization is optional and communicates directly with Google APIs using the user's account. Users are responsible for securing their devices, browser profiles, Google account, and synced spreadsheets.
