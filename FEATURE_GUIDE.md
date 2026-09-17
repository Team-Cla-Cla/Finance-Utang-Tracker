# Personal Finance & Utang Tracker: Feature Architecture & Complete Flow Guide

A high-performance, offline-first personal telemetry dashboard and debt tracking engine built for personal and student daily cash flow management.

---

## 1. System Architecture & Core Philosophy

### Offline-First State Engine
* **Local State Authority**: All state (`transactions`, `debts`, `stashes`, `quickPills`, `settings`, `syncQueue`, `auditTrail`) lives directly inside browser storage (`chrome.storage.local` with fallback to `localStorage`).
* **Zero Latency**: Every user action (logging an expense, collecting allowance, adjusting a stash, or paying down debt) computes and renders at 0 ms.
* **Resilient Sync Queue**: If offline or unauthenticated, Google Sheets API mutations are enqueued in `syncQueue`. Upon reconnection or authentication, changes are replayed sequentially without blocking user interaction.
* **Tabular Monospace Precision**: Monospace figures with integer and decimal robustness, automatic comma formatting, and protection against floating-point drift.

---

## 2. Complete Feature Flows & Edge Scenarios

### 2.1 Daily Allowance Check-in
* **Flow**:
  1. On first launch each day, the tracker evaluates whether an allowance has been recorded for the current calendar date (`YYYY-MM-DD`).
  2. If absent, an attention banner prompts: *"No allowance recorded today. Did you get money?"*
  3. Quick actions:
     - **`+200 School`**: Instantly credits 200 to today's cash balance under the `Allowance` category.
     - **`None`**: Dismisses the check-in banner for the day without modifying balances.
     - **`+Custom`**: Focuses the entry form with type pre-selected as `Allowance`.
* **Scenarios**:
  - *Already Logged*: If an allowance entry exists for today, the check-in banner remains hidden.
  - *Multiple Allowances*: Logging an additional allowance later in the day increases `Today Balance` cumulatively.

---

### 2.2 Expense & Allowance Logging
* **Quick Pills**: One-tap buttons for repetitive fares and meals (`Hwy 15`, `Sch 22`, `Meal 45`, `Rice 30`, etc.).
  - Clicking a pill pre-populates Amount, Category, and Note instantly.
  - Integrated **Pill Editor**: Users can add, edit, or delete custom pills anytime.
* **Form Inputs**:
  - **Amount**: Accepts whole integers (`50`), decimals (`22.50`), or text input with commas.
  - **Type**: `Expense` or `Allowance`.
  - **Category**: `Transportation`, `Food`, `Allowance`, `School`, `Personal`, `Other`.
  - **Date**: Defaults to today (`YYYY-MM-DD`). Selecting a past date from the calendar or form records historical entries without disrupting today's spendable balance.
  - **Note**: Optional context (e.g., *"Jeepney to terminal"*).
* **Scenarios**:
  - *Duplicate Prevention*: Form resets immediately after submit, and a non-shifting confirmation notice confirms entry without page jump.

---

### 2.3 Utang (Debt Management) & Wallet Linking
The tracker distinguishes between **borrowed money** and **lent money**, with optional wallet balance integration.

#### Scenario A: I Owe Them (Utang ko)
1. User enters person's name, amount, note, and date.
2. Checkbox: **"Add to cash balance (borrowed into wallet)"**
   - *Checked*: Borrowed cash is physically received in your pocket. `Today Balance` increments by the borrowed amount immediately.
   - *Unchecked*: Non-cash loan (e.g., someone bought you a lunch or ticket directly). Debt is tracked in Active Debts without modifying cash balance.

#### Scenario B: They Owe Me (Pautang)
1. User enters debtor's name, amount, note, and date.
2. Checkbox: **"Deduct from cash balance (lent from wallet)"**
   - *Checked*: You physically handed cash from your wallet to a friend. `Today Balance` decrements immediately.
   - *Unchecked*: Non-cash debt (e.g., transferring a digital ticket or covering a bill already paid). Debt is tracked without touching today's cash.

#### Scenario C: Partial & Full Debt Settlement
1. Clicking **Pay** (for money you owe) or **Collect** (for money owed to you) opens the settlement dialog.
2. Form defaults to the full outstanding balance, but user can enter any partial amount.
3. Settlement Wallet Option:
   - Paying a debt offers **"Deduct from cash balance (paid from wallet)"**.
   - Collecting a debt offers **"Add to cash balance (received into wallet)"**.
4. Logic:
   - If payment equals outstanding debt: Marked as fully settled and removed from active list.
   - If payment is less than outstanding debt: Remaining debt stays active with updated balance.
   - Payment cannot exceed the remaining balance (automatically clamped).

#### Scenario D: Pay Now Projections
* **`Pay now projection (today)`**: Calculates your true net cash if you settled all debts today:
  $$\text{Projection}_{\text{today}} = \text{Today Cash Balance} - \text{Total I Owe}$$
* **`Pay now projection (week)`**: Calculates projected net cash across the current 7-day rolling window:
  $$\text{Projection}_{\text{week}} = \text{7-Day Net Cash} - \text{Total I Owe} + \text{Total Owed to Me}$$

---

### 2.4 Stash Vault (Hidden Reserves)
* **Purpose**: Prevents overspending by locking leftover daily money into a separate reserve.
* **Balance Isolation**:
  - Money stashed is subtracted from your spendable `Today Balance`.
  - It does not count towards daily spendable cash or runway burn.
* **Actions**:
  - **`+ Stash`**: Move cash from wallet into vault (reduces today's balance).
  - **`Add to Finance` (Unstash)**: Transfer money out of vault back into spendable balance (increases today's balance).
  - **`Hide / Show`**: Discrete privacy toggle masks reserves as `••••••`.

---

### 2.5 Streak, Missed Days, & Daily Rollover Engine
* **Midnight Anchor Rollover**:
  - At 00:00 local time, daily cash balances roll over into historical cumulative net cash.
  - Form date defaults to the new day automatically.
* **Active Streak**:
  - Counts consecutive active logging days.
  - Streak remains unbroken as long as an entry is recorded every calendar day.
* **Missed Days Telemetry (Last 14 Days)**:
  - Scans the trailing 14 calendar days.
  - Any day prior to today with zero recorded transactions is flagged as a **Missed Day**.
  - Visual heatmap displays:
    - Green border: Active logging day.
    - Red fill: Missed day.
    - White outline: Current day.
    - Dim gray: Days prior to initial tracking start.

---

### 2.6 Desktop Dashboard Layout (85% Screen)
* **Semi-Fullscreen Architecture**:
  - On desktop (`>= 840px`), the container locks to `85vw` width and `85vh` height, centered both horizontally and vertically.
  - 7.5% margins expose the interactive background canvas on all four sides.
* **Three Functional Columns**:
  1. **Left Column (`360px`)**: Today's Balance, Stash Vault, Check-in Banner, Expense/Utang Forms, Quick Pills.
  2. **Middle Column (`minmax(320px, 1fr)`)**: Debt Summary & Projections, Active Debt List, Scrollable Recent Activity Feed.
  3. **Right Column (`350px`)**: Millisecond Precision Chronometer, Full Monthly Calendar, Day Inspector with transaction details and "Use in Form" action.

---

### 2.7 Interactive Background Matrix & Analytics HUD
* **50% Transparent Glassmorphism**:
  - Dashboard container and metrics cards use `rgba(12, 12, 16, 0.50)` with `backdrop-filter: blur(8px)`.
  - The reactive particle grid shines directly through the cards and around their borders.
* **Ambient Floating Light Orbs (6 Distributed Spaces)**:
  - Up to 6 distinct glowing orbs wander across 6 evenly distributed spatial zones of the viewport.
  - Clicking any action button cycles spawn points across the 6 zones with gentle harmonic drift, smooth boundary deflection, and dynamic breathing radii.
* **Cursor Repulsion Physics & Conway's Cellular Automaton**:
  - **Influence Radius**: `270px` deflection circle centered at cursor position.
  - **Ambient Spotlight Glow**: `350px` radial gradient illuminating nearby dots.
  - Interactive matrix dots deflect smoothly using spring damping physics and ignite cells in the background cellular grid.
* **Metrics Modal (Financial Analytics & Streak)**:
  - Pressing `` ` `` (backtick) or clicking `[metrics]` opens the 85% semi-fullscreen HUD.
  - The underlying dashboard is automatically hidden while metrics is active to prevent ghosting.
  - 2-column analytics grid:
    - *Left*: Cumulative Balance & Runway interactive canvas graph + 14-day Missed Days Grid.
    - *Right*: Daily Cash Flow (In vs Out 7-day bars) + Category Spending Distribution (14d/All) + Real-time Audit Trail & Edit Logs.

---

### 2.8 Keyboard Shortcuts & Navigation
* **`` ` `` (Backtick / Tilde)**:
  - Toggles the Metrics Telemetry modal open or closed from anywhere in the app.
  - Automatically disabled when typing inside input or select fields.
* **`Escape` Key Handling**:
  - *When any modal is open*: Closes that modal cleanly.
  - *When on main dashboard*: Opens the confirmation modal: *"Close Window? Press Esc again to close, or click anywhere to dismiss."*
  - *Pressing Esc again while confirmation is active*: Immediately executes `window.close()`.
  - *Clicking anywhere*: Dismisses the close confirmation dialog.

---

### 2.9 Google Sheets Sync & Security
* **Direct Google Sheets API v4**: Syncs without intermediary cloud servers or cold starts.
* **Formula Sanitization**: Any note or text beginning with `=`, `+`, `-`, or `@` is prefixed with `'` to prevent formula injection.
* **JSON Export & Fresh Account Reset**:
  - **Export Local Backup**: Downloads full state as a `.json` backup file.
  - **Clear All Data (Fresh Account)**: Prompts confirmation, wipes all local transactions, debts, stashes, and streak counters, and starts with a clean slate.

---

## 3. How to Make This Extension Permanent in Firefox

When loading an extension via `about:debugging#/runtime/this-firefox`, Firefox treats it as a **temporary add-on** and unloads it whenever the browser restarts.

To make it your **permanent personal niche tool** that never unloads:

### Method 1: Firefox Enterprise Policy (Recommended for Standard Firefox on Linux)
Firefox allows persistent unsigned local extensions via Enterprise Policies.

1. Build the permanent extension package:
   ```bash
   cd /home/ryme/Personal/Finance/extension
   zip -r -FS ../finance-utang-tracker@ryme.local.xpi *
   ```

2. Create the policy directory and configuration file:
   ```bash
   sudo mkdir -p /etc/firefox/policies
   sudo bash -c 'cat << "EOF" > /etc/firefox/policies/policies.json
   {
     "policies": {
       "ExtensionSettings": {
         "finance-utang-tracker@ryme.local": {
           "installation_mode": "normal_installed",
           "install_url": "file:///home/ryme/Personal/Finance/finance-utang-tracker@ryme.local.xpi"
         }
       }
     }
   }
   EOF'
   ```

3. Restart Firefox. The extension is permanently installed, visible in `about:addons`, and will never unload on restart.

---

### Method 2: Firefox Developer Edition / Nightly / LibreWolf
If you use Firefox Developer Edition, Nightly, or LibreWolf:
1. Open `about:config`.
2. Set `xpinstall.signatures.required` to `false`.
3. Open `about:addons`, click the gear icon, select **Install Add-on From File...**, and choose `/home/ryme/Personal/Finance/finance-utang-tracker@ryme.local.xpi`.
4. It will remain installed permanently across reboots.

---

### Method 3: Desktop App Window Launcher
Because the tracker features a complete 85% desktop semi-fullscreen interface, you can also launch it directly as a standalone window using your terminal or desktop keybinding:

```bash
# Add alias or run directly
firefox --new-window "moz-extension://<extension-id>/popup.html"
```
You can find your extension's internal URL by opening the popup and right-clicking inside -> **Inspect**, then copying the `moz-extension://.../popup.html` URL.
