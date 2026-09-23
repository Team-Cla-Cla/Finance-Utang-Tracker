// Utang form submission and impact label presentation controller.

function updateUtangAffectCashLabel() {
  const dirEl = document.getElementById("uDirection");
  const textEl = document.getElementById("uAffectCashText");
  if (!dirEl || !textEl) return;
  const isIOwe = (dirEl.value || "").toLowerCase().indexOf("i owe") !== -1;
  textEl.textContent = isIOwe
    ? "Add to cash balance (borrowed into wallet)"
    : "Deduct from cash balance (lent from wallet)";
}

function submitUtang(e) {
  e.preventDefault();
  const person = document.getElementById("uPerson").value.trim();
  if (!person) {
    showStatus("Please enter debtor or creditor name", true);
    return;
  }
  const amt = parseAmount(document.getElementById("uAmt").value);
  if (amt <= 0) {
    showStatus("Amount must be greater than 0", true);
    return;
  }

  const direction = document.getElementById("uDirection").value;
  const dateStr = document.getElementById("uDate").value || getLocalDateStr();
  const noteStr = document.getElementById("uNote").value.trim();
  const affectCash = document.getElementById("uAffectCash") ? document.getElementById("uAffectCash").checked : false;

  const debtId = "ut_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const debt = {
    id: debtId,
    person: person,
    direction: direction,
    amount: amt,
    paid: 0,
    status: "Active",
    date: dateStr,
    notes: noteStr,
    timestamp: new Date().toISOString()
  };

  const isIOwe = (direction || "").toLowerCase().indexOf("i owe") !== -1;
  if (affectCash) {
    const tx = {
      id: "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      date: dateStr,
      timestamp: new Date().toISOString(),
      type: isIOwe ? "Allowance" : "Expense",
      category: isIOwe ? "Debt Received" : "Pautang",
      amount: amt,
      notes: isIOwe ? `Borrowed from ${person}${noteStr ? ' (' + noteStr + ')' : ''}` : `Lent to ${person}${noteStr ? ' (' + noteStr + ')' : ''}`,
      relatedDebtId: debtId
    };
    appState.transactions.unshift(tx);
    queueSyncItem({ op: "ADD_TX", data: tx });
    logAudit({
      action: "LINKED_DEBT_TX",
      targetId: debtId,
      summary: `${isIOwe ? 'Added' : 'Deducted'} ${amt.toFixed(2)} ${isIOwe ? 'to' : 'from'} cash (${direction}: ${person})`
    });
  }

  logAudit({
    action: "ADD_UTANG",
    targetId: debtId,
    summary: `Recorded ${isIOwe ? 'utang (I owe)' : 'pautang (owes me)'}: ${amt.toFixed(2)} (${person})`
  });

  addDebt(debt);

  document.getElementById("uPerson").value = "";
  document.getElementById("uAmt").value = "";
  document.getElementById("uNote").value = "";
  if (document.getElementById("uAffectCash")) {
    document.getElementById("uAffectCash").checked = false;
  }
  setMode("Expense");

  let statusMsg = "Recorded utang";
  if (affectCash) {
    statusMsg = isIOwe
      ? `Recorded utang (+${amt.toFixed(2)} to cash)`
      : `Recorded pautang (-${amt.toFixed(2)} from cash)`;
  }
  showStatus(statusMsg, false);
}
