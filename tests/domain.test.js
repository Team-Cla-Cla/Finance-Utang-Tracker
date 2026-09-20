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
}

console.log("Domain tests passed.");
