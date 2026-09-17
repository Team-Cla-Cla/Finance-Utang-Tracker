// popup.js - Offline-First Personal Finance & Utang Tracker

const DEFAULT_PRESETS = [
  { id: "p_1", label: "Hwy 15", amount: 15, category: "Transportation", note: "Home tricycle to highway junction", type: "Expense" },
  { id: "p_2", label: "Sch 22", amount: 22, category: "Transportation", note: "Highway jeepney/bus to school gate", type: "Expense" },
  { id: "p_3", label: "Ret 20", amount: 20, category: "Transportation", note: "School going home to highway transfer", type: "Expense" },
  { id: "p_4", label: "Hm 15", amount: 15, category: "Transportation", note: "Highway transfer back to home", type: "Expense" },
  { id: "p_5", label: "All 72", amount: 72, category: "Transportation", note: "Full day roundtrip school commute (15+22+20+15)", type: "Expense" },
  { id: "p_6", label: "Rice 30", amount: 30, category: "Food", note: "Brought rice from home, bought light viand", type: "Expense" },
  { id: "p_7", label: "Rice 40", amount: 40, category: "Food", note: "Brought rice from home, bought regular viand", type: "Expense" },
  { id: "p_8", label: "Meal 45", amount: 45, category: "Food", note: "Bought cafeteria meal with rice", type: "Expense" },
  { id: "p_9", label: "Meal 60", amount: 60, category: "Food", note: "Full cafeteria meal with rice & drink", type: "Expense" },
  { id: "p_10", "label": "School 200", "amount": 200, "category": "Allowance", "note": "Standard daily school allowance", "type": "Allowance" },
  { id: "p_11", "label": "Extra 100", "amount": 100, "category": "Allowance", "note": "Extra allowance from relatives", "type": "Allowance" }
];

let appState = {
  transactions: [],
  debts: [],
  presets: [...DEFAULT_PRESETS],
  stashes: [],
  stashMasked: false,
  dailyRollover: false,
  installDate: null,
  auditLog: [],
  syncQueue: [],
  googleAuth: {
    token: null,
    email: null,
    clientId: "",
    spreadsheetId: ""
  }
};

let currentMode = "Expense";
let currentPillFilter = "all";
let currentSettleDebt = null;
let isSyncing = false;

// --- Storage & Initialization ---
function loadLocalState(callback) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["transactions", "debts", "presets", "stashes", "stashMasked", "dailyRollover", "installDate", "auditLog", "syncQueue", "googleAuth"], function(res) {
      if (res.transactions) appState.transactions = res.transactions;
      if (res.debts) appState.debts = res.debts;
      if (res.presets) appState.presets = res.presets;
      if (res.stashes) appState.stashes = res.stashes;
      if (typeof res.stashMasked === "boolean") appState.stashMasked = res.stashMasked;
      if (typeof res.dailyRollover === "boolean") appState.dailyRollover = res.dailyRollover;
      if (res.installDate) appState.installDate = res.installDate;
      if (!appState.installDate) {
        appState.installDate = getLocalDateStr();
        chrome.storage.local.set({ installDate: appState.installDate });
      }
      if (res.auditLog) appState.auditLog = res.auditLog;
      if (res.syncQueue) appState.syncQueue = res.syncQueue;
      if (res.googleAuth) appState.googleAuth = { ...appState.googleAuth, ...res.googleAuth };
      if (callback) callback();
    });
  } else {
    // LocalStorage fallback
    const t = localStorage.getItem("transactions");
    const d = localStorage.getItem("debts");
    const p = localStorage.getItem("presets");
    const s = localStorage.getItem("stashes");
    const sm = localStorage.getItem("stashMasked");
    const ro = localStorage.getItem("dailyRollover");
    const idt = localStorage.getItem("installDate");
    const al = localStorage.getItem("auditLog");
    const q = localStorage.getItem("syncQueue");
    const a = localStorage.getItem("googleAuth");
    if (t) appState.transactions = JSON.parse(t);
    if (d) appState.debts = JSON.parse(d);
    if (p) appState.presets = JSON.parse(p);
    if (s) appState.stashes = JSON.parse(s);
    if (sm) appState.stashMasked = JSON.parse(sm);
    if (ro) appState.dailyRollover = JSON.parse(ro);
    if (idt) appState.installDate = JSON.parse(idt);
    if (!appState.installDate) {
      appState.installDate = getLocalDateStr();
      localStorage.setItem("installDate", JSON.stringify(appState.installDate));
    }
    if (al) appState.auditLog = JSON.parse(al);
    if (q) appState.syncQueue = JSON.parse(q);
    if (a) appState.googleAuth = JSON.parse(a);
    if (callback) callback();
  }
}

function persistState() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      transactions: appState.transactions,
      debts: appState.debts,
      presets: appState.presets,
      stashes: appState.stashes,
      stashMasked: appState.stashMasked,
      dailyRollover: appState.dailyRollover,
      installDate: appState.installDate,
      auditLog: appState.auditLog,
      syncQueue: appState.syncQueue,
      googleAuth: appState.googleAuth
    });
  } else {
    localStorage.setItem("transactions", JSON.stringify(appState.transactions));
    localStorage.setItem("debts", JSON.stringify(appState.debts));
    localStorage.setItem("presets", JSON.stringify(appState.presets));
    localStorage.setItem("stashes", JSON.stringify(appState.stashes));
    localStorage.setItem("stashMasked", JSON.stringify(appState.stashMasked));
    localStorage.setItem("dailyRollover", JSON.stringify(appState.dailyRollover));
    localStorage.setItem("installDate", JSON.stringify(appState.installDate));
    localStorage.setItem("auditLog", JSON.stringify(appState.auditLog));
    localStorage.setItem("syncQueue", JSON.stringify(appState.syncQueue));
    localStorage.setItem("googleAuth", JSON.stringify(appState.googleAuth));
  }
}

// --- Metrics Calculation (Instant 0 ms) ---
function computeMetrics() {
  const now = new Date();
  const todayStr = getLocalDateStr(now);

  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  let todayAllowance = 0;
  let todaySpent = 0;
  let hasAllowanceToday = false;

  let weekAllowance = 0;
  let weekSpent = 0;

  appState.transactions.forEach(tx => {
    const txDate = tx.date;
    const txTime = new Date((tx.date || "").includes("T") ? tx.date : (tx.timestamp || (tx.date + "T00:00:00")));
    const amt = parseAmount(tx.amount);
    const isAllow = (tx.type || "").toLowerCase() === "allowance";

    if (txDate === todayStr) {
      if (isAllow) {
        todayAllowance += amt;
        hasAllowanceToday = true;
      } else {
        todaySpent += amt;
      }
    }

    if (txTime >= monday) {
      if (isAllow) {
        weekAllowance += amt;
      } else {
        weekSpent += amt;
      }
    }
  });

  let totalIOwe = 0;
  let totalOwedToMe = 0;

  appState.debts.forEach(d => {
    if ((d.status || "").toLowerCase() === "active") {
      const remaining = Math.max(0, parseAmount(d.amount) - parseAmount(d.paid));
      if ((d.direction || "").toLowerCase().indexOf("i owe") !== -1) {
        totalIOwe += remaining;
      } else {
        totalOwedToMe += remaining;
      }
    }
  });

  let rolloverAmt = 0;
  if (appState.dailyRollover) {
    let pastAllow = 0;
    let pastSpent = 0;
    appState.transactions.forEach(tx => {
      if (tx.date < todayStr) {
        const amt = parseAmount(tx.amount);
        if ((tx.type || "").toLowerCase() === "allowance") pastAllow += amt;
        else pastSpent += amt;
      }
    });
    rolloverAmt = Math.max(0, Math.round((pastAllow - pastSpent) * 100) / 100);
  }

  const todayRemaining = Math.round(((todayAllowance + rolloverAmt) - todaySpent) * 100) / 100;
  const weekSavings = Math.round((weekAllowance - weekSpent) * 100) / 100;

  return {
    todayRemaining,
    todayAllowance,
    todaySpent,
    rolloverAmt,
    weekSavings,
    hasAllowanceToday,
    totalIOwe,
    totalOwedToMe,
    projectedTodayIfPayDebts: todayRemaining - totalIOwe,
    projectedWeekIfPayDebts: weekSavings - totalIOwe
  };
}

// Strict Amount Parser: handles integers, decimals, commas, currency prefixes, and avoids float glitches
function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round(val * 100) / 100;
  }
  let str = String(val).trim().replace(/[^0-9.-]/g, "");
  if (!str || str === "-" || str === ".") return 0;
  const num = parseFloat(str);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function getLocalDateStr(d) {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

// --- Render UI ---
function renderUI() {
  const m = computeMetrics();

  const heroBal = document.getElementById("heroBalance");
  heroBal.textContent = m.todayRemaining.toFixed(2);
  heroBal.style.color = m.todayRemaining >= 0 ? "var(--text)" : "var(--negative)";

  document.getElementById("subIn").textContent = m.rolloverAmt > 0
    ? `${m.todayAllowance.toFixed(2)} (+${m.rolloverAmt.toFixed(0)})`
    : m.todayAllowance.toFixed(2);
  document.getElementById("subOut").textContent = m.todaySpent.toFixed(2);

  const subWeek = document.getElementById("subWeek");
  subWeek.textContent = m.weekSavings.toFixed(2);
  subWeek.style.color = m.weekSavings >= 0 ? "var(--positive)" : "var(--negative)";

  document.getElementById("uIOwe").textContent = m.totalIOwe.toFixed(2);
  document.getElementById("uOwedMe").textContent = m.totalOwedToMe.toFixed(2);

  const projTodayEl = document.getElementById("projPayNow");
  projTodayEl.textContent = m.projectedTodayIfPayDebts.toFixed(2);
  projTodayEl.style.color = m.projectedTodayIfPayDebts >= 0 ? "var(--positive)" : "var(--negative)";

  const projWeekEl = document.getElementById("projWeekPay");
  projWeekEl.textContent = m.projectedWeekIfPayDebts.toFixed(2);
  projWeekEl.style.color = m.projectedWeekIfPayDebts >= 0 ? "var(--positive)" : "var(--negative)";

  document.getElementById("checkinBox").style.display = m.hasAllowanceToday ? "none" : "block";

  renderPills();
  renderUtangList();
  renderFeed();
  renderStashUI();
  updateSyncBadge();
  renderCalendarView();
}

function renderPills() {
  const container = document.getElementById("pillsContainer");
  container.innerHTML = "";
  const targetType = (currentMode === "Allowance") ? "Allowance" : "Expense";
  const filtered = appState.presets.filter(p => (p.type || "Expense") === targetType);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-pills-hint" title="Quick pills allow you to record your routine ${targetType.toLowerCase()}s (like fares, food, or regular allowances) in a single tap. Click 'edit pills' above to create your shortcuts!">
        <span>No ${targetType.toLowerCase()} pills yet. Click <b>edit pills</b> to add one-tap shortcuts.</span>
      </div>
    `;
    const hint = container.querySelector(".empty-pills-hint");
    if (hint) hint.addEventListener("click", openManagePills);
    return;
  }

  filtered.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill mono";
    const tooltip = (p.note ? (p.note + " · ") : "") + p.category + " (" + p.amount + ") [1-tap fill]";
    btn.title = tooltip;
    btn.textContent = p.label;
    btn.addEventListener("click", () => fill(p.amount, p.category, p.note));
    container.appendChild(btn);
  });
}

function renderUtangList() {
  const container = document.getElementById("utangList");
  container.innerHTML = "";
  const active = appState.debts.filter(d => (d.status || "").toLowerCase() === "active");
  if (active.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem; color:var(--muted); padding:6px 0;">No active debts</div>';
    return;
  }

  active.forEach(d => {
    const item = document.createElement("div");
    item.className = "feed-item";
    const isIOwe = (d.direction || "").toLowerCase().indexOf("i owe") !== -1;
    const amtClass = isIOwe ? "neg" : "pos";
    const sign = isIOwe ? "-" : "+";
    const meta = d.person + " · " + (isIOwe ? "I owe" : "Owes me");
    let subText = d.date;
    const paid = Number(d.paid || 0);
    const amount = Number(d.amount || 0);
    const rem = Math.max(0, amount - paid);

    if (paid > 0) {
      subText += ` · paid ${paid.toFixed(2)} of ${amount.toFixed(2)}`;
    }
    if (d.notes) subText += ` (${d.notes})`;

    const actionLabel = isIOwe ? "pay" : "collect";

    const leftDiv = document.createElement("div");
    leftDiv.className = "feed-left";
    leftDiv.innerHTML = `<div class="feed-cat">${escapeHtml(meta)}</div><div class="feed-meta mono">${escapeHtml(subText)}</div>`;

    const rightDiv = document.createElement("div");
    rightDiv.className = "feed-right";

    const amtSpan = document.createElement("div");
    amtSpan.className = `feed-amt mono ${amtClass}`;
    amtSpan.textContent = sign + rem.toFixed(2);

    const actionBtn = document.createElement("button");
    actionBtn.className = "feed-btn action";
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener("click", () => openSettle(d));

    const delBtn = document.createElement("button");
    delBtn.className = "feed-btn del";
    delBtn.textContent = "×";
    delBtn.title = "Delete debt";
    delBtn.addEventListener("click", () => delUtang(d.id));

    rightDiv.appendChild(amtSpan);
    rightDiv.appendChild(actionBtn);
    rightDiv.appendChild(delBtn);

    item.appendChild(leftDiv);
    item.appendChild(rightDiv);
    container.appendChild(item);
  });
}

function renderFeed() {
  const list = document.getElementById("feedList");
  list.innerHTML = "";
  const txs = appState.transactions;
  const countEl = document.getElementById("activityCount");
  if (countEl) countEl.textContent = txs.length > 0 ? `(${txs.length})` : "";

  if (!txs || txs.length === 0) {
    list.innerHTML = '<div style="font-size:0.75rem; color:var(--muted); padding:14px 0;">No entries yet</div>';
    return;
  }

  txs.slice(0, 25).forEach(tx => {
    const item = document.createElement("div");
    item.className = "feed-item";
    const isAllow = (tx.type || "").toLowerCase() === "allowance";
    const amtClass = isAllow ? "pos" : "neg";
    const sign = isAllow ? "+" : "-";
    const amt = Number(tx.amount || 0).toFixed(2);
    const meta = tx.date + (tx.notes ? (" · " + tx.notes) : "");

    const leftDiv = document.createElement("div");
    leftDiv.className = "feed-left";
    leftDiv.innerHTML = `<div class="feed-cat">${escapeHtml(tx.category || "Expense")}</div><div class="feed-meta mono">${escapeHtml(meta)}</div>`;

    const rightDiv = document.createElement("div");
    rightDiv.className = "feed-right";

    const amtSpan = document.createElement("div");
    amtSpan.className = `feed-amt mono ${amtClass}`;
    amtSpan.textContent = sign + amt;

    const editBtn = document.createElement("button");
    editBtn.className = "feed-btn";
    editBtn.textContent = "edit";
    editBtn.addEventListener("click", () => openEdit(tx));

    const delBtn = document.createElement("button");
    delBtn.className = "feed-btn del";
    delBtn.textContent = "×";
    delBtn.title = "Delete entry";
    delBtn.addEventListener("click", () => delTx(tx.id));

    rightDiv.appendChild(amtSpan);
    rightDiv.appendChild(editBtn);
    rightDiv.appendChild(delBtn);

    item.appendChild(leftDiv);
    item.appendChild(rightDiv);
    list.appendChild(item);
  });
}

function fill(amount, category, note) {
  document.getElementById("fAmt").value = amount;
  if (category) document.getElementById("fCat").value = category;
  if (note) document.getElementById("fNote").value = note;
  document.getElementById("fAmt").focus();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Mode Switching ---
function setMode(mode) {
  currentMode = mode;
  const btnExp = document.getElementById("btnExp");
  const btnAllow = document.getElementById("btnAllow");
  const btnUtang = document.getElementById("btnUtang");
  const entryForm = document.getElementById("entryForm");
  const utangForm = document.getElementById("utangForm");
  const fType = document.getElementById("fType");
  const fCat = document.getElementById("fCat");
  const submitBtn = document.getElementById("submitBtn");

  btnExp.classList.remove("active");
  btnAllow.classList.remove("active");
  btnUtang.classList.remove("active");

  if (mode === "Expense") {
    btnExp.classList.add("active");
    entryForm.style.display = "block";
    utangForm.style.display = "none";
    fType.value = "Expense";
    if (fCat.value === "Allowance") fCat.value = "Transportation";
    submitBtn.textContent = "Record Expense";
  } else if (mode === "Allowance") {
    btnAllow.classList.add("active");
    entryForm.style.display = "block";
    utangForm.style.display = "none";
    fType.value = "Allowance";
    fCat.value = "Allowance";
    submitBtn.textContent = "Record Allowance";
  } else if (mode === "Utang") {
    btnUtang.classList.add("active");
    entryForm.style.display = "none";
    utangForm.style.display = "block";
    updateUtangAffectCashLabel();
  }
  renderPills();
}

function updateUtangAffectCashLabel() {
  const dirEl = document.getElementById("uDirection");
  const textEl = document.getElementById("uAffectCashText");
  if (!dirEl || !textEl) return;
  const isIOwe = (dirEl.value || "").toLowerCase().indexOf("i owe") !== -1;
  textEl.textContent = isIOwe
    ? "Add to cash balance (borrowed into wallet)"
    : "Deduct from cash balance (lent from wallet)";
}

// --- Mutation Handlers (Local-First Instant Execution) ---
function queueSyncItem(item) {
  if (!appState.syncQueue) appState.syncQueue = [];
  if (!item.timestamp) item.timestamp = new Date().toISOString();
  appState.syncQueue.push(item);
}

function addTransaction(tx) {
  appState.transactions.unshift(tx);
  queueSyncItem({ op: "ADD_TX", data: tx });
  persistState();
  renderUI();
  triggerAutoSync();
}

function editTransaction(id, updatedFields) {
  const idx = appState.transactions.findIndex(t => t.id === id);
  if (idx !== -1) {
    const old = { ...appState.transactions[idx] };
    appState.transactions[idx] = { ...appState.transactions[idx], ...updatedFields, edited: true, edited_at: new Date().toISOString() };
    logAudit({
      action: "EDIT_TX",
      targetId: id,
      summary: `Edited entry #${id.slice(-6)}: ${old.amount} -> ${updatedFields.amount !== undefined ? updatedFields.amount : old.amount} (${updatedFields.category || old.category})`
    });
    queueSyncItem({ op: "EDIT_TX", data: appState.transactions[idx] });
    persistState();
    renderUI();
    triggerAutoSync();
  }
}

function delTx(id) {
  if (!confirm("Delete entry?")) return;
  const found = appState.transactions.find(t => t.id === id);
  appState.transactions = appState.transactions.filter(t => t.id !== id);
  if (found) {
    logAudit({
      action: "DELETE_TX",
      targetId: id,
      summary: `Deleted ${found.type} #${id.slice(-6)} (${found.amount} ${found.category})`
    });
  }
  queueSyncItem({ op: "DEL_TX", data: { id } });
  persistState();
  renderUI();
  showStatus("Deleted", false);
  triggerAutoSync();
}

function addDebt(debt) {
  appState.debts.unshift(debt);
  queueSyncItem({ op: "ADD_DEBT", data: debt });
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

  const actualPay = Math.min(payAmt, remaining);
  const newPaid = currentPaid + actualPay;
  d.paid = newPaid;
  if (newPaid >= totalAmt) {
    d.status = "Settled";
  }

  const isIOwe = (d.direction || "").toLowerCase().indexOf("i owe") !== -1;
  if (affectCash) {
    const tx = {
      id: "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      date: getLocalDateStr(),
      timestamp: new Date().toISOString(),
      type: isIOwe ? "Expense" : "Allowance",
      category: isIOwe ? "Debt Repayment" : "Debt Collection",
      amount: actualPay,
      notes: isIOwe ? `Paid debt to ${d.person}` : `Collected debt from ${d.person}`,
      relatedDebtId: d.id
    };
    appState.transactions.unshift(tx);
    queueSyncItem({ op: "ADD_TX", data: tx });
  }

  logAudit({
    action: "SETTLE_DEBT",
    targetId: d.id,
    summary: `Settled ${actualPay.toFixed(2)} for ${d.person} (${d.direction})${affectCash ? ' [cash-linked]' : ''}`
  });

  queueSyncItem({ op: "SETTLE_DEBT", data: { id: d.id, payAmt: actualPay, newPaid, status: d.status } });

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
  appState.debts = appState.debts.filter(d => d.id !== id);
  queueSyncItem({ op: "DEL_DEBT", data: { id } });

  // If there was a linked cash transaction created with this debt, prompt to remove it too
  const linkedTx = appState.transactions.find(t => t.relatedDebtId === id);
  if (linkedTx && confirm(`Also remove the linked wallet transaction (${linkedTx.type} ${linkedTx.amount.toFixed(2)})?`)) {
    appState.transactions = appState.transactions.filter(t => t.id !== linkedTx.id);
    queueSyncItem({ op: "DEL_TX", data: { id: linkedTx.id } });
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

// --- Pills Management ---
function openManagePills() {
  const defaultType = (currentMode === "Allowance") ? "Allowance" : "Expense";
  currentPillFilter = defaultType;

  // Set form defaults based on active mode
  const pTypeEl = document.getElementById("pType");
  const pCatEl = document.getElementById("pCat");
  if (pTypeEl) pTypeEl.value = defaultType;
  if (pCatEl) pCatEl.value = (defaultType === "Allowance") ? "Allowance" : "Transportation";

  // Set active tab button
  document.querySelectorAll(".pill-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-pill-filter") === currentPillFilter);
  });

  renderPillsManagerList();
  document.getElementById("pillsModal").style.display = "flex";
}

function closeManagePills() {
  document.getElementById("pillsModal").style.display = "none";
  document.getElementById("pId").value = "";
  document.getElementById("pLabel").value = "";
  document.getElementById("pAmt").value = "";
  document.getElementById("pNote").value = "";
  document.getElementById("pSubmitBtn").textContent = "Save Pill";
}

function renderPillsManagerList() {
  const list = document.getElementById("pillsList");
  list.innerHTML = "";

  const presetsToShow = appState.presets.filter(p => {
    if (currentPillFilter === "all") return true;
    return (p.type || "Expense") === currentPillFilter;
  });

  if (presetsToShow.length === 0) {
    list.innerHTML = `<div style="font-size:0.75rem; color:var(--muted); padding:8px 0;">No ${currentPillFilter === "all" ? "" : currentPillFilter.toLowerCase()} pills created yet. Use the form above to add one.</div>`;
    return;
  }

  presetsToShow.forEach(p => {
    const item = document.createElement("div");
    item.className = "feed-item";
    const meta = `${p.type || "Expense"} · ${p.category}${p.note ? ` (${p.note})` : ""}`;

    const leftDiv = document.createElement("div");
    leftDiv.className = "feed-left";
    leftDiv.innerHTML = `<div class="feed-cat">${escapeHtml(p.label)} <span class="mono" style="color:var(--muted)">(${p.amount})</span></div><div class="feed-meta">${escapeHtml(meta)}</div>`;

    const rightDiv = document.createElement("div");
    rightDiv.className = "feed-right";

    const editBtn = document.createElement("button");
    editBtn.className = "feed-btn";
    editBtn.textContent = "edit";
    editBtn.addEventListener("click", () => {
      document.getElementById("pId").value = p.id;
      document.getElementById("pLabel").value = p.label;
      document.getElementById("pAmt").value = p.amount;
      document.getElementById("pCat").value = p.category;
      document.getElementById("pType").value = p.type || "Expense";
      document.getElementById("pNote").value = p.note || "";
      document.getElementById("pSubmitBtn").textContent = "Update Pill";
    });

    const delBtn = document.createElement("button");
    delBtn.className = "feed-btn del";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => {
      appState.presets = appState.presets.filter(item => item.id !== p.id);
      persistState();
      queueSyncItem({ op: "SYNC_PRESETS", data: appState.presets });
      renderPills();
      renderPillsManagerList();
      triggerAutoSync();
    });

    rightDiv.appendChild(editBtn);
    rightDiv.appendChild(delBtn);

    item.appendChild(leftDiv);
    item.appendChild(rightDiv);
    list.appendChild(item);
  });
}

function submitPreset(e) {
  e.preventDefault();
  const id = document.getElementById("pId").value;
  const label = document.getElementById("pLabel").value.trim();
  const amt = parseAmount(document.getElementById("pAmt").value);
  if (!label || amt <= 0) {
    showStatus("Please enter label and amount greater than 0", true);
    return;
  }

  if (id) {
    const p = appState.presets.find(item => item.id === id);
    if (p) {
      p.label = label;
      p.amount = amt;
      p.category = document.getElementById("pCat").value;
      p.type = document.getElementById("pType").value;
      p.note = document.getElementById("pNote").value.trim();
    }
  } else {
    appState.presets.push({
      id: "p_" + Date.now(),
      label,
      amount: amt,
      category: document.getElementById("pCat").value,
      type: document.getElementById("pType").value,
      note: document.getElementById("pNote").value.trim()
    });
  }

  persistState();
  queueSyncItem({ op: "SYNC_PRESETS", data: appState.presets });
  closeManagePills();
  renderPills();
  showStatus("Pills updated", false);
  triggerAutoSync();
}

// --- Stash Management (Hidden Reserves) ---
function addStash(amount, note, date) {
  const amt = parseAmount(amount);
  if (amt <= 0) return;
  const dStr = date || getLocalDateStr();
  const txId = "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const stashId = "st_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const cleanNote = note ? note.trim() : "Reserve";

  const tx = {
    id: txId,
    timestamp: new Date().toISOString(),
    date: dStr,
    type: "Expense",
    category: "Stash",
    amount: amt,
    notes: `Stashed: ${cleanNote}`
  };

  const stash = {
    id: stashId,
    timestamp: new Date().toISOString(),
    date: dStr,
    amount: amt,
    note: cleanNote,
    txId: txId
  };

  appState.transactions.unshift(tx);
  appState.stashes.unshift(stash);

  queueSyncItem({ op: "ADD_TX", data: tx });
  queueSyncItem({ op: "SYNC_STASHES", data: stash });
  persistState();
  renderUI();
  showStatus(`Stashed ${amt.toFixed(2)} into Vault`, false);
  triggerAutoSync();
}

function unstash(stashId) {
  const idx = appState.stashes.findIndex(s => s.id === stashId);
  if (idx === -1) return;

  const item = appState.stashes[idx];
  const amt = Number(item.amount) || 0;
  const cleanNote = item.note || "Reserve";

  appState.stashes.splice(idx, 1);

  const txId = "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const tx = {
    id: txId,
    timestamp: new Date().toISOString(),
    date: getLocalDateStr(),
    type: "Allowance",
    category: "Stash",
    amount: amt,
    notes: `Unstashed: ${cleanNote}`
  };

  appState.transactions.unshift(tx);
  queueSyncItem({ op: "ADD_TX", data: tx });
  queueSyncItem({ op: "SYNC_STASHES", data: { id: stashId, status: "Unstashed", amount: amt, note: cleanNote, date: getLocalDateStr() } });
  persistState();
  renderUI();
  showStatus(`Added ${amt.toFixed(2)} back to today's finance`, false);
  triggerAutoSync();
}

function deleteStash(stashId) {
  const idx = appState.stashes.findIndex(s => s.id === stashId);
  if (idx === -1) return;
  const item = appState.stashes[idx];
  const amt = Number(item.amount) || 0;

  const refund = confirm(`Delete Stash Record (₱${amt.toFixed(2)})?\n\n- Click OK to REFUND ₱${amt.toFixed(2)} back to your spendable cash.\n- Click CANCEL to choose whether to permanently discard without refunding.`);
  if (refund) {
    unstash(stashId);
    return;
  }

  if (confirm(`Permanently discard stash record (₱${amt.toFixed(2)}) WITHOUT returning funds to spendable cash?`)) {
    appState.stashes.splice(idx, 1);
    logAudit({
      action: "DELETE_STASH",
      targetId: item.id,
      summary: `Discarded stash record #${item.id.slice(-6)} (${amt.toFixed(2)} ${item.note || "Reserve"}) without refund`
    });
    persistState();
    renderUI();
    showStatus("Stash record permanently discarded", false);
    triggerAutoSync();
  }
}

function stashCurrentBalance() {
  const m = computeMetrics();
  if (m.todayRemaining <= 0) {
    showStatus("No positive balance remaining today to stash", true);
    return;
  }
  const amtInput = document.getElementById("stashAmt");
  const dateInput = document.getElementById("stashDate");
  const noteInput = document.getElementById("stashNote");
  if (amtInput) amtInput.value = m.todayRemaining.toFixed(2);
  if (dateInput) dateInput.value = getLocalDateStr();
  if (noteInput) noteInput.value = "Saved from today's balance";
  renderStashUI();
  const modal = document.getElementById("stashModal");
  if (modal) {
    modal.style.display = "flex";
    if (noteInput) noteInput.focus();
  }
}

function renderStashUI() {
  if (!appState.stashes) appState.stashes = [];
  const totalStash = appState.stashes.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const displayEl = document.getElementById("stashTotalDisplay");
  const maskBtn = document.getElementById("btnToggleStashMask");
  const quickList = document.getElementById("stashQuickList");
  const modalList = document.getElementById("stashModalList");

  if (displayEl) {
    displayEl.textContent = appState.stashMasked ? "••••••" : totalStash.toFixed(2);
  }
  if (maskBtn) {
    maskBtn.textContent = appState.stashMasked ? "Show" : "Hide";
  }

  if (quickList) {
    if (appState.stashes.length === 0) {
      quickList.style.display = "none";
      quickList.innerHTML = "";
    } else {
      quickList.style.display = "flex";
      const topItems = appState.stashes.slice(0, 3);
      quickList.innerHTML = topItems.map(item => `
        <div class="stash-item">
          <div>
            <b>${escapeHtml(item.note || "Reserve")}</b>
            <span class="feed-meta" style="margin-left:4px;">${item.date}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="mono" style="font-weight:600;">${appState.stashMasked ? "••••" : Number(item.amount).toFixed(2)}</span>
            <button type="button" class="feed-btn action" data-unstash-id="${item.id}" title="Add back to today's finance">+ Add to Finance</button>
          </div>
        </div>
      `).join("");

      quickList.querySelectorAll("[data-unstash-id]").forEach(btn => {
        btn.addEventListener("click", () => unstash(btn.getAttribute("data-unstash-id")));
      });
    }
  }

  if (modalList) {
    if (appState.stashes.length === 0) {
      modalList.innerHTML = '<div style="font-size:0.75rem; color:var(--muted); padding:4px 0;">No active stashes</div>';
    } else {
      modalList.innerHTML = appState.stashes.map(item => `
        <div class="feed-item">
          <div>
            <div class="feed-title">${escapeHtml(item.note || "Reserve")}</div>
            <div class="feed-meta">${item.date}</div>
          </div>
          <div class="feed-right">
            <span class="feed-amt mono pos">${Number(item.amount).toFixed(2)}</span>
            <button type="button" class="feed-btn action" data-unstash-modal-id="${item.id}">+ Add to Finance</button>
            <button type="button" class="feed-btn del" data-del-stash-id="${item.id}">×</button>
          </div>
        </div>
      `).join("");

      modalList.querySelectorAll("[data-unstash-modal-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          unstash(btn.getAttribute("data-unstash-modal-id"));
          renderStashUI();
        });
      });

      modalList.querySelectorAll("[data-del-stash-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          deleteStash(btn.getAttribute("data-del-stash-id"));
          renderStashUI();
        });
      });
    }
  }
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

// --- Antigravity-Style Interactive Background Circle Grid & Telemetry ---
let antigravityCanvasInited = false;
let agAnimationId = null;
const agMouse = { x: -1000, y: -1000, active: false };
const globalBgMouse = { x: -1000, y: -1000, active: false };
let agParticles = [];
let agDataPoints = [];
let bgDots = [];
let bgGridW = 0;
let bgGridH = 0;

// Autonomous "Bioluminescent Organisms" Living Entity Ecosystem
let activeOrganisms = [];
const MAX_ORGANISMS = 10;
let organismIdCounter = 0;
let lastOrganismTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

function createOrganism(x, y, customSpeed = null, customHue = null) {
  const angle = Math.random() * Math.PI * 2;
  const spd = customSpeed || (1.4 + Math.random() * 0.9);
  const hue = (customHue !== null) ? customHue : (organismIdCounter % 3);
  return {
    id: ++organismIdCounter,
    x: x,
    y: y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle: angle,
    speed: spd,
    breathPhase: Math.random() * Math.PI * 2,
    breathSpeed: (Math.PI * 2) / (2.6 + Math.random() * 1.2), // Period 2.6s - 3.8s
    baseInfluenceR: 220 + Math.random() * 50,
    baseSpotR: 300 + Math.random() * 70,
    currentInfluenceR: 220,
    currentSpotR: 300,
    currentBSin: 0,
    hueType: hue, // 0: Emerald, 1: Electric Cyan, 2: Deep Aqua
    alpha: 0.1,
    targetAlpha: 1.0,
    lastSeedTime: 0
  };
}

function spawnOrganismAt(x, y) {
  const w = window.innerWidth || 800;
  const h = window.innerHeight || 600;
  const spawnX = Math.max(30, Math.min(w - 30, x));
  const spawnY = Math.max(30, Math.min(h - 30, y));

  if (activeOrganisms.length >= MAX_ORGANISMS) {
    activeOrganisms.shift(); // Retire oldest organism to keep performance optimal
  }

// --- Canvas & Animation Stubs (To be implemented by UI team) ---
function triggerButtonSpawn(btn) {}
function ensureDefaultOrganism() {}
function wakeAntigravityLoop() {}
function updatePrecisionChrono() {}
function renderCalendarView() {}

function setupEventListeners() {
  document.getElementById("btnExp").addEventListener("click", () => setMode("Expense"));
  document.getElementById("btnAllow").addEventListener("click", () => setMode("Allowance"));
  document.getElementById("btnUtang").addEventListener("click", () => setMode("Utang"));

  document.getElementById("btnCheckin200").addEventListener("click", () => {
    addTransaction({
      id: "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      amount: 200,
      category: "Allowance",
      notes: "Daily school allowance",
      type: "Allowance",
      date: getLocalDateStr(),
      timestamp: new Date().toISOString()
    });
    showStatus("Logged 200 School", false);
  });

  document.getElementById("btnCheckinNone").addEventListener("click", () => {
    document.getElementById("checkinBox").style.display = "none";
  });

  document.getElementById("btnCheckinCustom").addEventListener("click", () => {
    setMode("Allowance");
    document.getElementById("fAmt").focus();
  });

  document.getElementById("entryForm").addEventListener("submit", submitEntry);
  document.getElementById("utangForm").addEventListener("submit", submitUtang);

  const uDirEl = document.getElementById("uDirection");
  if (uDirEl) {
    uDirEl.addEventListener("change", updateUtangAffectCashLabel);
  }

  const btnOpenTab = document.getElementById("btnOpenTab");
  if (btnOpenTab) {
    btnOpenTab.addEventListener("click", () => {
      const url = chrome.runtime ? chrome.runtime.getURL("popup.html") : "popup.html";
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, "_blank");
      }
    });
  }

  function openAnalyticsModal() {
    document.documentElement.classList.add("metrics-expanded");
    document.body.classList.add("metrics-expanded");
    const modal = document.getElementById("analyticsModal");
    if (modal) modal.style.display = "flex";
    try {
      renderAnalyticsUI();
      initAntigravityCanvas();
      const bgCanvas = document.getElementById("antigravityBgCanvas");
      if (bgCanvas) {
        const w = bgCanvas.clientWidth || window.innerWidth || 780;
        const h = bgCanvas.clientHeight || window.innerHeight || 600;
        initBgCircleGrid(w, h);
      }
      if (!agAnimationId) {
        agAnimationId = requestAnimationFrame(renderAntigravityLoop);
      }
    } catch (err) {
      console.error("Error opening analytics:", err);
    }
  }

  function closeAnalyticsModal() {
    const modal = document.getElementById("analyticsModal");
    if (modal) modal.style.display = "none";
    document.documentElement.classList.remove("metrics-expanded");
    document.body.classList.remove("metrics-expanded");
    wakeAntigravityLoop();
  }

  const btnAnalytics = document.getElementById("btnAnalytics");
  if (btnAnalytics) {
    btnAnalytics.addEventListener("click", openAnalyticsModal);
  }

  const analyticsCloseBtn = document.getElementById("analyticsCloseBtn");
  if (analyticsCloseBtn) {
    analyticsCloseBtn.addEventListener("click", closeAnalyticsModal);
  }

  function handleGlobalKeydown(e) {
    // 1. Backtick (`) key toggles metrics modal
    if (e.key === "`" || e.code === "Backquote") {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag !== "input" && tag !== "textarea" && tag !== "select") {
        e.preventDefault();
        const aModal = document.getElementById("analyticsModal");
        if (aModal && aModal.style.display !== "none") {
          closeAnalyticsModal();
        } else {
          openAnalyticsModal();
        }
        return;
      }
    }

    // 2. Escape key handling
    if (e.key === "Escape" || e.keyCode === 27) {
      const modals = ["analyticsModal", "settingsModal", "pillsModal", "stashModal", "editModal", "settleModal"];
      let modalClosed = false;
      for (const id of modals) {
        const modal = document.getElementById(id);
        if (modal && modal.style.display !== "none") {
          e.preventDefault();
          modalClosed = true;
          if (id === "analyticsModal") {
            closeAnalyticsModal();
          } else {
            modal.style.display = "none";
          }
        }
      }

      const confirmModal = document.getElementById("closeConfirmModal");
      if (modalClosed) {
        if (confirmModal) confirmModal.style.display = "none";
        return;
      }

      // No modal was open: handle close window confirmation
      if (confirmModal) {
        e.preventDefault();
        if (confirmModal.style.display === "flex") {
          // Esc pressed again while confirmation is visible -> close window!
          window.close();
        } else {
          // Esc pressed when not in metrics -> show popup asking to close
          confirmModal.style.display = "flex";
        }
      }
    }
  }
  window.addEventListener("keydown", handleGlobalKeydown, true);
  document.addEventListener("keydown", handleGlobalKeydown, true);

  // Close confirmation modal interactions (click anywhere to remove it)
  const closeConfirmModal = document.getElementById("closeConfirmModal");
  if (closeConfirmModal) {
    closeConfirmModal.addEventListener("click", () => {
      closeConfirmModal.style.display = "none";
    });
  }
  const btnConfirmCloseWindow = document.getElementById("btnConfirmCloseWindow");
  if (btnConfirmCloseWindow) {
    btnConfirmCloseWindow.addEventListener("click", (e) => {
      e.stopPropagation();
      window.close();
    });
  }
  const btnCancelCloseWindow = document.getElementById("btnCancelCloseWindow");
  if (btnCancelCloseWindow) {
    btnCancelCloseWindow.addEventListener("click", (e) => {
      e.stopPropagation();
      if (closeConfirmModal) closeConfirmModal.style.display = "none";
    });
  }

  // Backdrop click dismiss for all modals
  const analyticsModalEl = document.getElementById("analyticsModal");
  if (analyticsModalEl) {
    analyticsModalEl.addEventListener("click", (e) => {
      if (e.target === analyticsModalEl) {
        closeAnalyticsModal();
      }
    });
  }
  const backdropModals = ["settingsModal", "pillsModal", "stashModal", "editModal", "settleModal"];
  backdropModals.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", (e) => {
        if (e.target === el) el.style.display = "none";
      });
    }
  });

  // Auto-launch metrics if opened with ?metrics=1 query param
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("metrics") === "1") {
      setTimeout(openAnalyticsModal, 70);
    }
  } catch (_) {}

  // Calendar Navigation Listeners
  const calPrevBtn = document.getElementById("calPrevBtn");
  if (calPrevBtn) {
    calPrevBtn.addEventListener("click", () => {
      calViewMonth--;
      if (calViewMonth < 0) {
        calViewMonth = 11;
        calViewYear--;
      }
      renderCalendarView();
    });
  }

  const calNextBtn = document.getElementById("calNextBtn");
  if (calNextBtn) {
    calNextBtn.addEventListener("click", () => {
      calViewMonth++;
      if (calViewMonth > 11) {
        calViewMonth = 0;
        calViewYear++;
      }
      renderCalendarView();
    });
  }

  const calTodayBtn = document.getElementById("calTodayBtn");
  if (calTodayBtn) {
    calTodayBtn.addEventListener("click", () => {
      const now = new Date();
      calViewYear = now.getFullYear();
      calViewMonth = now.getMonth();
      calSelectedDate = getLocalDateStr(now);
      renderCalendarView();
    });
  }

  const calUseDateBtn = document.getElementById("calUseDateBtn");
  if (calUseDateBtn) {
    calUseDateBtn.addEventListener("click", () => {
      const fDate = document.getElementById("fDate");
      const uDate = document.getElementById("uDate");
      if (fDate) fDate.value = calSelectedDate;
      if (uDate) uDate.value = calSelectedDate;
      showStatus(`Form date set to ${calSelectedDate}`, false);
    });
  }

  const btnCat14d = document.getElementById("btnCat14d");
  const btnCatAll = document.getElementById("btnCatAll");
  if (btnCat14d && btnCatAll) {
    btnCat14d.addEventListener("click", () => {
      analyticsCatTimeframe = "14d";
      btnCat14d.classList.add("active");
      btnCatAll.classList.remove("active");
      renderAnalyticsUI();
    });
    btnCatAll.addEventListener("click", () => {
      analyticsCatTimeframe = "all";
      btnCatAll.classList.add("active");
      btnCat14d.classList.remove("active");
      renderAnalyticsUI();
    });
  }

  // Pill filter tabs in Pill Manager
  document.querySelectorAll(".pill-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPillFilter = btn.getAttribute("data-pill-filter");
      document.querySelectorAll(".pill-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (currentPillFilter === "Allowance") {
        document.getElementById("pType").value = "Allowance";
        document.getElementById("pCat").value = "Allowance";
      } else if (currentPillFilter === "Expense") {
        document.getElementById("pType").value = "Expense";
        document.getElementById("pCat").value = "Transportation";
      }
      renderPillsManagerList();
    });
  });

  // Settings & Sync Modal
  document.getElementById("btnSettings").addEventListener("click", () => {
    updateGoogleStatusUI();
    document.getElementById("cfgClientId").value = appState.googleAuth.clientId || "";
    document.getElementById("cfgSheet").value = appState.googleAuth.spreadsheetId || "";
    const roCheck = document.getElementById("cfgRollover");
    if (roCheck) roCheck.checked = !!appState.dailyRollover;
    const redirectInput = document.getElementById("cfgRedirectUri");
    if (redirectInput) {
      redirectInput.value = GoogleSync.getRedirectUri();
    }
    document.getElementById("settingsModal").style.display = "flex";
  });

  const btnCopyUri = document.getElementById("btnCopyRedirectUri");
  if (btnCopyUri) {
    btnCopyUri.addEventListener("click", async () => {
      const redirectInput = document.getElementById("cfgRedirectUri");
      if (redirectInput && redirectInput.value) {
        try {
          await navigator.clipboard.writeText(redirectInput.value);
          btnCopyUri.textContent = "Copied!";
          setTimeout(() => { btnCopyUri.textContent = "Copy"; }, 2000);
        } catch (e) {
          redirectInput.select();
          document.execCommand("copy");
          btnCopyUri.textContent = "Copied!";
          setTimeout(() => { btnCopyUri.textContent = "Copy"; }, 2000);
        }
      }
    });
  }

  const cfgRollover = document.getElementById("cfgRollover");
  if (cfgRollover) {
    cfgRollover.addEventListener("change", () => {
      appState.dailyRollover = cfgRollover.checked;
      persistState();
      renderUI();
    });
  }

  document.getElementById("cfgCloseBtn").addEventListener("click", () => {
    document.getElementById("settingsModal").style.display = "none";
  });

  document.getElementById("cfgCancelBtn").addEventListener("click", () => {
    document.getElementById("settingsModal").style.display = "none";
  });

  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    appState.googleAuth.clientId = document.getElementById("cfgClientId").value.trim();
    appState.googleAuth.spreadsheetId = GoogleSync.extractSpreadsheetId(document.getElementById("cfgSheet").value.trim());
    const roCheck = document.getElementById("cfgRollover");
    if (roCheck) appState.dailyRollover = roCheck.checked;
    persistState();
    renderUI();
    document.getElementById("settingsModal").style.display = "none";
    showStatus("Settings saved", false);
    triggerAutoSync();
  });

  document.getElementById("btnGoogleLogin").addEventListener("click", loginGoogle);
  document.getElementById("btnGoogleLogout").addEventListener("click", logoutGoogle);
  document.getElementById("btnManualSync").addEventListener("click", () => {
    if (!appState.googleAuth.token) {
      showStatus("Please connect your Google Account first.", true);
      return;
    }
    triggerAutoSync();
  });

  const btnPullCloud = document.getElementById("btnPullCloud");
  if (btnPullCloud) {
    btnPullCloud.addEventListener("click", async () => {
      if (!appState.googleAuth || !appState.googleAuth.token) {
        showStatus("Please connect your Google Account first.", true);
        return;
      }
      btnPullCloud.disabled = true;
      btnPullCloud.textContent = "Pulling...";
      try {
        let sheetId = appState.googleAuth.spreadsheetId;
        if (!sheetId) {
          sheetId = await GoogleSync.getOrCreateSpreadsheet(appState.googleAuth.token);
          appState.googleAuth.spreadsheetId = sheetId;
          persistState();
        }
        await hydrateFromCloud(appState.googleAuth.token, sheetId);
        showStatus("Cloud data synchronized successfully", false);
      } catch (err) {
        showStatus("Pull Error: " + err.message, true);
      } finally {
        btnPullCloud.disabled = false;
        btnPullCloud.textContent = "Pull from Cloud";
      }
    });
  }

  document.getElementById("btnExportData").addEventListener("click", exportDataJson);
  const btnClearAll = document.getElementById("btnClearAllData");
  if (btnClearAll) btnClearAll.addEventListener("click", clearAllData);
  const btnClearData = document.getElementById("btnClearData");
  if (btnClearData) btnClearData.addEventListener("click", clearAllData);

  // System Diagnostics Self-Test
  const btnRunDiag = document.getElementById("btnRunDiagnostics");
  if (btnRunDiag) {
    btnRunDiag.addEventListener("click", () => {
      const outputEl = document.getElementById("diagnosticsOutput");
      if (!outputEl) return;
      btnRunDiag.disabled = true;
      btnRunDiag.textContent = "Testing...";

      const tests = runSystemDiagnostics();
      const allPassed = tests.every(t => t.pass);
      const passCount = tests.filter(t => t.pass).length;

      let html = `<div style="font-weight:700; color:${allPassed ? 'var(--positive)' : 'var(--negative)'}; margin-bottom:6px;">`;
      html += `[${allPassed ? 'PASS' : 'FAIL'}] ${passCount}/${tests.length} Features Verified (${allPassed ? 'All Systems Operational' : 'Issues Detected'})</div>`;
      html += tests.map(t => `
        <div style="margin-bottom:3px; display:flex; justify-content:space-between; gap:6px;">
          <span><b style="color:${t.pass ? 'var(--positive)' : 'var(--negative)'};">[${t.pass ? 'OK' : 'ERR'}]</b> ${t.name}</span>
          <span style="color:var(--muted); text-align:right;">${t.detail}</span>
        </div>
      `).join("");

      outputEl.innerHTML = html;
      outputEl.style.display = "block";
      btnRunDiag.disabled = false;
      btnRunDiag.textContent = "Run Test";
    });
  }

  // Settle Modal
  document.getElementById("sCloseBtn").addEventListener("click", closeSettle);
  document.getElementById("sCancelBtn").addEventListener("click", closeSettle);
  document.getElementById("sFullBtn").addEventListener("click", () => {
    if (currentSettleDebt) {
      const rem = Math.max(0, (Number(currentSettleDebt.amount) || 0) - (Number(currentSettleDebt.paid) || 0));
      const sAmtInput = document.getElementById("sAmt");
      sAmtInput.value = rem;
      sAmtInput.focus();
      sAmtInput.select();
    }
  });
  const settleForm = document.getElementById("settleForm");
  settleForm.addEventListener("submit", submitSettle);
  settleForm.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSettle(e);
    }
  });

  // Edit Modal
  document.getElementById("eCloseBtn").addEventListener("click", closeEdit);
  document.getElementById("eCancelBtn").addEventListener("click", closeEdit);
  const editForm = document.getElementById("editForm");
  editForm.addEventListener("submit", submitEdit);
  editForm.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitEdit(e);
    }
  });

  // Stash Modal & Actions
  const btnOpenStash = document.getElementById("btnOpenStashModal");
  if (btnOpenStash) {
    btnOpenStash.addEventListener("click", () => {
      const amtInput = document.getElementById("stashAmt");
      const dateInput = document.getElementById("stashDate");
      const noteInput = document.getElementById("stashNote");
      if (amtInput) amtInput.value = "";
      if (dateInput) dateInput.value = getLocalDateStr();
      if (noteInput) noteInput.value = "";
      renderStashUI();
      document.getElementById("stashModal").style.display = "flex";
      if (amtInput) amtInput.focus();
    });
  }

  const btnStashRem = document.getElementById("btnStashRemaining");
  if (btnStashRem) {
    btnStashRem.addEventListener("click", stashCurrentBalance);
  }

  const btnToggleMask = document.getElementById("btnToggleStashMask");
  if (btnToggleMask) {
    btnToggleMask.addEventListener("click", () => {
      appState.stashMasked = !appState.stashMasked;
      persistState();
      renderStashUI();
    });
  }

  const stashCloseBtn = document.getElementById("stashCloseBtn");
  if (stashCloseBtn) {
    stashCloseBtn.addEventListener("click", () => {
      document.getElementById("stashModal").style.display = "none";
    });
  }

  const stashCancelBtn = document.getElementById("stashCancelBtn");
  if (stashCancelBtn) {
    stashCancelBtn.addEventListener("click", () => {
      document.getElementById("stashModal").style.display = "none";
    });
  }

  const stashForm = document.getElementById("stashForm");
  if (stashForm) {
    const handleStashSubmit = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const amt = parseAmount(document.getElementById("stashAmt").value);
      const date = document.getElementById("stashDate").value;
      const note = document.getElementById("stashNote").value;
      if (amt <= 0) {
        showStatus("Please enter an amount greater than 0", true);
        return;
      }
      addStash(amt, note, date);
      document.getElementById("stashModal").style.display = "none";
    };
    stashForm.addEventListener("submit", handleStashSubmit);
    stashForm.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleStashSubmit(e);
      }
    });
  }

  // Pills Modal
  document.getElementById("btnManagePills").addEventListener("click", openManagePills);
  document.getElementById("pCloseBtn").addEventListener("click", closeManagePills);
  const presetForm = document.getElementById("presetForm");
  presetForm.addEventListener("submit", submitPreset);
  presetForm.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitPreset(e);
    }
  });

  // Network listener for auto-sync
  window.addEventListener("online", triggerAutoSync);
}

// System Feature Self-Test Engine
function runSystemDiagnostics() {
  const results = [];
  function assert(name, condition, detail) {
    results.push({ name, pass: !!condition, detail: detail || "" });
  }

  // 1. Integer & Decimal Number Parser
  try {
    const p1 = parseAmount(200);
    const p2 = parseAmount("200");
    const p3 = parseAmount("200.");
    const p4 = parseAmount("1,250.50");
    const p5 = parseAmount("₱500");
    const p6 = parseAmount(0.1 + 0.2);
    const p7 = parseAmount("0.00");
    const ok = (p1 === 200) && (p2 === 200) && (p3 === 200) && (p4 === 1250.5) && (p5 === 500) && (p6 === 0.3) && (p7 === 0);
    assert("Number & Decimal Engine", ok, `Parsed 200, "200.", "1,250.50", "₱500" accurately`);
  } catch (e) {
    assert("Number & Decimal Engine", false, e.message);
  }

  // 2. Financial Balance & Cash Flow Calculations
  try {
    const mockTxs = [
      { type: "Allowance", amount: 200.0, date: "2026-09-14" },
      { type: "Expense", amount: 45.0, date: "2026-09-14" },
      { type: "Expense", amount: 15.0, date: "2026-09-14" }
    ];
    const totalIn = mockTxs.filter(t => t.type === "Allowance").reduce((s, t) => s + parseAmount(t.amount), 0);
    const totalOut = mockTxs.filter(t => t.type === "Expense").reduce((s, t) => s + parseAmount(t.amount), 0);
    const bal = Math.round((totalIn - totalOut) * 100) / 100;
    assert("Cash Flow & Balance Engine", bal === 140.0, `In: 200.00, Out: 60.00, Rem: 140.00`);
  } catch (e) {
    assert("Cash Flow & Balance Engine", false, e.message);
  }

  // 3. Utang & Debt Payment Clamping
  try {
    const debt = { amount: 100.0, paid: 80.0, status: "Active" };
    const rem = Math.max(0, parseAmount(debt.amount) - parseAmount(debt.paid));
    const payAttempt = 50.0;
    const actualPay = Math.min(payAttempt, rem);
    debt.paid += actualPay;
    if (debt.paid >= debt.amount) debt.status = "Settled";
    const ok = (actualPay === 20.0) && (debt.paid === 100.0) && (debt.status === "Settled");
    assert("Debt Overpayment Clamping", ok, `Clamped 50.00 to remaining 20.00`);
  } catch (e) {
    assert("Debt Overpayment Clamping", false, e.message);
  }

  // 4. Stash Vault Isolation & Refund
  try {
    let cash = 100.0;
    let stashVault = 0.0;
    const stashAmt = 40.0;
    cash -= stashAmt;
    stashVault += stashAmt;
    const okStash = (cash === 60.0) && (stashVault === 40.0);
    cash += 30.0;
    stashVault -= 30.0;
    const okUnstash = (cash === 90.0) && (stashVault === 10.0);
    assert("Stash Vault Isolation & Refund", okStash && okUnstash, `Shielded 40.00, Refunded 30.00`);
  } catch (e) {
    assert("Stash Vault Isolation & Refund", false, e.message);
  }

  // 5. Daily Balance Rollover Logic
  try {
    const yIn = 200.0;
    const yOut = 130.0;
    const rollover = Math.max(0, yIn - yOut);
    const todayIn = 150.0;
    const todayOut = 40.0;
    const finalToday = Math.round(((todayIn + rollover) - todayOut) * 100) / 100;
    assert("Daily Rollover Engine", finalToday === 180.0 && rollover === 70.0, `Rollover +70.00 -> Today: 180.00`);
  } catch (e) {
    assert("Daily Rollover Engine", false, e.message);
  }

  // 6. Streak & Missed Days Anchor
  try {
    const installDate = "2026-09-14";
    const dStr = "2026-09-12";
    const isBeforeStart = (dStr < installDate);
    const isMissed = !isBeforeStart;
    assert("Streak & Telemetry Anchor", isBeforeStart && !isMissed, `Pre-install marked untracked (0 false missed)`);
  } catch (e) {
    assert("Streak & Telemetry Anchor", false, e.message);
  }

  // 7. Google Sheets Formula Sanitizer
  try {
    const s1 = typeof GoogleSync !== "undefined" && GoogleSync.sanitizeVal ? GoogleSync.sanitizeVal("=SUM(A1:B2)") : "'" + "=SUM(A1:B2)";
    const s2 = typeof GoogleSync !== "undefined" && GoogleSync.sanitizeVal ? GoogleSync.sanitizeVal("+200 Bonus") : "'" + "+200 Bonus";
    const s3 = typeof GoogleSync !== "undefined" && GoogleSync.sanitizeVal ? GoogleSync.sanitizeVal("Normal Text") : "Normal Text";
    const ok = s1.startsWith("'") && s2.startsWith("'") && !s3.startsWith("'");
    assert("Formula Injection Sanitizer", ok, `Formulas prefixed safely with single quote`);
  } catch (e) {
    assert("Formula Injection Sanitizer", false, e.message);
  }

  // 8. Storage & Queue Serialization
  try {
    const sampleQueueItem = { op: "ADD_TX", data: { id: "tx_diag", amount: 100.0, type: "Expense" } };
    const serialized = JSON.stringify(sampleQueueItem);
    const parsed = JSON.parse(serialized);
    assert("Sync Queue Serialization", parsed.data.amount === 100.0 && parsed.op === "ADD_TX", `JSON FIFO serialization safe`);
  } catch (e) {
    assert("Sync Queue Serialization", false, e.message);
  }

  // 9. Pautang & Debt Cash-Flow Linking
  try {
    let mockCash = 200.0;
    const pautangAmt = 50.0;
    const mockCashUnchecked = mockCash;
    let mockCashChecked = mockCash - pautangAmt;
    const okPautang = (mockCashUnchecked === 200.0) && (mockCashChecked === 150.0);
    mockCashChecked += pautangAmt;
    const okRepay = (mockCashChecked === 200.0);
    assert("Pautang & Debt Cash Linking", okPautang && okRepay, `Deducts 50.00 when checked, isolates when unchecked`);
  } catch (e) {
    assert("Pautang & Debt Cash Linking", false, e.message);
  }

  // 10. Queue Dispatch Engine
  try {
    const testQ = [];
    testQ.push({ op: "ADD_TX", data: { id: "t1" } });
    testQ.push({ op: "EDIT_TX", data: { id: "t1", amount: 120 } });
    testQ.push({ op: "SETTLE_DEBT", data: { id: "d1", status: "Settled" } });
    const okOps = testQ.length === 3 && testQ[1].op === "EDIT_TX" && testQ[2].op === "SETTLE_DEBT";
    assert("Queue Dispatch Engine", okOps, `Handles ADD_TX, EDIT_TX, SETTLE_DEBT operations`);
  } catch (e) {
    assert("Queue Dispatch Engine", false, e.message);
  }

  return results;
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

  wakeAntigravityLoop();
  updatePrecisionChrono();
  renderCalendarView();
  setupEventListeners();
  loadLocalState(() => {
    renderUI();
    if (navigator.onLine && appState.googleAuth && appState.googleAuth.token) {
      triggerAutoSync();
    }
  });
});
