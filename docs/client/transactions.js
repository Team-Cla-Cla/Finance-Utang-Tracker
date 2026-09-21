// Transaction presentation controller.
// --- Mutation Handlers (Local-First Instant Execution) ---
function queueSyncItem(item) {
  appState.syncQueue = FinanceApplication.enqueue(appState.syncQueue, item);
}

function addTransaction(tx) {
  const result = FinanceApplication.recordTransaction(appState.transactions, appState.syncQueue, tx);
  appState.transactions = result.transactions;
  appState.syncQueue = result.syncQueue;
  persistState();
  renderUI();
  triggerAutoSync();
}

function editTransaction(id, updatedFields) {
  const result = FinanceApplication.editTransaction(appState.transactions, appState.syncQueue, id, updatedFields);
  if (result.updated) {
    appState.transactions = result.transactions;
    appState.syncQueue = result.syncQueue;
    logAudit({
      action: "EDIT_TX",
      targetId: id,
      summary: `Edited entry #${id.slice(-6)}: ${result.old.amount} -> ${updatedFields.amount !== undefined ? updatedFields.amount : result.old.amount} (${updatedFields.category || result.old.category})`
    });
    persistState();
    renderUI();
    triggerAutoSync();
  }
}

function delTx(id) {
  if (!confirm("Delete entry?")) return;
  const result = FinanceApplication.deleteTransaction(appState.transactions, appState.syncQueue, id);
  appState.transactions = result.transactions;
  appState.syncQueue = result.syncQueue;
  if (result.found) {
    logAudit({
      action: "DELETE_TX",
      targetId: id,
      summary: `Deleted ${result.found.type} #${id.slice(-6)} (${result.found.amount} ${result.found.category})`
    });
  }
  persistState();
  renderUI();
  showStatus("Deleted", false);
  triggerAutoSync();
}

// --- Forms Submission ---
function submitEntry(e) {
  e.preventDefault();
  const amt = parseAmount(document.getElementById("fAmt").value);
  if (amt <= 0) {
    showStatus("Please enter an amount greater than 0", true);
    return;
  }

  const tx = {
    id: "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    amount: amt,
    category: document.getElementById("fCat").value,
    notes: document.getElementById("fNote").value.trim(),
    type: document.getElementById("fType").value,
    date: document.getElementById("fDate").value || getLocalDateStr(),
    timestamp: new Date().toISOString()
  };

  addTransaction(tx);
  document.getElementById("fAmt").value = "";
  document.getElementById("fNote").value = "";
  showStatus("Saved " + amt.toFixed(2), false);
}

