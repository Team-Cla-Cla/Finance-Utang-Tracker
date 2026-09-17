# Personal Finance & Utang Tracker

This is a Personal Finance App

Offline-first personal finance and debt tracker for students and daily commuters. Built as a cross-browser extension (Firefox, Chrome, Brave, Edge), responsive mobile web app (PWA), and terminal CLI, with background auto-sync to your personal Google Sheet via direct Google Sheets API v4.

Zero third-party servers, zero hosting costs, zero tracking.

> 📱 **Live Mobile & Web App**: [https://team-cla-cla.github.io/Finance-Utang-Tracker/](https://team-cla-cla.github.io/Finance-Utang-Tracker/)
>
> 🧩 **Firefox Add-on**: `finance-utang-tracker@ryme.local.xpi` | **Chrome / Edge / Brave**: Load unpacked `/extension`

---

## Key Features

- **Instant Offline-First Architecture**: 0 ms UI response time. All actions (allowance check-in, expenses, debt logs, settlements) are saved instantly to local browser storage and queued for background sync.
- **Direct Google Sheets Sync**: Syncs directly from your browser to your private Google Sheet using Google Sheets API v4. No fragile Apps Script web apps or cold starts.
- **Utang (Debt) Management & Pay Now Projections**:
  - Track borrowed money (**I Owe**) versus lent money (**Owed to Me**).
  - **Partial & Full Settlement**: Record partial repayments without losing the remaining balance.
  - **Pay Now Projection**: Live calculation of exact net cash remaining today and for the entire week if all debts are settled immediately.
- **Stash Vault (Hidden Reserves)**:
  - Stash away excess money or today's remaining cash into a separate reserve.
  - Stashed money is automatically hidden and deducted from your active daily spendable balance so you don't spend it.
  - Discrete privacy toggle (`Hide` / `Show`) masks your stashed reserves (`••••••`).
  - 1-click **Add to Finance** (`Unstash`) transfers reserve money directly back into today's spendable cash when you need it.
- **Dynamic Quick Pills**: One-tap buttons for routine transit fares and meal expenses, with an integrated custom pill editor.
- **Interactive Ambient Background**: Fullscreen circle matrix featuring spring-damping cursor deflection, Conway's Game of Life cellular automaton, and up to 6 ambient glowing orbs distributed across 6 viewport zones.
- **Minimalist Monochrome Dark Theme**: High-contrast, distraction-free interface (`#09090b`) with tabular monospace figures.
- **Multi-User Ready**: Anyone can clone or install the extension and point it to their own Google Sheet or Google Account.

---

## Google Account Sync Setup (OAuth 2.0 Client ID)

To sync your data directly to your personal Google Drive and Google Sheets without third-party servers, follow these one-time setup steps:

### Step 1: Create a Google Cloud Project

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**.
3. Name the project (e.g. `Personal-Finance-Tracker`) and click **Create**.

### Step 2: Enable Google Sheets & Drive APIs

1. In the left sidebar, go to **APIs & Services** > **Library**.
2. Search for **Google Sheets API**, select it, and click **Enable**.
3. Return to the Library, search for **Google Drive API**, select it, and click **Enable**.

### Step 3: Configure the OAuth Consent Screen

1. In the left sidebar, select **APIs & Services** > **OAuth consent screen**.
2. Choose **External** user type and click **Create**.
3. Fill in the required fields:
   - **App name**: `Personal Finance Tracker`
   - **User support email**: Select your Google email.
   - **Developer contact information**: Enter your Google email.
4. Click **Save and Continue**.
5. On the **Scopes** step, click **Add or Remove Scopes**, check:
   - `.../auth/spreadsheets` (Google Sheets API)
   - `.../auth/drive.file` (Google Drive API)
6. Click **Update**, then **Save and Continue**.
7. Under **Test users**, click **Add Users**, enter your Google email address, and click **Save and Continue**.

### Step 4: Create OAuth 2.0 Credentials

1. In the left sidebar, select **APIs & Services** > **Credentials**.
2. Click **Create Credentials** at the top and select **OAuth client ID**.
3. Choose **Web application** (or **Chrome extension** for Chrome-only):
   - If choosing **Web application** (universal for Firefox and Chromium):
     - Name: `Finance Extension Client`
     - Under **Authorized redirect URIs**, add:
       - For Firefox: Check `browser.identity.getRedirectURL()` or add `https://*.identity.mozilla.org/`
       - Universal standard: `https://accounts.google.com/o/oauth2/v2/auth`
4. Click **Create**.
5. Copy your generated **Client ID** (it looks like `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

### Step 5: Connect in the Extension

1. Open the Finance Extension popup and click the gear icon (`[cfg]`) in the top right.
2. Under **Google Account Sync (Direct Sheets API)**, paste your **OAuth Client ID**.
3. Optionally paste an existing **Spreadsheet ID or Link** (or leave it blank to automatically create a fresh sheet on your Drive).
4. Click **Sign in with Google**.
5. Select your Google account and grant permissions. The sync status will switch to `Synced`.

---

## Extension Installation

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the file: `extension/manifest.json`.
4. Click the extension icon in the Firefox toolbar to open the tracker.

### Chromium / Chrome / Brave / Edge

1. Open your browser and navigate to `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
2. Enable **Developer mode** via the toggle switch in the top right.
3. Click **Load unpacked**.
4. Select the `extension/` directory.
5. Pin the extension to your toolbar.

---

## Terminal CLI Usage (`finance_client.py`)

A standalone offline-first terminal client is provided for rapid logging and status checks:

```bash
# View current metrics and debt projections
python3 finance_client.py metrics

# Log daily allowance
python3 finance_client.py allowance 250 -n "Daily allowance"

# Log an expense
python3 finance_client.py log 45 -c Meal -n "Lunch"

# Use a preset quick pill
python3 finance_client.py quick "jeep_to_school"

# View recent transactions
python3 finance_client.py list

# Manage Utang (Debts)
python3 finance_client.py utang                                    # List all active debts
python3 finance_client.py utang add "Mark" 60 --direction "I Owe"  # Record debt
python3 finance_client.py utang settle <DEBT_ID> --amount 30       # Partial settlement
python3 finance_client.py utang settle <DEBT_ID>                   # Full settlement
python3 finance_client.py utang delete <DEBT_ID>                   # Delete debt record

# Manage Stash Vault (Hidden Reserves)
python3 finance_client.py stash                                    # List stashes & total reserve
python3 finance_client.py stash add 50 -n "Emergency reserve"      # Stash amount from balance
python3 finance_client.py stash balance -n "Saved balance"         # Stash today's remaining cash
python3 finance_client.py stash release <STASH_ID> --amount 30     # Release back to today's finance
python3 finance_client.py stash delete <STASH_ID>                  # Delete stash record
```

CLI records are saved locally at `~/.config/finance/finance_data.json`.

---

## Project Structure

```
├── extension/
│   ├── manifest.json       # Manifest V3 extension configuration
│   ├── popup.html          # Extension UI layout
│   ├── popup.js            # Offline-first state manager & sync queue dispatcher
│   ├── google_sync.js      # Direct Google Sheets API v4 OAuth2 sync adapter
│   └── icons/              # App icons (16, 48, 128 px PNG & SVG)
├── finance_client.py       # Offline-first terminal CLI tool
├── test_tracker.py         # Automated validation suite (JS syntax, math, bundle)
├── .gitignore              # Ignored paths and cache files
└── README.md               # Documentation and setup instructions
```

---

## Testing

Run the automated test suite:

```bash
python3 test_tracker.py
```
