// Pure finance domain/application services shared by the web app and extension.
(function (root) {
  "use strict";

  function parseAmount(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") {
      return isFinite(value) && !isNaN(value) ? Math.round(value * 100) / 100 : 0;
    }
    var text = String(value).trim().replace(/[^0-9.-]/g, "");
    if (!text || text === "-" || text === ".") return 0;
    var amount = parseFloat(text);
    return isFinite(amount) && !isNaN(amount) ? Math.round(amount * 100) / 100 : 0;
  }

  function getLocalDateStr(date) {
    var value = date || new Date();
    return value.getFullYear() + "-" +
      String(value.getMonth() + 1).padStart(2, "0") + "-" +
      String(value.getDate()).padStart(2, "0");
  }

  function calculateLedger(transactions, debts, dailyRollover, now) {
    var current = now || new Date();
    var today = getLocalDateStr(current);
    var monday = new Date(current);
    var day = monday.getDay();
    monday.setDate(monday.getDate() + ((day === 0 ? -6 : 1) - day));
    monday.setHours(0, 0, 0, 0);
    var todayAllowance = 0, todaySpent = 0, weekAllowance = 0, weekSpent = 0;
    var hasAllowanceToday = false;
    (transactions || []).forEach(function (tx) {
      var amount = parseAmount(tx.amount);
      var isAllowance = String(tx.type || "").toLowerCase() === "allowance";
      var txTime = new Date((tx.date || "").indexOf("T") !== -1 ?
        tx.date : (tx.timestamp || (tx.date + "T00:00:00")));
      if (tx.date === today) {
        if (isAllowance) { todayAllowance += amount; hasAllowanceToday = true; }
        else todaySpent += amount;
      }
      if (txTime >= monday) {
        if (isAllowance) weekAllowance += amount;
        else weekSpent += amount;
      }
    });
    var totalIOwe = 0, totalOwedToMe = 0;
    (debts || []).forEach(function (debt) {
      if (String(debt.status || "").toLowerCase() !== "active") return;
      var remaining = Math.max(0, parseAmount(debt.amount) - parseAmount(debt.paid));
      if (String(debt.direction || "").toLowerCase().indexOf("i owe") !== -1) totalIOwe += remaining;
      else totalOwedToMe += remaining;
    });
    var rollover = 0;
    if (dailyRollover) {
      var pastAllowance = 0, pastSpent = 0;
      (transactions || []).forEach(function (tx) {
        if (tx.date < today) {
          if (String(tx.type || "").toLowerCase() === "allowance") pastAllowance += parseAmount(tx.amount);
          else pastSpent += parseAmount(tx.amount);
        }
      });
      rollover = Math.max(0, Math.round((pastAllowance - pastSpent) * 100) / 100);
    }
    var todayRemaining = Math.round((todayAllowance + rollover - todaySpent) * 100) / 100;
    var weekSavings = Math.round((weekAllowance - weekSpent) * 100) / 100;
    return {
      todayRemaining: todayRemaining, todayAllowance: todayAllowance, todaySpent: todaySpent,
      rolloverAmt: rollover, weekSavings: weekSavings, hasAllowanceToday: hasAllowanceToday,
      totalIOwe: totalIOwe, totalOwedToMe: totalOwedToMe,
      projectedTodayIfPayDebts: todayRemaining - totalIOwe,
      projectedWeekIfPayDebts: weekSavings - totalIOwe
    };
  }

  function settleDebt(debt, payment) {
    var amount = parseAmount(debt && debt.amount);
    var paid = parseAmount(debt && debt.paid);
    var remaining = Math.max(0, amount - paid);
    var actual = Math.min(Math.max(0, parseAmount(payment)), remaining);
    return {
      actualPayment: actual,
      paid: paid + actual,
      status: paid + actual >= amount ? "Settled" : (debt.status || "Active")
    };
  }

  function stashDeposit(stashes, entry) {
    var stash = Object.assign({}, entry || {});
    stash.amount = parseAmount(stash.amount);
    stash.note = stash.note || "Reserve";
    stash.date = stash.date || getLocalDateStr();
    stash.timestamp = stash.timestamp || new Date().toISOString();
    stash.status = stash.status || "Active";
    return [stash].concat(stashes || []);
  }

  function unstash(stashes, id) {
    var list = stashes || [], index = list.findIndex(function (item) { return item.id === id; });
    if (index < 0) return { stashes: list, item: null };
    return { stashes: list.slice(0, index).concat(list.slice(index + 1)), item: list[index] };
  }

  function enqueue(queue, item, timestamp) {
    var next = (queue || []).slice();
    var mutation = Object.assign({}, item);
    if (!mutation.timestamp) mutation.timestamp = timestamp || new Date().toISOString();
    next.push(mutation);
    return next;
  }

  function recordTransaction(transactions, queue, transaction, timestamp) {
    return {
      transactions: [transaction].concat(transactions || []),
      syncQueue: enqueue(queue, { op: "ADD_TX", data: transaction }, timestamp)
    };
  }

  function editTransaction(transactions, queue, id, updatedFields, timestamp) {
    var list = transactions || [];
    var index = list.findIndex(function (transaction) { return transaction.id === id; });
    if (index < 0) return { transactions: list, syncQueue: queue || [], old: null, updated: null };
    var old = Object.assign({}, list[index]);
    var updated = Object.assign({}, list[index], updatedFields || {}, {
      edited: true,
      edited_at: timestamp || new Date().toISOString()
    });
    var next = list.slice();
    next[index] = updated;
    return {
      transactions: next,
      syncQueue: enqueue(queue, { op: "EDIT_TX", data: updated }, timestamp),
      old: old,
      updated: updated
    };
  }

  function deleteTransaction(transactions, queue, id, timestamp) {
    var list = transactions || [];
    var found = list.find(function (transaction) { return transaction.id === id; }) || null;
    return {
      transactions: list.filter(function (transaction) { return transaction.id !== id; }),
      syncQueue: enqueue(queue, { op: "DEL_TX", data: { id: id } }, timestamp),
      found: found
    };
  }

  function addDebt(debts, queue, debt, timestamp) {
    return {
      debts: [debt].concat(debts || []),
      syncQueue: enqueue(queue, { op: "ADD_DEBT", data: debt }, timestamp)
    };
  }

  function settleDebtState(debts, transactions, queue, id, payment, affectCash, transaction, timestamp) {
    var list = debts || [];
    var index = list.findIndex(function (debt) { return String(debt.id) === String(id); });
    if (index < 0) return { debt: null, actualPayment: 0, debts: list, transactions: transactions || [], syncQueue: queue || [] };
    var current = list[index];
    var settlement = settleDebt(current, payment);
    var updatedDebt = Object.assign({}, current, { paid: settlement.paid, status: settlement.status });
    var nextDebts = list.slice();
    nextDebts[index] = updatedDebt;
    var nextTransactions = transactions || [];
    var nextQueue = queue || [];
    if (affectCash && transaction) {
      nextTransactions = [transaction].concat(nextTransactions);
      nextQueue = enqueue(nextQueue, { op: "ADD_TX", data: transaction }, timestamp);
    }
    nextQueue = enqueue(nextQueue, { op: "SETTLE_DEBT", data: { id: updatedDebt.id, payAmt: settlement.actualPayment, newPaid: updatedDebt.paid, status: updatedDebt.status } }, timestamp);
    return { debt: updatedDebt, actualPayment: settlement.actualPayment, debts: nextDebts, transactions: nextTransactions, syncQueue: nextQueue };
  }

  function deleteDebt(debts, transactions, queue, id, deleteLinkedTransaction, timestamp) {
    var found = (debts || []).find(function (debt) { return debt.id === id; }) || null;
    var linked = (transactions || []).find(function (transaction) { return transaction.relatedDebtId === id; }) || null;
    var nextQueue = enqueue(queue, { op: "DEL_DEBT", data: { id: id } }, timestamp);
    var nextTransactions = transactions || [];
    if (deleteLinkedTransaction && linked) {
      nextTransactions = nextTransactions.filter(function (transaction) { return transaction.id !== linked.id; });
      nextQueue = enqueue(nextQueue, { op: "DEL_TX", data: { id: linked.id } }, timestamp);
    }
    return { found: found, linkedTransaction: linked, debts: (debts || []).filter(function (debt) { return debt.id !== id; }), transactions: nextTransactions, syncQueue: nextQueue };
  }

  root.FinanceDomain = {
    parseAmount: parseAmount,
    getLocalDateStr: getLocalDateStr,
    calculateLedger: calculateLedger,
    settleDebt: settleDebt,
    stashDeposit: stashDeposit,
    unstash: unstash,
    enqueue: enqueue,
    recordTransaction: recordTransaction,
    editTransaction: editTransaction,
    deleteTransaction: deleteTransaction,
    addDebt: addDebt,
    settleDebtState: settleDebtState,
    deleteDebt: deleteDebt
  };
}(typeof window !== "undefined" ? window : this));
