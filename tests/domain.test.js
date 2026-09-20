const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadDomain(path) {
  const context = { console, Date, Math, Object, String, Number, isFinite, isNaN };
  vm.runInNewContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return context.FinanceDomain;
}

for (const path of ["shared/domain.js", "docs/shared/domain.js", "extension/shared/domain.js"]) {
  const domain = loadDomain(path);
  assert.equal(domain.parseAmount("₱1,234.50"), 1234.5);

  const projection = domain.calculateLedger(
    [
      { date: "2026-09-24", type: "Allowance", amount: 200 },
      { date: "2026-09-24", type: "Expense", amount: 45 }
    ],
    [{ direction: "I Owe", amount: 80, paid: 20, status: "Active" }],
    false,
    new Date("2026-09-24T12:00:00")
  );
  assert.equal(projection.todayRemaining, 155);
  assert.equal(projection.projectedTodayIfPayDebts, 95);

  const settlement = domain.settleDebt(
    { amount: 80, paid: 20, status: "Active" },
    100
  );
  assert.equal(settlement.actualPayment, 60);
  assert.equal(settlement.paid, 80);
  assert.equal(settlement.status, "Settled");
  assert.equal(domain.settleDebt({ amount: 80, paid: 20, status: "Active" }, -5).actualPayment, 0);

  const entry = { id: "stash-1", amount: 50, note: "Reserve", timestamp: "fixed" };
  const stashes = domain.stashDeposit([], entry);
  assert.equal(stashes[0].id, entry.id);
  assert.equal(stashes[0].amount, entry.amount);
  assert.equal(stashes[0].note, entry.note);
  assert.equal(stashes[0].timestamp, entry.timestamp);
  assert.equal(stashes[0].status, "Active");
  assert.notEqual(stashes, []);
  assert.equal(domain.unstash(stashes, "stash-1").item.id, "stash-1");
  assert.equal(domain.enqueue([], { op: "ADD_TX" }, "fixed")[0].timestamp, "fixed");
  const recorded = domain.recordTransaction(
    [{ id: "older" }],
    [],
    { id: "newer", type: "Expense", amount: 25 },
    "fixed"
  );
  assert.equal(recorded.transactions[0].id, "newer");
  assert.equal(recorded.transactions[1].id, "older");
  assert.equal(recorded.syncQueue[0].op, "ADD_TX");
  assert.equal(recorded.syncQueue[0].data.id, "newer");
  assert.equal(recorded.syncQueue[0].timestamp, "fixed");
  const edited = domain.editTransaction(recorded.transactions, recorded.syncQueue, "newer", { amount: 30 }, "edited-time");
  assert.equal(edited.old.amount, 25);
  assert.equal(edited.updated.amount, 30);
  assert.equal(edited.updated.edited, true);
  assert.equal(edited.updated.edited_at, "edited-time");
  assert.equal(edited.syncQueue.at(-1).op, "EDIT_TX");
  const deleted = domain.deleteTransaction(edited.transactions, edited.syncQueue, "newer", "deleted-time");
  assert.equal(deleted.found.id, "newer");
  assert.equal(deleted.transactions.some(transaction => transaction.id === "newer"), false);
  assert.equal(deleted.syncQueue.at(-1).op, "DEL_TX");
  const debt = { id: "debt-1", person: "Alex", direction: "I Owe", amount: 100, paid: 0, status: "Active" };
  const addedDebt = domain.addDebt([], [], debt, "debt-time");
  assert.equal(addedDebt.debts[0].id, "debt-1");
  assert.equal(addedDebt.syncQueue[0].op, "ADD_DEBT");
  const settledDebt = domain.settleDebtState(
    addedDebt.debts,
    [],
    addedDebt.syncQueue,
    "debt-1",
    40,
    true,
    { id: "tx-debt", relatedDebtId: "debt-1", amount: 40 },
    "settle-time"
  );
  assert.equal(settledDebt.debt.paid, 40);
  assert.equal(settledDebt.transactions[0].id, "tx-debt");
  assert.equal(settledDebt.syncQueue.at(-2).op, "ADD_TX");
  assert.equal(settledDebt.syncQueue.at(-1).op, "SETTLE_DEBT");
  const removedDebt = domain.deleteDebt(
    settledDebt.debts,
    settledDebt.transactions,
    settledDebt.syncQueue,
    "debt-1",
    true,
    "delete-time"
  );
  assert.equal(removedDebt.found.id, "debt-1");
  assert.equal(removedDebt.transactions.length, 0);
  assert.equal(removedDebt.syncQueue.at(-2).op, "DEL_DEBT");
  assert.equal(removedDebt.syncQueue.at(-1).op, "DEL_TX");
}

console.log("Domain tests passed.");
