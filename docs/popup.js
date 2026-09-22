// --- Edit Entry Modal ---
function openEdit(tx) {
  document.getElementById("eId").value = tx.id;
  document.getElementById("eDate").value = tx.date;
  document.getElementById("eType").value = tx.type;
  document.getElementById("eCat").value = tx.category;
  document.getElementById("eAmt").value = tx.amount;
  document.getElementById("eNote").value = tx.notes || "";
  document.getElementById("editModal").style.display = "flex";
}

function closeEdit() {
  document.getElementById("editModal").style.display = "none";
}

function submitEdit(e) {
  e.preventDefault();
  const id = document.getElementById("eId").value;
  const amt = parseAmount(document.getElementById("eAmt").value);
  if (amt <= 0) {
    showStatus("Amount must be greater than 0", true);
    return;
  }

  editTransaction(id, {
    date: document.getElementById("eDate").value,
    type: document.getElementById("eType").value,
    category: document.getElementById("eCat").value,
    amount: amt,
    notes: document.getElementById("eNote").value.trim()
  });

  closeEdit();
  showStatus("Updated " + amt.toFixed(2), false);
}

// --- Audit Trail Logging ---
function logAudit(event) {
  if (!appState.auditLog) appState.auditLog = [];
  const entry = {
    id: "aud_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    date: getLocalDateStr(),
    action: event.action || "EVENT",
    targetId: event.targetId || "",
    summary: event.summary || "",
    details: event.details || null
  };
  appState.auditLog.unshift(entry);
  if (appState.auditLog.length > 100) appState.auditLog.pop();

  queueSyncItem({ op: "AUDIT_LOG", data: entry });
  persistState();
}

// --- Startup ---
document.addEventListener("DOMContentLoaded", () => {
  const today = getLocalDateStr();
  const fDate = document.getElementById("fDate");
  const uDate = document.getElementById("uDate");
  const dateLabel = document.getElementById("dateLabel");

  if (fDate) fDate.value = today;
  if (uDate) uDate.value = today;

  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (dateLabel) dateLabel.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;

  wakeBackgroundLoop();
  updatePrecisionChrono();
  renderCalendarView();
  setupEventListeners();
  loadLocalState(() => {
    applyFontSizePreference();
    renderUI();

    // Check if returning from Google OAuth in standalone web / mobile mode
    if (typeof window !== "undefined" && window.location && window.location.hash) {
      const hash = window.location.hash;
      const match = hash.match(/[#&]access_token=([^&]+)/);
      if (match && match[1]) {
        const token = match[1];
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        GoogleSync.getUserEmail(token).then(async (email) => {
          appState.googleAuth.token = token;
          appState.googleAuth.email = email;
          persistState();
          updateGoogleStatusUI();
          showStatus(`Connected as ${email}`, false);

          let sheetId = appState.googleAuth.spreadsheetId;
          try {
            if (!sheetId) {
              sheetId = await GoogleSync.getOrCreateSpreadsheet(token);
              if (sheetId) {
                appState.googleAuth.spreadsheetId = sheetId;
                persistState();
              }
            }
            await hydrateFromCloud(token, sheetId);
            renderUI();
            showStatus("Synchronized with Google Sheets", false);
          } catch (e) {
            console.warn("Post-redirect hydration note:", e);
          }
          await triggerAutoSync();
        }).catch((err) => {
          console.error("Failed to fetch user email:", err);
          showStatus("Google Login Error: " + err.message, true);
        });
      }
    } else if (navigator.onLine && appState.googleAuth && appState.googleAuth.token) {
      triggerAutoSync();
    }
  });
});
