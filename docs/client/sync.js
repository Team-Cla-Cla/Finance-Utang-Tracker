// Google synchronization presentation and infrastructure controller.
// --- Google Account & Auto-Sync Engine ---
async function hydrateFromCloud(token, sheetId) {
  try {
    const cloudData = await GoogleSync.pullAllData(token, sheetId);
    const merged = FinanceApplication.mergeCloudData(appState, cloudData);
    const updated = merged.updated;
    appState.transactions = merged.state.transactions;
    appState.debts = merged.state.debts;
    appState.stashes = merged.state.stashes;
    appState.presets = merged.state.presets;
    appState.auditLog = merged.state.auditLog;

    if (updated) {
      persistState();
      renderUI();
    }
    return cloudData;
  } catch (e) {
    console.warn("Hydrate from cloud error:", e);
    throw e;
  }
}

async function triggerAutoSync() {
  if (isSyncing || !navigator.onLine) return;
  if (!appState.googleAuth || !appState.googleAuth.token) return;
  if (!appState.syncQueue || appState.syncQueue.length === 0) return;

  isSyncing = true;
  updateSyncBadge();

  try {
    let token = appState.googleAuth.token;
    let sheetId = appState.googleAuth.spreadsheetId;

    if (!sheetId) {
      sheetId = await GoogleSync.getOrCreateSpreadsheet(token);
      appState.googleAuth.spreadsheetId = sheetId;
      persistState();
    }

    const res = await GoogleSync.flushSyncQueue(token, sheetId, appState.syncQueue);
    appState.syncQueue = res.remaining || [];
    persistState();
  } catch (err) {
    console.error("AutoSync error:", err);
    if (err.message && err.message.includes("401") && appState.googleAuth.clientId) {
      // Attempt silent background reauth
      try {
        const refreshedToken = await GoogleSync.authenticate(appState.googleAuth.clientId, false);
        if (refreshedToken) {
          appState.googleAuth.token = refreshedToken;
          persistState();
          const retryRes = await GoogleSync.flushSyncQueue(refreshedToken, appState.googleAuth.spreadsheetId, appState.syncQueue);
          appState.syncQueue = retryRes.remaining || [];
          persistState();
          return;
        }
      } catch (silentErr) {
        console.warn("Silent reauth failed:", silentErr);
        appState.googleAuth.token = null;
        persistState();
        updateGoogleStatusUI();
      }
    } else if (err.message && err.message.includes("401")) {
      appState.googleAuth.token = null;
      persistState();
      updateGoogleStatusUI();
    }
  } finally {
    isSyncing = false;
    updateSyncBadge();
  }
}

async function loginGoogle() {
  const btn = document.getElementById("btnGoogleLogin");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Connecting...";
  }

  const clientId = (appState.googleAuth && appState.googleAuth.clientId) ? appState.googleAuth.clientId.trim() : "";
  if (!clientId) {
    showStatus("Please paste your Google OAuth Client ID in Settings first", true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Connect Google";
    }
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "flex";
    const cfgC = document.getElementById("cfgClientId");
    if (cfgC) cfgC.focus();
    return;
  }

  async function postLoginHydration(token, email) {
    appState.googleAuth.token = token;
    appState.googleAuth.email = email;
    persistState();
    updateGoogleStatusUI();
    showStatus(`Connected as ${email}`, false);

    let sheetId = appState.googleAuth.spreadsheetId;
    try {
      if (!sheetId) {
        sheetId = await GoogleSync.getOrCreateSpreadsheet(token);
        appState.googleAuth.spreadsheetId = sheetId;
        const cfgS = document.getElementById("cfgSheet");
        if (cfgS) cfgS.value = sheetId;
        persistState();
      }
      await hydrateFromCloud(token, sheetId);
    } catch (e) {
      console.warn("Initial hydration note:", e);
    }
    await triggerAutoSync();
  }

  const isExtensionRuntime = typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id &&
    (location.protocol === "chrome-extension:" || location.protocol === "moz-extension:");

  if (isExtensionRuntime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: "LOGIN_GOOGLE", clientId }, async (res) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Connect Google";
      }

      if (chrome.runtime.lastError) {
        try {
          const token = await GoogleSync.authenticate(clientId, true);
          const email = await GoogleSync.getUserEmail(token);
          await postLoginHydration(token, email);
        } catch (err) {
          showStatus("Google Login Error: " + err.message, true);
        }
        return;
      }

      if (res && res.success) {
        await postLoginHydration(res.token, res.email);
      } else {
        showStatus("Google Login Error: " + ((res && res.error) || "Authentication failed"), true);
      }
    });
  } else {
    try {
      const token = await GoogleSync.authenticate(clientId, true);
      if (token) {
        const email = await GoogleSync.getUserEmail(token);
        await postLoginHydration(token, email);
      }
    } catch (err) {
      showStatus("Google Login Error: " + err.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Connect Google";
      }
    }
  }
}

// Listen for storage changes from background sync
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.googleAuth) {
      appState.googleAuth = { ...appState.googleAuth, ...changes.googleAuth.newValue };
      updateGoogleStatusUI();
      updateSyncBadge();
    }
  });
}

function logoutGoogle() {
  appState.googleAuth.token = null;
  appState.googleAuth.email = null;
  persistState();
  updateGoogleStatusUI();
  updateSyncBadge();
  showStatus("Signed out from Google", false);
}

function updateGoogleStatusUI() {
  const display = document.getElementById("googleUserDisplay");
  const loginBtn = document.getElementById("btnGoogleLogin");
  const logoutBtn = document.getElementById("btnGoogleLogout");

  if (appState.googleAuth && appState.googleAuth.token) {
    display.textContent = `Connected: ${appState.googleAuth.email || "Active"}`;
    display.style.color = "var(--positive)";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
  } else {
    display.textContent = "Not connected (Offline Store)";
    display.style.color = "var(--text)";
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
  }
}

function exportDataJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `finance_backup_${getLocalDateStr()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function clearAllData() {
  if (!confirm("Are you sure you want to completely reset all data to a fresh account?\n\nThis will wipe all transactions, debts, stashes, audit logs, and reset your streak to Day 1.")) {
    return;
  }

  const savedAuth = { ...(appState.googleAuth || {}) };

  appState.transactions = [];
  appState.debts = [];
  appState.presets = [...DEFAULT_PRESETS];
  appState.stashes = [];
  appState.stashMasked = false;
  appState.dailyRollover = false;
  appState.installDate = getLocalDateStr();
  appState.auditLog = [];
  appState.syncQueue = [];
  appState.googleAuth = savedAuth;

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.clear(() => {
      persistState();
    });
  } else if (typeof localStorage !== "undefined") {
    localStorage.clear();
    persistState();
  } else {
    persistState();
  }

  renderUI();
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) settingsModal.style.display = "none";
  showStatus("All data cleared: fresh account ready", false);
}

