// Edit modal and audit presentation controller.
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

