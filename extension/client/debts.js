// Debt feature presentation controller.
function addDebt(debt) {
  const result = FinanceApplication.addDebt(appState.debts, appState.syncQueue, debt);
  appState.debts = result.debts;
  appState.syncQueue = result.syncQueue;
  persistState();
  renderUI();
  triggerAutoSync();
}

function settleDebt(id, payAmt, affectCash = true) {
  let d = appState.debts.find(item => String(item.id) === String(id));
  if (!d && currentSettleDebt && String(currentSettleDebt.id) === String(id)) {
    d = currentSettleDebt;
  }
  if (!d) {
    showStatus("Debt record not found", true);
    return;
  }

  const currentPaid = Number(d.paid || 0);
  const totalAmt = Number(d.amount || 0);
  const remaining = Math.max(0, totalAmt - currentPaid);
  if (remaining <= 0) {
    showStatus("Debt is already fully settled", true);
    return;
  }
  if (isNaN(payAmt) || payAmt <= 0) {
    showStatus("Payment amount must be greater than 0", true);
    return;
  }

  const isIOwe = (d.direction || "").toLowerCase().indexOf("i owe") !== -1;
  const actualPay = FinanceDomain.settleDebt(d, payAmt).actualPayment;
  const transaction = affectCash ? {
    id: "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    date: getLocalDateStr(),
    timestamp: new Date().toISOString(),
    type: isIOwe ? "Expense" : "Allowance",
    category: isIOwe ? "Debt Repayment" : "Debt Collection",
    amount: actualPay,
    notes: isIOwe ? `Paid debt to ${d.person}` : `Collected debt from ${d.person}`,
    relatedDebtId: d.id
  } : null;
  const result = FinanceApplication.settleDebtState(appState.debts, appState.transactions, appState.syncQueue, d.id, payAmt, affectCash, transaction);
  const newPaid = result.debt.paid;
  appState.debts = result.debts;
  appState.transactions = result.transactions;
  appState.syncQueue = result.syncQueue;
  logAudit({
    action: "SETTLE_DEBT",
    targetId: d.id,
    summary: `Settled ${actualPay.toFixed(2)} for ${d.person} (${d.direction})${affectCash ? ' [cash-linked]' : ''}`
  });

  persistState();
  renderUI();
  showStatus(`${isIOwe ? 'Payment' : 'Collection'} recorded: ${actualPay.toFixed(2)}`, false);
  triggerAutoSync();
}

function delUtang(id) {
  if (!confirm("Delete debt record?")) return;
  const foundDebt = appState.debts.find(d => d.id === id);
  if (foundDebt) {
    logAudit({
      action: "DELETE_DEBT",
      targetId: id,
      summary: `Deleted debt #${id.slice(-6)}: ${foundDebt.amount} (${foundDebt.person})`
    });
  }
  // If there was a linked cash transaction created with this debt, prompt to remove it too
  const linkedTx = appState.transactions.find(t => t.relatedDebtId === id);
  const removeLinked = linkedTx && confirm(`Also remove the linked wallet transaction (${linkedTx.type} ${linkedTx.amount.toFixed(2)})?`);
  const result = FinanceApplication.deleteDebt(appState.debts, appState.transactions, appState.syncQueue, id, !!removeLinked);
  appState.debts = result.debts;
  appState.transactions = result.transactions;
  appState.syncQueue = result.syncQueue;
  if (removeLinked && linkedTx) {
    logAudit({
      action: "DELETE_TX",
      targetId: linkedTx.id,
      summary: `Removed linked cash transaction for debt #${id.slice(-6)}`
    });
  }

  persistState();
  renderUI();
  showStatus("Debt deleted", false);
  triggerAutoSync();
}

// --- Settle Modal ---
function openSettle(d) {
  currentSettleDebt = d;
  const isIOwe = (d.direction || "").toLowerCase().indexOf("i owe") !== -1;
  document.getElementById("sId").value = d.id;
  document.getElementById("sTitle").textContent = isIOwe ? ("Pay Debt: " + d.person) : ("Collect Payment: " + d.person);

  const orig = Number(d.amount || 0).toFixed(2);
  const paid = Number(d.paid || 0).toFixed(2);
  const rem = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0)).toFixed(2);

  document.getElementById("sMeta").innerHTML = `Original: <b class="mono">${orig}</b> · Paid: <b class="mono">${paid}</b> · Remaining: <b class="mono" style="color:var(--text)">${rem}</b>`;
  document.getElementById("sAmt").value = rem;
  document.getElementById("sImpact").textContent = isIOwe
    ? "Payment can be recorded as an expense from your cash balance."
    : "Collection can be added to your pocket allowance.";

  const sAffect = document.getElementById("sAffectCash");
  const sText = document.getElementById("sAffectCashText");
  if (sAffect) sAffect.checked = true;
  if (sText) {
    sText.textContent = isIOwe
      ? "Deduct payment from cash balance"
      : "Add collection to cash balance";
  }

  document.getElementById("sSubmitBtn").textContent = isIOwe ? "Record Payment" : "Record Collection";
  document.getElementById("settleModal").style.display = "flex";
  const sAmtInput = document.getElementById("sAmt");
  sAmtInput.focus();
  sAmtInput.select();
}

function closeSettle() {
  document.getElementById("settleModal").style.display = "none";
  currentSettleDebt = null;
}

function submitSettle(e) {
  if (e && e.preventDefault) e.preventDefault();
  const id = document.getElementById("sId").value;
  const amt = parseAmount(document.getElementById("sAmt").value);
  const affectCash = document.getElementById("sAffectCash") ? document.getElementById("sAffectCash").checked : true;
  if (amt <= 0) {
    showStatus("Payment amount must be greater than 0", true);
    return;
  }
  closeSettle();
  settleDebt(id, amt, affectCash);
}

