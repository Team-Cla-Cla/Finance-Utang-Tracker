<div align="center">

<img src="docs/icons/icon.svg" alt="Finance & Utang Tracker logo" width="96">

# Finance & Utang Tracker

**An offline-first personal finance and debt tracker for everyday budgeting.**

<p>
  <a href="https://team-cla-cla.github.io/Finance-Utang-Tracker/"><img src="https://img.shields.io/badge/demo-live-2ea44f?style=flat-square" alt="Live Demo"></a>&nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Team-Cla-Cla/Finance-Utang-Tracker?style=flat-square" alt="License"></a>&nbsp;
  <a href="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/commits/main"><img src="https://img.shields.io/github/last-commit/Team-Cla-Cla/Finance-Utang-Tracker?style=flat-square" alt="Last Commit"></a>&nbsp;
  <a href="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/commits/main"><img src="https://img.shields.io/github/commit-activity/y/Team-Cla-Cla/Finance-Utang-Tracker?style=flat-square" alt="Commit Activity"></a>&nbsp;
  <a href="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/stargazers"><img src="https://img.shields.io/github/stars/Team-Cla-Cla/Finance-Utang-Tracker?style=flat-square" alt="Stars"></a>&nbsp;
  <a href="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/network/members"><img src="https://img.shields.io/github/forks/Team-Cla-Cla/Finance-Utang-Tracker?style=flat-square" alt="Forks"></a>&nbsp;
  <a href="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker"><img src="https://img.shields.io/github/languages/top/Team-Cla-Cla/Finance-Utang-Tracker?style=flat-square" alt="Top Language"></a>&nbsp;
  <a href="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/actions/workflows/test.yml"><img src="https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/actions/workflows/test.yml/badge.svg" alt="Tests"></a>
</p>

[Live Demo](https://team-cla-cla.github.io/Finance-Utang-Tracker/) ·
[Report a Bug](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/issues/new) ·
[Request a Feature](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/issues/new)

</div>

Finance & Utang Tracker helps students and daily commuters record allowances, expenses, debts, repayments, and savings without depending on a hosted backend. It is available as a responsive web app, installable Progressive Web App (PWA), cross-browser extension, and Python command-line client.

The application stores data locally by default. Google Sheets synchronization is optional and connects directly from the client to the user's own Google account.

## Contents

- [Features](#features)
- [Choose Your Platform](#choose-your-platform)
- [Privacy](#privacy)
- [Demo](#demo)
- [Requirements](#requirements)
- [Fork and Deploy Your Own Copy](#fork-and-deploy-your-own-copy)
- [Google Sheets Synchronization](#google-sheets-synchronization)
- [Browser Extension Installation](#browser-extension-installation)
- [Command-Line Client](#command-line-client)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Security](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)
- [License](#license)

## Features

| Area | Description |
| --- | --- |
| Daily finances | Record allowances, expenses, balances, and spending categories |
| Debt tracking | Track money owed to others and money others owe you |
| Settlements | Record partial or full repayments without losing history |
| Stash vault | Separate savings from spendable cash and release it when needed |
| Offline-first | Continue working locally and synchronize queued changes later |
| Google Sheets | Optionally sync directly with a private spreadsheet |
| Quick actions | Create shortcuts for recurring transport and meal expenses |
| Responsive UI | Use the same application on desktop, mobile, or a browser toolbar |

## Choose Your Platform

| Platform | Best for | Start here |
| --- | --- | --- |
| Web app / PWA | Desktop and mobile use | [Deploy the web app](#fork-and-deploy-your-own-copy) |
| Browser extension | Fast logging from a browser toolbar | [Install the extension](#browser-extension-installation) |
| CLI | Terminal-based workflows and automation | [Use the CLI](#command-line-client) |

## Privacy

- Financial records are stored locally by default.
- Google Sheets synchronization is optional.
- The project does not require a project-owned backend or database.
- OAuth tokens and spreadsheet identifiers must not be committed to the repository.
- When synchronization is enabled, data is sent directly to Google APIs using the user's account.

## Demo

Try the hosted web app:

<https://team-cla-cla.github.io/Finance-Utang-Tracker/>

After forking the repository, use your own GitHub Pages URL:

`https://<your-github-username>.github.io/<your-repository-name>/`

## Architecture

```text
Web app / PWA / Browser extension / CLI
                    |
             Local application state
                    |
        Optional Google Sheets synchronization
```

See [DDD.md](DDD.md) for domain and architecture notes, and [FEATURE_GUIDE.md](FEATURE_GUIDE.md) for detailed behavior.

## Requirements

The web app and browser extension do not require a package manager or build step.

- A modern browser with JavaScript enabled
- Python 3.8 or later for the command-line client and test suite
- Node.js for the JavaScript syntax checks in the test suite
- A Google account and Google Cloud project only if Google Sheets synchronization is required

## Fork and Deploy Your Own Copy

### 1. Fork the repository

1. Open the repository on GitHub.
2. Select **Fork**.
3. Choose your GitHub account or organization.
4. Keep the fork name, or choose a new repository name.

### 2. Enable GitHub Pages

1. Open your fork and go to **Settings > Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select your default branch, usually `main`.
4. Select the `/docs` folder.
5. Click **Save**.
6. Wait for GitHub to publish the site. The deployment URL is shown in the Pages settings.

The `docs/` directory is already a static web app, so no build command is needed. If you rename the repository, update any links in your fork's documentation to match the new Pages URL.

### 3. Run the app locally

Because browsers restrict some features when files are opened directly from disk, serve the repository with a local HTTP server:

```bash
python3 -m http.server 8000 --directory docs
```

Open <http://localhost:8000> in a browser.

## Google Sheets Synchronization

Google Sheets synchronization is optional. Without it, all data remains in the browser's local storage.

### Create a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project for your fork.
3. In **APIs & Services > Library**, enable:
   - Google Sheets API
   - Google Drive API
4. Configure the OAuth consent screen:
   - Choose **External** unless the project belongs to a Google Workspace organization.
   - Add your account as a test user while the app is in testing.
   - Add these scopes:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/userinfo.email`
5. Create an OAuth 2.0 client ID under **APIs & Services > Credentials**.

Use a web application client for the deployed PWA. For a browser extension, use the client type supported by the target browser. Add the exact redirect URI shown in the app's settings to the OAuth client's authorized redirect URIs. The redirect URI differs between a GitHub Pages deployment, Firefox, and Chromium-based browsers.

### Connect the app

1. Open your deployed app or extension.
2. Open **Settings**.
3. Paste the OAuth client ID.
4. Optionally enter an existing Google Sheet URL or spreadsheet ID.
5. Select **Connect Google** and approve the requested permissions.

If no spreadsheet ID is provided, the app creates a spreadsheet named `Personal Finance Ledger` in the connected Google Drive on the first synchronization.

OAuth credentials are entered by each user in their own browser and are not stored in this repository. Do not commit client secrets, access tokens, or personal spreadsheet IDs.

## Browser Extension Installation

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `extension/manifest.json`.
4. Open the extension from the browser toolbar.

The temporary Firefox installation is removed when Firefox is restarted. For a distributable package, run:

```bash
./package_extension.sh
```

This creates an `.xpi` file and a ZIP archive in the repository root.

### Chrome, Brave, and Edge

1. Open the browser's extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the repository's `extension/` directory.
5. Pin the extension if desired.

## Command-Line Client

The command-line client stores its data locally at `~/.config/finance/finance_data.json`.

```bash
# Show current metrics and debt projections
python3 finance_client.py metrics

# Record an allowance
python3 finance_client.py allowance 250 -n "Daily allowance"

# Record an expense
python3 finance_client.py log 45 -c Meal -n "Lunch"

# Use a quick action
python3 finance_client.py quick "jeep_to_school"

# List recent transactions
python3 finance_client.py list
```

Debt and stash commands are also available:

```bash
# Debts
python3 finance_client.py utang
python3 finance_client.py utang add "Mark" 60 --direction "I Owe"
python3 finance_client.py utang settle <DEBT_ID> --amount 30
python3 finance_client.py utang settle <DEBT_ID>
python3 finance_client.py utang delete <DEBT_ID>

# Stash vault
python3 finance_client.py stash
python3 finance_client.py stash add 50 -n "Emergency reserve"
python3 finance_client.py stash balance -n "Saved balance"
python3 finance_client.py stash release <STASH_ID> --amount 30
python3 finance_client.py stash delete <STASH_ID>
```

Run `python3 finance_client.py --help` for the complete command reference.

## Project Structure

```text
.
├── docs/                       # GitHub Pages web app and PWA assets
├── extension/                  # Browser extension source
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── background.js
│   └── google_sync.js
├── finance_client.py           # Offline command-line client
├── package_extension.sh        # Creates Firefox XPI and ZIP packages
├── test_tracker.py             # Automated validation suite
├── FEATURE_GUIDE.md            # Detailed feature documentation
├── DDD.md                     # Domain and architecture notes
└── LICENSE                    # MIT license
```

## Testing

Run the automated checks from the repository root:

```bash
python3 test_tracker.py
```

The suite checks Python syntax, JavaScript syntax, extension assets and manifest configuration, and core finance calculations.

## Roadmap

- [ ] Add automated GitHub Actions testing
- [ ] Add import and export support
- [ ] Add screenshots and short usage demonstrations
- [ ] Improve extension distribution instructions
- [ ] Support additional spreadsheet providers

## Contributing

Contributions are welcome. To propose a change:

1. Fork the repository.
2. Create a focused branch for your change.
3. Make the change and add or update tests where appropriate.
4. Run `python3 test_tracker.py`.
5. Open a pull request with a description of the problem, the solution, and any setup needed to verify it.

Please keep changes focused, avoid committing personal data or credentials, and preserve the offline-first behavior.

## Support

For bugs and feature requests, open an issue in the repository. Include your browser or operating system, reproduction steps, and relevant console output. Do not include OAuth tokens, private spreadsheet links, or other sensitive information.

## License

This project is licensed under the [MIT License](LICENSE).
