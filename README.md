<div align="center">

<img src="docs/readme-hero.svg" alt="Finance & Utang Tracker: local-first finance system" width="100%">

[Live Demo](https://team-cla-cla.github.io/Finance-Utang-Tracker/) ·
[Report a Bug](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/issues/new) ·
[Request a Feature](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/issues/new)

</div>

Finance & Utang Tracker helps students and daily commuters record allowances, expenses, debts, repayments, and savings without depending on a hosted backend. It is available as a responsive web app, installable Progressive Web App (PWA), and cross-browser extension.

The application stores data locally by default. Google Sheets synchronization is optional and connects directly from the client to the user's own Google account.

<div align="center">
<a href="docs/readme-divider.svg"><img src="docs/readme-divider.svg" alt="Decorative signal divider" width="100%"></a>
</div>

## Contents

- [Features](#features)
- [Choose Your Platform](#choose-your-platform)
- [Privacy](#privacy)
- [Tools & Technologies](#tools--technologies)
- [Available Clients](#available-clients)
- [Project Workflow](#project-workflow)
- [Deployment and Automation](#deployment-and-automation)
- [Demo](#demo)
- [Requirements](#requirements)
- [Fork and Deploy Your Own Copy](#fork-and-deploy-your-own-copy)
- [Google Sheets Synchronization](#google-sheets-synchronization)
- [Browser Extension Installation](#browser-extension-installation)
- [Project Structure](#project-structure)
- [Repository Map](#repository-map)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Repository Metrics](#repository-metrics)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Security](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)
- [License](#license)

## Project Status

| Area | Status |
| --- | --- |
| Web app / PWA | Active |
| Browser extension | Active |
| Google Sheets sync | Optional |
| Automated tests | GitHub Actions |
| Contributions | Welcome |

## Tools & Technologies

<div align="center">
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" title="HTML5">
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" title="CSS3">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111111" alt="JavaScript" title="JavaScript">
<img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" title="PWA">
<img src="https://img.shields.io/badge/WebExtensions-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white" alt="WebExtensions" title="WebExtensions">
<img src="https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=googlesheets&logoColor=white" alt="Google Sheets" title="Google Sheets">
<img src="https://img.shields.io/badge/Google_OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google OAuth" title="Google OAuth">
<img src="https://img.shields.io/badge/GitHub_Pages-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages" title="GitHub Pages">
<img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" title="GitHub Actions">
<img src="https://img.shields.io/badge/Bash-4EAA25?style=for-the-badge&logo=gnubash&logoColor=white" alt="Bash" title="Bash">
</div>

## Available Clients

| Client | Technology | Use case | Distribution |
| --- | --- | --- | --- |
| Web app / PWA | HTML, CSS, JavaScript, Service Worker | Desktop and mobile budgeting | GitHub Pages or local server |
| Browser extension | WebExtensions API | Fast logging from the browser toolbar | Temporary or unpacked installation |
| Google Sheets sync | OAuth 2.0 and Sheets API | Optional multi-device data synchronization | Enabled from Settings |

## Project Workflow

```text
                         GitHub repository
                                  |
                 +----------------+----------------+
                 |                                 |
          GitHub Actions                    GitHub Pages
          Automated tests                   Hosted web app
                 |                                 |
                 +----------------+----------------+
                                  |
              Web app / PWA / Browser extension
                                  |
                     Local application state
                                  |
              Optional Google Sheets synchronization
```

## Deployment and Automation

- **GitHub Pages** hosts the static PWA from the `docs/` directory.
- **GitHub Actions** runs the automated browser-app validation suite on pushes and pull requests.
- **Dependabot** checks GitHub Actions dependencies monthly.
- **Bash packaging** creates Firefox `.xpi` and ZIP archives.
- **No build server is required** for the web app or browser extension.

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
Web app / PWA / Browser extension
                    |
       Shared browser-compatible domain services
 (ledger, debt, stash, settings, cloud merge, and sync-queue mutations)
                    |
             Local application state
                    |
        Optional Google Sheets synchronization
```

See [DDD.md](DDD.md) for domain and architecture notes, and [FEATURE_GUIDE.md](FEATURE_GUIDE.md) for detailed behavior.

Both clients load the same pure, non-module domain model (`shared/domain.js`) and
application use-case layer (`shared/application.js`), copied into each static client package,
before their UI scripts. Settings also includes a persisted
**Pause Live Conway Animation** toggle for stopping and resuming background animation work.
The CI checks that the canonical domain service and both client controllers remain synchronized.

## Requirements

The web app and browser extension do not require a build step.

- A modern browser with JavaScript enabled
- Node.js for JavaScript checks and the optional local server
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
npx --yes http-server docs -p 8000
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

## Project Structure

```text
.
├── docs/                       # GitHub Pages web app and PWA assets
│   ├── styles/app.css          # Shared presentation stylesheet copy
│   ├── client/                 # Shared state and presentation adapters
│   └── shared/                 # Browser-compatible domain and application copies
├── extension/                  # Browser extension source
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── background.js
│   ├── google_sync.js
│   ├── styles/app.css
│   ├── client/
│   └── shared/
├── shared/domain.js             # Canonical pure domain model
├── shared/application.js        # Canonical application use cases
├── tests/domain.test.js         # Domain behavior checks
├── package_extension.sh        # Creates Firefox XPI and ZIP packages
├── FEATURE_GUIDE.md            # Detailed feature documentation
├── DDD.md                     # Domain and architecture notes
└── LICENSE                    # MIT license
```

## Repository Map

```text
docs/                  Web app, PWA assets, and GitHub Pages source
extension/             Browser extension source
package_extension.sh   Extension packaging script
.github/               Actions, issue templates, and contributor config
README.md              Project documentation
```

## Testing

Automated checks run through GitHub Actions on pushes and pull requests. The workflow checks JavaScript syntax and required GUI assets.

The [GitHub Actions workflow](.github/workflows/test.yml) runs automatically for pushes and pull requests.

## Roadmap

- [ ] Add import and export support
- [ ] Add screenshots and short usage demonstrations
- [ ] Improve extension distribution instructions
- [ ] Support additional spreadsheet providers

## Repository Metrics

The repository's current activity is available from GitHub:

- [Commit history](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/commits/main)
- [Contributors](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/graphs/contributors)
- [Stars](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/stargazers)
- [Forks](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/network/members)
- [Open issues](https://github.com/Team-Cla-Cla/Finance-Utang-Tracker/issues)

## Contributing

Contributions are welcome. To propose a change:

1. Fork the repository.
2. Create a focused branch for your change.
3. Make the change and add or update tests where appropriate.
4. Run the automated checks locally if applicable.
5. Open a pull request with a description of the problem, the solution, and any setup needed to verify it.

Please keep changes focused, avoid committing personal data or credentials, and preserve the offline-first behavior.

## Support

For bugs and feature requests, open an issue in the repository. Include your browser or operating system, reproduction steps, and relevant console output. Do not include OAuth tokens, private spreadsheet links, or other sensitive information.

## License

This project is licensed under the [MIT License](LICENSE).
