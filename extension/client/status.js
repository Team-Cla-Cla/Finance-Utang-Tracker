// Shared status and synchronization badge presentation.
// --- Status & Sync Badges ---
let statusTimer = null;
function showStatus(text, isError) {
  const el = document.getElementById("statusMsg");
  el.textContent = text;
  el.className = "status-msg mono " + (isError ? "error" : "success");
  el.style.visibility = "visible";
  el.style.display = "block";
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = "";
    el.className = "status-msg mono";
    el.style.visibility = "hidden";
  }, 3500);
}

function updateSyncBadge() {
  const badge = document.getElementById("syncBadge");
  const queueLabel = document.getElementById("queueCountLabel");
  const queueLen = appState.syncQueue ? appState.syncQueue.length : 0;
  if (queueLabel) queueLabel.textContent = `Pending sync: ${queueLen}`;

  if (isSyncing) {
    badge.textContent = "Syncing...";
    badge.className = "sync-badge syncing mono";
    return;
  }

  if (appState.googleAuth && appState.googleAuth.token) {
    if (queueLen > 0) {
      badge.textContent = `Unsynced (${queueLen})`;
      badge.className = "sync-badge pending mono";
    } else {
      badge.textContent = "Synced";
      badge.className = "sync-badge synced mono";
    }
  } else {
    badge.textContent = "Local Only";
    badge.className = "sync-badge mono";
  }
}

