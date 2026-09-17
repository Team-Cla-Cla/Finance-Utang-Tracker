// background.js - Background OAuth & Sync Dispatcher

if (typeof importScripts === "function") {
  try {
    importScripts("google_sync.js");
  } catch (e) {
    console.error("Failed to importScripts in background worker:", e);
  }
}

// Listen for messages from popup or alarms
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOGIN_GOOGLE") {
    handleBackgroundLogin(message.clientId, sendResponse);
    return true; // Indicates async response
  }

  if (message.type === "BACKGROUND_SYNC") {
    handleBackgroundSync(sendResponse);
    return true; // Indicates async response
  }
});

async function handleBackgroundLogin(clientId, sendResponse) {
  try {
    const token = await GoogleSync.authenticate(clientId, true);
    const email = await GoogleSync.getUserEmail(token);

    // Save auth state persistently in storage.local
    chrome.storage.local.get(["googleAuth"], (res) => {
      const gAuth = res.googleAuth || {};
      gAuth.token = token;
      gAuth.email = email;
      if (clientId) gAuth.clientId = clientId;

      chrome.storage.local.set({ googleAuth: gAuth }, () => {
        sendResponse({ success: true, token, email });
      });
    });
  } catch (err) {
    console.error("Background login error:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleBackgroundSync(sendResponse) {
  chrome.storage.local.get(["googleAuth", "syncQueue"], async (res) => {
    const gAuth = res.googleAuth || {};
    const queue = res.syncQueue || [];

    if (!gAuth.token || queue.length === 0) {
      if (sendResponse) sendResponse({ synced: 0, remaining: queue });
      return;
    }

    try {
      const sheetId = await GoogleSync.getOrCreateSpreadsheet(gAuth.token, gAuth.spreadsheetId);
      if (sheetId && sheetId !== gAuth.spreadsheetId) {
        gAuth.spreadsheetId = sheetId;
        chrome.storage.local.set({ googleAuth: gAuth });
      }

      const result = await GoogleSync.flushSyncQueue(gAuth.token, sheetId, queue);
      chrome.storage.local.set({ syncQueue: result.remaining || [] });
      if (sendResponse) sendResponse(result);
    } catch (err) {
      console.error("Background sync error:", err);
      if (err.message && err.message.includes("401") && gAuth.clientId) {
        try {
          const newToken = await GoogleSync.authenticate(gAuth.clientId, false);
          if (newToken) {
            gAuth.token = newToken;
            chrome.storage.local.set({ googleAuth: gAuth });
            const retryRes = await GoogleSync.flushSyncQueue(newToken, gAuth.spreadsheetId, queue);
            chrome.storage.local.set({ syncQueue: retryRes.remaining || [] });
            if (sendResponse) sendResponse(retryRes);
            return;
          }
        } catch (silentErr) {
          console.warn("Silent reauth failed in background:", silentErr);
        }
      }
      if (sendResponse) sendResponse({ error: err.message });
    }
  });
}
