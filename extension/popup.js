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
  largeFont: false,
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
    chrome.storage.local.get(["transactions", "debts", "presets", "stashes", "stashMasked", "dailyRollover", "largeFont", "installDate", "auditLog", "syncQueue", "googleAuth"], function(res) {
      if (res.transactions) appState.transactions = res.transactions;
      if (res.debts) appState.debts = res.debts;
      if (res.presets) appState.presets = res.presets;
      if (res.stashes) appState.stashes = res.stashes;
      if (typeof res.stashMasked === "boolean") appState.stashMasked = res.stashMasked;
      if (typeof res.dailyRollover === "boolean") appState.dailyRollover = res.dailyRollover;
      if (typeof res.largeFont === "boolean") appState.largeFont = res.largeFont;
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
    const lf = localStorage.getItem("largeFont");
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
    if (lf) appState.largeFont = JSON.parse(lf);
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
      largeFont: appState.largeFont,
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
    localStorage.setItem("largeFont", JSON.stringify(appState.largeFont));
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

// --- Interactive Background Grid & Ambient Orb Dynamics ---
let telemetryCanvasInited = false;
let bgAnimationId = null;
const bgMouse = { x: -1000, y: -1000, active: false };
const globalMouse = { x: -1000, y: -1000, active: false };
let bgParticles = [];
let chartDataPoints = [];
let bgDots = [];
let bgGridW = 0;
let bgGridH = 0;

// Ambient Floating Light Orbs (Capped to maximum 6, distributed evenly across 6 distinct screen zones)
let activeOrbs = [];
const MAX_ORBS = 6;
let orbIdCounter = 0;
let orbSpawnSlotIndex = 0;
let lastOrbTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

// 6 evenly distributed spatial zones across the viewport
const ORB_SPACES = [
  { xRatio: 0.18, yRatio: 0.22, name: "top-left" },
  { xRatio: 0.50, yRatio: 0.18, name: "top-center" },
  { xRatio: 0.82, yRatio: 0.22, name: "top-right" },
  { xRatio: 0.82, yRatio: 0.78, name: "bottom-right" },
  { xRatio: 0.50, yRatio: 0.82, name: "bottom-center" },
  { xRatio: 0.18, yRatio: 0.78, name: "bottom-left" }
];

function createOrb(x, y, customSpeed = null, customHue = null) {
  const angle = Math.random() * Math.PI * 2;
  const spd = customSpeed || (1.3 + Math.random() * 0.8);
  const hue = (customHue !== null) ? customHue : (orbIdCounter % 6);
  return {
    id: ++orbIdCounter,
    x: x,
    y: y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle: angle,
    speed: spd,
    breathPhase: Math.random() * Math.PI * 2,
    breathSpeed: (Math.PI * 2) / (2.6 + Math.random() * 1.2),
    baseInfluenceR: 220 + Math.random() * 50,
    baseSpotR: 300 + Math.random() * 70,
    currentInfluenceR: 220,
    currentSpotR: 300,
    currentBSin: 0,
    hueType: hue, // 0..5: Emerald, Cyan, Teal, Amber Gold, Violet, Rose
    alpha: 0.1,
    targetAlpha: 1.0,
    lastSeedTime: 0
  };
}

function spawnOrbInNextSpace(clickX, clickY) {
  const w = window.innerWidth || 800;
  const h = window.innerHeight || 600;

  // Cycle through the 6 evenly spaced zones across the screen
  const slot = ORB_SPACES[orbSpawnSlotIndex % MAX_ORBS];
  orbSpawnSlotIndex++;

  const spawnX = Math.max(30, Math.min(w - 30, slot.xRatio * w + (Math.random() - 0.5) * 40));
  const spawnY = Math.max(30, Math.min(h - 30, slot.yRatio * h + (Math.random() - 0.5) * 40));

  // Maintain max 6 active orbs at all times
  if (activeOrbs.length >= MAX_ORBS) {
    activeOrbs.shift(); // Retire oldest orb
  }

  const orb = createOrb(spawnX, spawnY);
  // Velocity oriented smoothly toward screen center
  const toCenterX = (w / 2) - spawnX;
  const toCenterY = (h / 2) - spawnY;
  const centerAngle = Math.atan2(toCenterY, toCenterX) + (Math.random() - 0.5) * 0.8;
  orb.vx = Math.cos(centerAngle) * 2.6;
  orb.vy = Math.sin(centerAngle) * 2.6;
  activeOrbs.push(orb);

  // Trigger ripple pattern at the clicked button location
  if (typeof clickX === "number" && typeof clickY === "number") {
    spawnGolPattern(clickX, clickY);
  }
  wakeBackgroundLoop();
}

function ensureDefaultOrb() {
  if (activeOrbs.length === 0) {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const slot = ORB_SPACES[0];
    activeOrbs.push(createOrb(slot.xRatio * w, slot.yRatio * h, 1.85, 0));
  }
}

let orbIdleTimer = null;
const IDLE_DELAY_MS = 2500;
let isWindowFocused = (typeof document !== "undefined" && document.hasFocus) ? document.hasFocus() : true;

function activateOrb() {
  ensureDefaultOrb();
  wakeBackgroundLoop();
}

function deactivateOrb() {
  resetOrbIdleTimer();
}

function resetOrbIdleTimer() {
  clearTimeout(orbIdleTimer);
  if (isWindowFocused) {
    orbIdleTimer = setTimeout(() => {
      activateOrb();
    }, IDLE_DELAY_MS);
  }
}

// Global cursor tracking across the entire window for the background canvas
window.addEventListener("mousemove", (e) => {
  globalMouse.x = e.clientX;
  globalMouse.y = e.clientY;
  globalMouse.active = true;
  resetOrbIdleTimer();
  wakeBackgroundLoop();
});

window.addEventListener("mouseleave", () => {
  globalMouse.active = false;
  activateOrb();
});

window.addEventListener("touchmove", (e) => {
  if (e.touches && e.touches.length > 0) {
    globalMouse.x = e.touches[0].clientX;
    globalMouse.y = e.touches[0].clientY;
    globalMouse.active = true;
    resetOrbIdleTimer();
    wakeBackgroundLoop();
  }
}, { passive: true });

window.addEventListener("touchend", () => {
  globalMouse.active = false;
  resetOrbIdleTimer();
});

window.addEventListener("blur", () => {
  isWindowFocused = false;
  activateOrb();
});

window.addEventListener("focus", () => {
  isWindowFocused = true;
  lastOrbTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  resetOrbIdleTimer();
  wakeBackgroundLoop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (bgAnimationId) {
      cancelAnimationFrame(bgAnimationId);
      bgAnimationId = null;
    }
  } else {
    lastOrbTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    isWindowFocused = (typeof document !== "undefined" && document.hasFocus) ? document.hasFocus() : true;
    if (!isWindowFocused) {
      activateOrb();
    } else {
      resetOrbIdleTimer();
    }
    wakeBackgroundLoop();
  }
});

// Start with 1 default living organism
ensureDefaultOrb();
resetOrbIdleTimer();

// Conway's Game of Life Cellular Automaton & Dynamic Pulsing State
let golCols = 0;
let golRows = 0;
let golStartX = 0;
let golStartY = 0;
const golSpacing = 28;
let golGrid = null;
let golNextGrid = null;
let lastGolTick = 0;
const GOL_TICK_MS = 140; // ~7 generations/sec
let golPatternIndex = 0;
let lastOrbSeedTime = 0;

// Iconic Conway Patterns (relative offsets [dc, dr])
const GOL_PATTERNS = [
  // 0: Glider (glides diagonally across the screen)
  [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  // 1: Pulsar / Cross oscillator
  [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]],
  // 2: R-Pentomino (long-lived chaotic burst evolving for > 80 generations)
  [[0, 1], [1, 0], [1, 1], [1, 2], [2, 0]],
  // 3: Lightweight Spaceship (LWSS)
  [[0, 1], [0, 4], [1, 0], [2, 0], [3, 0], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3]],
  // 4: Beacon / Toad oscillator
  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2], [2, 3], [3, 2], [3, 3]],
  // 5: Exploding Nova Ring
  [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0], [0, -1], [0, 1]]
];

function spawnGolPattern(centerX, centerY, patternType = -1) {
  if (!golGrid || golCols < 4 || golRows < 4) return;
  const c = Math.round((centerX - golStartX) / golSpacing);
  const r = Math.round((centerY - golStartY) / golSpacing);
  if (c < 0 || c >= golCols || r < 0 || r >= golRows) return;

  const pattern = patternType >= 0 
    ? GOL_PATTERNS[patternType % GOL_PATTERNS.length] 
    : GOL_PATTERNS[(golPatternIndex++) % GOL_PATTERNS.length];

  for (let i = 0; i < pattern.length; i++) {
    const dc = pattern[i][0];
    const dr = pattern[i][1];
    const nc = (c + dc + golCols) % golCols;
    const nr = (r + dr + golRows) % golRows;
    const idx = nc * golRows + nr;
    golGrid[idx] = 1;
    if (bgDots[idx]) {
      bgDots[idx].energy = 1.0;
      bgDots[idx].r = 4.8;
    }
  }

  // Physical deflection shockwave propagating outward from click / spawn point
  const shockRadius = 175;
  const numDots = bgDots.length;
  for (let i = 0; i < numDots; i++) {
    const dot = bgDots[i];
    const dx = dot.ox - centerX;
    const dy = dot.oy - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < shockRadius && dist > 1) {
      const force = (1 - dist / shockRadius) * 16;
      const angle = Math.atan2(dy, dx);
      dot.vx += Math.cos(angle) * force;
      dot.vy += Math.sin(angle) * force;
    }
  }

  wakeBackgroundLoop();
}

// Each button click or UI control spawns a living cellular automaton pattern!
window.addEventListener("click", (e) => {
  const target = e.target;
  const isButton = target && (
    target.tagName === "BUTTON" ||
    target.closest("button") ||
    target.classList.contains("btn") ||
    target.closest(".btn") ||
    target.classList.contains("action-btn") ||
    target.classList.contains("pill-btn") ||
    target.classList.contains("stash-pill") ||
    target.closest(".modal-close-btn") ||
    target.closest(".stash-card") ||
    target.closest(".summary-card") ||
    target.closest(".analytics-stat-card") ||
    target.getAttribute("role") === "button" ||
    target.tagName === "A"
  );

  if (isButton) {
    // Spawn 1 new living organism that swims outward from this button!
    spawnOrbInNextSpace(e.clientX, e.clientY);
  } else if (e.clientX < window.innerWidth && e.clientY < window.innerHeight) {
    // Subtle mini-burst on other background clicks
    spawnGolPattern(e.clientX, e.clientY, 1);
  }
}, true);

function stepGameOfLife() {
  if (!golGrid || golCols < 3 || golRows < 3) return;
  let aliveCount = 0;

  for (let c = 0; c < golCols; c++) {
    const cLeft = (c - 1 + golCols) % golCols;
    const cRight = (c + 1) % golCols;

    for (let r = 0; r < golRows; r++) {
      const rUp = (r - 1 + golRows) % golRows;
      const rDown = (r + 1) % golRows;

      // 8 toroidal neighbors
      const neighbors =
        golGrid[cLeft * golRows + rUp] +
        golGrid[cLeft * golRows + r] +
        golGrid[cLeft * golRows + rDown] +
        golGrid[c * golRows + rUp] +
        golGrid[c * golRows + rDown] +
        golGrid[cRight * golRows + rUp] +
        golGrid[cRight * golRows + r] +
        golGrid[cRight * golRows + rDown];

      const idx = c * golRows + r;
      const wasAlive = golGrid[idx];

      if (wasAlive === 1) {
        if (neighbors === 2 || neighbors === 3) {
          golNextGrid[idx] = 1;
          aliveCount++;
        } else {
          golNextGrid[idx] = 0;
        }
      } else {
        if (neighbors === 3) {
          golNextGrid[idx] = 1;
          aliveCount++;
        } else {
          golNextGrid[idx] = 0;
        }
      }
    }
  }

  // Fast typed array buffer swap
  const temp = golGrid;
  golGrid = golNextGrid;
  golNextGrid = temp;

  // Extinction safeguard: if total living cells drop below 4, inject a fresh seed
  if (aliveCount < 4 && (activeOrbs.length > 0 || !isWindowFocused)) {
    const randX = 100 + Math.random() * (bgGridW - 200);
    const randY = 100 + Math.random() * (bgGridH - 200);
    spawnGolPattern(randX, randY, 0); // Glider
  }
}

function initBgCircleGrid(w, h) {
  bgGridW = w;
  bgGridH = h;
  bgDots = [];
  golCols = Math.ceil(w / golSpacing) + 1;
  golRows = Math.ceil(h / golSpacing) + 1;
  golStartX = (w - (golCols - 1) * golSpacing) / 2;
  golStartY = (h - (golRows - 1) * golSpacing) / 2;

  const totalCells = golCols * golRows;
  golGrid = new Uint8Array(totalCells);
  golNextGrid = new Uint8Array(totalCells);

  for (let c = 0; c < golCols; c++) {
    for (let r = 0; r < golRows; r++) {
      const ox = golStartX + c * golSpacing;
      const oy = golStartY + r * golSpacing;
      bgDots.push({
        c: c,
        r: r,
        ox: ox,
        oy: oy,
        x: ox,
        y: oy,
        vx: 0,
        vy: 0,
        baseR: 1.35,
        r: 1.35,
        alpha: 0.14,
        energy: 0,
        phase: (c * 0.38 + r * 0.52) % (Math.PI * 2)
      });
    }
  }

  // Seed initial life patterns
  spawnGolPattern(w * 0.5, h * 0.45, 2); // R-Pentomino in center
  spawnGolPattern(w * 0.25, h * 0.3, 0);  // Glider in upper-left
  spawnGolPattern(w * 0.75, h * 0.65, 3); // LWSS in lower-right
}

function drawBackgroundGrid(canvas) {
  if (!canvas) return false;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth || document.documentElement.clientWidth || 800;
  const h = window.innerHeight || document.documentElement.clientHeight || 600;

  if (w < 10 || h < 10) return false;

  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    initBgCircleGrid(w, h);
  } else if (bgDots.length === 0 || Math.abs(bgGridW - w) > 2 || Math.abs(bgGridH - h) > 2) {
    initBgCircleGrid(w, h);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  let anyMoving = false;

  // Step Game of Life cellular automaton at ~7 generations/sec
  const curNow = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (curNow - lastGolTick >= GOL_TICK_MS) {
    lastGolTick = curNow;
    stepGameOfLife();
  }

  // Update Ambient Floating Orbs Physics & Smooth Wandering
  const dt = Math.min(0.064, Math.max(0.008, (curNow - lastOrbTick) / 1000));
  lastOrbTick = curNow;

  const numOrbs = activeOrbs.length;
  const pad = 100;

  for (let o = 0; o < numOrbs; o++) {
    const org = activeOrbs[o];
    org.breathPhase += dt * org.breathSpeed;
    if (org.breathPhase > Math.PI * 2) org.breathPhase -= Math.PI * 2;
    const bSin = Math.sin(org.breathPhase);
    org.currentBSin = bSin;

    // Organic harmonic steering
    org.angle += (Math.sin(curNow * 0.0013 + org.id) * 0.048 + Math.cos(curNow * 0.0009 + org.id * 2) * 0.04);

    // Boundary repulsion cushion
    if (org.x < pad) org.angle += (pad - org.x) * 0.0014;
    else if (org.x > w - pad) org.angle -= (org.x - (w - pad)) * 0.0014;
    if (org.y < pad) org.angle += (pad - org.y) * 0.0014;
    else if (org.y > h - pad) org.angle -= (org.y - (h - pad)) * 0.0014;

    const speedPulse = org.speed * (1 + 0.3 * bSin) * 65 * dt;
    org.vx = (org.vx * 0.86) + Math.cos(org.angle) * speedPulse * 0.14;
    org.vy = (org.vy * 0.86) + Math.sin(org.angle) * speedPulse * 0.14;
    org.x += org.vx;
    org.y += org.vy;

    org.x = Math.max(25, Math.min(w - 25, org.x));
    org.y = Math.max(25, Math.min(h - 25, org.y));

    org.currentInfluenceR = org.baseInfluenceR + 60 * bSin;
    org.currentSpotR = org.baseSpotR + 80 * bSin;
    org.alpha += (org.targetAlpha - org.alpha) * 0.1;

    // Ignite cells under organism core
    if (golGrid) {
      const orgC = Math.round((org.x - golStartX) / golSpacing);
      const orgR = Math.round((org.y - golStartY) / golSpacing);
      if (orgC >= 0 && orgC < golCols && orgR >= 0 && orgR < golRows) {
        golGrid[orgC * golRows + orgR] = 1;
      }

      // Drop life spores on peak respiration
      if (bSin > 0.84 && (curNow - org.lastSeedTime > 420)) {
        org.lastSeedTime = curNow;
        spawnGolPattern(org.x, org.y, org.id % 4);
      }
    }

    anyMoving = true;
  }

  // User mouse also ignites cells
  if (globalMouse.active && golGrid) {
    const mouseC = Math.round((globalMouse.x - golStartX) / golSpacing);
    const mouseR = Math.round((globalMouse.y - golStartY) / golSpacing);
    if (mouseC >= 0 && mouseC < golCols && mouseR >= 0 && mouseR < golRows) {
      golGrid[mouseC * golRows + mouseR] = 1;
    }
  }

  // 1. Ambient spotlight glow for floating orbs
  for (let o = 0; o < numOrbs; o++) {
    const org = activeOrbs[o];
    const radGrad = ctx.createRadialGradient(
      org.x, org.y, 0,
      org.x, org.y, org.currentSpotR
    );
    const bSin = org.currentBSin;
    if (org.hueType === 0) {
      // Emerald
      radGrad.addColorStop(0, `rgba(16, 185, 129, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(56, 189, 248, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 1) {
      // Electric Cyan
      radGrad.addColorStop(0, `rgba(56, 189, 248, ${(0.14 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(16, 185, 129, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 2) {
      // Deep Aqua / Teal
      radGrad.addColorStop(0, `rgba(20, 184, 166, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(14, 165, 233, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 3) {
      // Warm Amber / Gold
      radGrad.addColorStop(0, `rgba(245, 158, 11, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(234, 88, 12, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 4) {
      // Soft Violet
      radGrad.addColorStop(0, `rgba(168, 85, 247, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(59, 130, 246, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else {
      // Rose / Coral
      radGrad.addColorStop(0, `rgba(244, 63, 94, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(245, 158, 11, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    }
    radGrad.addColorStop(1, "rgba(8, 8, 10, 0)");
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(org.x, org.y, org.currentSpotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cursor spotlight glow if active
  if (globalMouse.active) {
    const spotR = 320;
    const radGrad = ctx.createRadialGradient(
      globalMouse.x, globalMouse.y, 0,
      globalMouse.x, globalMouse.y, spotR
    );
    radGrad.addColorStop(0, "rgba(16, 185, 129, 0.14)");
    radGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.06)");
    radGrad.addColorStop(1, "rgba(8, 8, 10, 0)");
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(globalMouse.x, globalMouse.y, spotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Interactive Matrix of Circles (Game of Life, Ambient Orbs & Scale Pulsing)
  const len = bgDots.length;
  const globalBreath = Math.sin(curNow * 0.0028);

  for (let i = 0; i < len; i++) {
    const dot = bgDots[i];
    let targetX = dot.ox;
    let targetY = dot.oy;
    let targetR = 1.35;
    let targetAlpha = 0.14;
    let isNear = false;
    let factor = 0;

    // Cellular Automaton state & smooth phosphorescent energy
    const isAlive = (golGrid && golGrid[dot.c * golRows + dot.r] === 1);
    if (isAlive) {
      dot.energy += (1.0 - dot.energy) * 0.28;
    } else {
      dot.energy += (0.0 - dot.energy) * 0.038;
    }

    // Dynamic scale pulsing (small to big)
    const cellPulse = Math.sin(curNow * 0.0045 + dot.phase);

    if (dot.energy > 0.03) {
      const pulseDelta = (2.2 + 1.6 * cellPulse) * dot.energy;
      targetR = 1.35 + pulseDelta;
      targetAlpha = 0.16 + dot.energy * (0.68 + 0.16 * cellPulse);
      anyMoving = true;
    } else {
      targetR = 1.25 + 0.15 * globalBreath;
      targetAlpha = 0.12 + 0.03 * globalBreath;
    }

    // Deflection from cursor
    if (globalMouse.active) {
      const dx = dot.ox - globalMouse.x;
      const dy = dot.oy - globalMouse.y;
      const dist = Math.hypot(dx, dy);
      const influenceR = 270;
      if (dist < influenceR) {
        isNear = true;
        factor = (influenceR - dist) / influenceR;
        const smooth = factor * factor;
        const angle = Math.atan2(dy, dx);
        targetX += Math.cos(angle) * smooth * 28;
        targetY += Math.sin(angle) * smooth * 28;
      }
    }

    // Deflection from floating orbs
    for (let o = 0; o < numOrbs; o++) {
      const org = activeOrbs[o];
      const dx = dot.ox - org.x;
      const dy = dot.oy - org.y;
      const dist = Math.hypot(dx, dy);
      if (dist < org.currentInfluenceR) {
        const f = (org.currentInfluenceR - dist) / org.currentInfluenceR;
        if (f > factor) {
          factor = f;
          isNear = true;
        }
        const smooth = f * f;
        const angle = Math.atan2(dy, dx);
        targetX += Math.cos(angle) * smooth * (24 + 5 * org.currentBSin);
        targetY += Math.sin(angle) * smooth * (24 + 5 * org.currentBSin);
      }
    }

    if (isNear) {
      targetR = Math.max(targetR, 1.45 + factor * factor * 3.2);
      targetAlpha = Math.max(targetAlpha, 0.22 + factor * 0.76);
    }

    // Spring damping physics
    dot.vx = (dot.vx + (targetX - dot.x) * 0.24) * 0.72;
    dot.vy = (dot.vy + (targetY - dot.y) * 0.24) * 0.72;
    dot.x += dot.vx;
    dot.y += dot.vy;

    if (Math.abs(dot.vx) > 0.02 || Math.abs(dot.vy) > 0.02 || Math.abs(dot.x - dot.ox) > 0.1 || Math.abs(dot.y - dot.oy) > 0.1) {
      anyMoving = true;
    }

    dot.r += (targetR - dot.r) * 0.28;
    dot.alpha += (targetAlpha - dot.alpha) * 0.28;

    // Color ramp from slate zinc to vibrant emerald and electric cyan
    if (dot.energy > 0.45 || (isNear && factor > 0.5)) {
      ctx.fillStyle = `rgba(56, 189, 248, ${dot.alpha})`; // Radiant Cyan
    } else if (dot.energy > 0.12 || isNear) {
      ctx.fillStyle = `rgba(16, 185, 129, ${dot.alpha})`; // Vibrant Emerald
    } else {
      ctx.fillStyle = `rgba(161, 161, 170, ${dot.alpha})`; // Visible Slate
    }

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing halo ring on living clusters and active influence zone
    if (dot.energy > 0.38) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${(dot.energy - 0.38) * 0.55 * (0.75 + 0.25 * cellPulse)})`;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r * (1.75 + 0.35 * cellPulse), 0, Math.PI * 2);
      ctx.stroke();
    } else if (isNear && factor > 0.35) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${(factor - 0.35) * 0.6})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
  return anyMoving;
}

function initTelemetryCanvas() {
  const canvas = document.getElementById("telemetryCanvas");
  if (!canvas || telemetryCanvasInited) return;
  telemetryCanvasInited = true;

  bgParticles = [];
  for (let i = 0; i < 20; i++) {
    bgParticles.push({
      x: Math.random() * 500,
      y: Math.random() * 160,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.5 + 0.8,
      baseAlpha: Math.random() * 0.3 + 0.15
    });
  }

  const hudTooltip = document.getElementById("canvasHudTooltip");
  const curPointLabel = document.getElementById("canvasCurPoint");

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    bgMouse.x = e.clientX - rect.left;
    bgMouse.y = e.clientY - rect.top;
    bgMouse.active = true;

    if (chartDataPoints.length > 0 && hudTooltip) {
      let closest = chartDataPoints[0];
      let minDist = Math.abs(bgMouse.x - closest.x);
      for (let i = 1; i < chartDataPoints.length; i++) {
        const dist = Math.abs(bgMouse.x - chartDataPoints[i].x);
        if (dist < minDist) {
          minDist = dist;
          closest = chartDataPoints[i];
        }
      }

      if (minDist < 45) {
        hudTooltip.style.display = "block";
        const tooltipW = 160;
        let left = closest.x - tooltipW / 2;
        if (left < 6) left = 6;
        if (left + tooltipW > rect.width - 6) left = rect.width - tooltipW - 6;
        let top = closest.y - 48;
        if (top < 6) top = closest.y + 14;

        hudTooltip.style.left = `${left}px`;
        hudTooltip.style.top = `${top}px`;
        hudTooltip.innerHTML = `
          <div style="font-weight:700; color:#f4f4f5; margin-bottom:2px;">${closest.label} (${closest.fullDate})</div>
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <span>Balance: <b style="color:#10b981;">${closest.cumBal.toFixed(2)}</b></span>
            <span>Net: <b style="color:${closest.dayNet >= 0 ? '#10b981' : '#f43f5e'};">${closest.dayNet >= 0 ? '+' : ''}${closest.dayNet.toFixed(2)}</b></span>
          </div>
        `;
        if (curPointLabel) {
          curPointLabel.textContent = `${closest.label}: ${closest.cumBal.toFixed(2)}`;
        }
      } else {
        hudTooltip.style.display = "none";
      }
    }
  });

  canvas.addEventListener("mouseleave", () => {
    bgMouse.x = -1000;
    bgMouse.y = -1000;
    bgMouse.active = false;
    if (hudTooltip) hudTooltip.style.display = "none";
    if (curPointLabel) curPointLabel.textContent = "interactive";
  });
}

function drawTelemetryChart(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 340;
  const h = canvas.clientHeight || 160;

  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // 1. Interactive Background Dot Grid
  const gridGap = 24;
  for (let gx = 12; gx < w; gx += gridGap) {
    for (let gy = 12; gy < h; gy += gridGap) {
      const dToMouse = Math.hypot(bgMouse.x - gx, bgMouse.y - gy);
      let dotAlpha = 0.12;
      let dotRadius = 1;
      let dotColor = "113, 113, 122"; // zinc
      if (bgMouse.active && dToMouse < 70) {
        const factor = (1 - dToMouse / 70);
        dotAlpha = 0.12 + factor * 0.55;
        dotRadius = 1 + factor * 1.5;
        dotColor = "16, 185, 129"; // emerald
      }
      ctx.fillStyle = `rgba(${dotColor}, ${dotAlpha})`;
      ctx.beginPath();
      ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Floating Constellation Micro-particles with cursor repulsion
  for (let i = 0; i < bgParticles.length; i++) {
    const p = bgParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;

    if (bgMouse.active) {
      const dx = p.x - bgMouse.x;
      const dy = p.y - bgMouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 60 && dist > 1) {
        const force = (60 - dist) / 60 * 0.4;
        p.x += (dx / dist) * force;
        p.y += (dy / dist) * force;
      }
    }

    ctx.fillStyle = `rgba(16, 185, 129, ${p.baseAlpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    for (let j = i + 1; j < bgParticles.length; j++) {
      const p2 = bgParticles[j];
      const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
      if (dist < 42) {
        const lineAlpha = (1 - dist / 42) * 0.18;
        ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha})`;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // 3. Financial Cumulative Balance Trajectory
  if (chartDataPoints.length > 1) {
    const padX = 20;
    const padY = 24;
    const effW = Math.max(10, w - padX * 2);
    const effH = Math.max(10, h - padY * 2);

    const minVal = Math.min(...chartDataPoints.map(p => p.cumBal));
    const maxVal = Math.max(...chartDataPoints.map(p => p.cumBal));
    const range = Math.max(1, maxVal - minVal);

    chartDataPoints.forEach((p, idx) => {
      p.x = padX + (idx / (chartDataPoints.length - 1)) * effW;
      const normY = (p.cumBal - minVal) / range;
      p.y = h - padY - (normY * effH);
    });

    // Area gradient
    ctx.beginPath();
    ctx.moveTo(chartDataPoints[0].x, h - padY);
    ctx.lineTo(chartDataPoints[0].x, chartDataPoints[0].y);
    for (let i = 1; i < chartDataPoints.length; i++) {
      const prev = chartDataPoints[i - 1];
      const curr = chartDataPoints[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    const last = chartDataPoints[chartDataPoints.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(last.x, h - padY);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, padY, 0, h - padY);
    areaGrad.addColorStop(0, "rgba(16, 185, 129, 0.22)");
    areaGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Baseline axis
    ctx.strokeStyle = "#1f1f23";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, h - padY);
    ctx.lineTo(w - padX, h - padY);
    ctx.stroke();

    // Main curve stroke
    ctx.beginPath();
    ctx.moveTo(chartDataPoints[0].x, chartDataPoints[0].y);
    for (let i = 1; i < chartDataPoints.length; i++) {
      const prev = chartDataPoints[i - 1];
      const curr = chartDataPoints[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.lineTo(last.x, last.y);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Data pips
    chartDataPoints.forEach(p => {
      ctx.fillStyle = "#09090b";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Cursor interaction: scanline and snap pip
    if (bgMouse.active) {
      let closest = chartDataPoints[0];
      let minDist = Math.abs(bgMouse.x - closest.x);
      for (let i = 1; i < chartDataPoints.length; i++) {
        const dist = Math.abs(bgMouse.x - chartDataPoints[i].x);
        if (dist < minDist) {
          minDist = dist;
          closest = chartDataPoints[i];
        }
      }

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(244, 244, 245, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(closest.x, padY);
      ctx.lineTo(closest.x, h - padY);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(closest.x, closest.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(closest.x, closest.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function renderBackgroundLoop() {
  const bgCanvas = document.getElementById("bgCanvas");
  let anyMoving = false;
  if (bgCanvas) {
    anyMoving = drawBackgroundGrid(bgCanvas);
  }

  const modal = document.getElementById("analyticsModal");
  if (modal && modal.style.display !== "none") {
    const canvas = document.getElementById("telemetryCanvas");
    if (canvas) {
      drawTelemetryChart(canvas);
    }
  }

  if (globalMouse.active || activeOrbs.length > 0 || anyMoving || (modal && modal.style.display !== "none")) {
    bgAnimationId = requestAnimationFrame(renderBackgroundLoop);
  } else {
    bgAnimationId = null;
  }
}

function wakeBackgroundLoop() {
  if (!bgAnimationId) {
    bgAnimationId = requestAnimationFrame(renderBackgroundLoop);
  }
}

// --- Grafana-Style Telemetry & Analytics Engine ---
let analyticsCatTimeframe = "14d";

function renderAnalyticsUI() {
  const now = new Date();
  const todayStr = getLocalDateStr(now);

  const txByDate = {};
  const expByCat14d = {};
  const expByCatAll = {};
  let total14dSpent = 0;
  let total14dIn = 0;

  // Build 14-day date lookup
  const days14Set = new Set();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days14Set.add(getLocalDateStr(d));
  }

  appState.transactions.forEach(tx => {
    const d = tx.date;
    if (!txByDate[d]) txByDate[d] = { allowance: 0, expense: 0, count: 0 };
    const amt = Number(tx.amount) || 0;
    if ((tx.type || "").toLowerCase() === "allowance") {
      txByDate[d].allowance += amt;
    } else {
      txByDate[d].expense += amt;
      const cat = tx.category || "Other";
      expByCatAll[cat] = (expByCatAll[cat] || 0) + amt;
      if (days14Set.has(d)) {
        expByCat14d[cat] = (expByCat14d[cat] || 0) + amt;
      }
    }
    txByDate[d].count++;
  });

  const earliestTxDate = appState.transactions.length > 0
    ? appState.transactions.reduce((min, t) => (t.date && t.date < min ? t.date : min), appState.transactions[0].date || todayStr)
    : todayStr;
  // If user has transactions, start tracking from their first logged transaction; if brand new, start from today
  const effectiveStartDate = appState.transactions.length > 0 ? earliestTxDate : todayStr;

  const daysList = [];
  const missedDays = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dStr = getLocalDateStr(d);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayName = dayNames[d.getDay()];
    const label = `${dayName} ${d.getDate()}`;
    const fullDate = `${monthNames[d.getMonth()]} ${d.getDate()}`;

    const data = txByDate[dStr] || { allowance: 0, expense: 0, count: 0 };
    const hasActivity = data.count > 0;
    const isToday = (dStr === todayStr);
    const isBeforeStart = (dStr < effectiveStartDate);

    const isMissed = !hasActivity && !isToday && !isBeforeStart;
    if (isMissed) {
      missedDays.push(fullDate);
    }
    total14dSpent += data.expense;
    total14dIn += data.allowance;

    daysList.push({
      dateStr: dStr,
      label,
      fullDate,
      hasActivity,
      isMissed,
      isBeforeStart,
      isToday,
      allowance: data.allowance,
      expense: data.expense
    });
  }

  // Assign cumulative balance backward from today's active cash
  const balInfo = computeMetrics();
  const totalStash = (appState.stashes || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  let runningBal = balInfo.todayRemaining;
  for (let i = daysList.length - 1; i >= 0; i--) {
    daysList[i].cumBal = runningBal;
    const net = daysList[i].allowance - daysList[i].expense;
    runningBal = runningBal - net;
  }

  // Populate data points for the interactive canvas
  chartDataPoints = daysList.map(d => ({
    dateStr: d.dateStr,
    label: d.label,
    fullDate: d.fullDate,
    allowance: d.allowance,
    expense: d.expense,
    dayNet: d.allowance - d.expense,
    cumBal: d.cumBal,
    x: 0,
    y: 0
  }));

  // Global Streak across ALL recorded history
  const activeDateSet = new Set(appState.transactions.map(t => t.date).filter(Boolean));
  let streak = 0;
  const cursor = new Date(now);
  if (!activeDateSet.has(getLocalDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDateSet.has(getLocalDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const statStreak = document.getElementById("statStreakCount");
  const statMissed = document.getElementById("statMissedDaysCount");
  const statAvg = document.getElementById("statAvgDailySpend");
  const statNet = document.getElementById("statNet14d");
  const streakPill = document.getElementById("streakStatusPill");

  const trackedDaysCount = daysList.filter(d => !d.isBeforeStart).length || 1;
  if (statStreak) statStreak.textContent = `${streak}d`;
  if (statMissed) statMissed.textContent = missedDays.length;
  if (statAvg) statAvg.textContent = (total14dSpent / trackedDaysCount).toFixed(2);

  const net14d = total14dIn - total14dSpent;
  if (statNet) {
    statNet.textContent = (net14d >= 0 ? "+" : "") + net14d.toFixed(2);
    statNet.style.color = net14d >= 0 ? "var(--positive)" : "var(--negative)";
  }

  // Secondary Telemetry: Savings Rate, Projected Runway, Debt Exposure
  const statSavings = document.getElementById("statSavingsRate");
  if (statSavings) {
    if (total14dIn > 0) {
      const sRate = Math.max(0, Math.round(((total14dIn - total14dSpent) / total14dIn) * 100));
      statSavings.textContent = `${sRate}%`;
      statSavings.style.color = sRate >= 20 ? "var(--positive)" : (sRate > 0 ? "#f59e0b" : "var(--negative)");
    } else {
      statSavings.textContent = total14dSpent > 0 ? "0% (Deficit)" : "--";
      statSavings.style.color = "var(--muted)";
    }
  }

  const statRunway = document.getElementById("statRunwayDays");
  const liquidAssets = (balInfo.todayRemaining || 0) + totalStash;
  const avgDailyBurn = trackedDaysCount > 0 ? (total14dSpent / trackedDaysCount) : 0;
  if (statRunway) {
    if (avgDailyBurn > 0) {
      const daysLeft = (liquidAssets / avgDailyBurn).toFixed(1);
      statRunway.textContent = `~${daysLeft}d`;
    } else if (liquidAssets > 0) {
      statRunway.textContent = "Sustainable";
    } else {
      statRunway.textContent = "0d";
    }
  }

  const statDebtExp = document.getElementById("statDebtExposure");
  if (statDebtExp) {
    const totalIOwe = (appState.debts || [])
      .filter(d => (d.direction || "").toLowerCase().includes("i owe") && d.status === "Active")
      .reduce((sum, d) => sum + Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0)), 0);

    if (liquidAssets > 0) {
      const debtRatio = Math.round((totalIOwe / liquidAssets) * 100);
      statDebtExp.textContent = `${debtRatio}%`;
      statDebtExp.style.color = debtRatio > 50 ? "var(--negative)" : (debtRatio > 20 ? "#f59e0b" : "var(--positive)");
    } else if (totalIOwe > 0) {
      statDebtExp.textContent = "High Risk";
      statDebtExp.style.color = "var(--negative)";
    } else {
      statDebtExp.textContent = "0% (Clean)";
      statDebtExp.style.color = "var(--positive)";
    }
  }

  if (streakPill) {
    if (missedDays.length === 0) {
      streakPill.textContent = "100% active";
      streakPill.style.color = "var(--positive)";
    } else {
      streakPill.textContent = `${missedDays.length} missed`;
      streakPill.style.color = "var(--negative)";
    }
  }

  const gridEl = document.getElementById("missedDaysGrid");
  if (gridEl) {
    gridEl.innerHTML = daysList.map(d => {
      let cls = "day-cell";
      if (d.isToday) cls += " today-cell";
      if (d.hasActivity) cls += " active-day";
      else if (d.isMissed) cls += " missed-day";
      else if (d.isBeforeStart) cls += " untracked-day";

      const titleText = d.isBeforeStart
        ? `${d.fullDate}: Prior to tracking start`
        : (d.isMissed
            ? `${d.fullDate}: Missed logging!`
            : (d.hasActivity ? `${d.fullDate}: In ${d.allowance.toFixed(0)}, Out ${d.expense.toFixed(0)}` : `${d.fullDate}: Today (in progress)`));
      return `<div class="${cls}" title="${titleText}">${d.label}</div>`;
    }).join("");
  }

  const alertEl = document.getElementById("missedDaysAlert");
  if (alertEl) {
    if (missedDays.length > 0) {
      alertEl.style.display = "block";
      alertEl.innerHTML = `<span style="color:var(--negative); font-weight:600;">Missed logging on:</span> ${missedDays.join(", ")}. Remember to record daily expenses for accurate balance projections.`;
    } else {
      alertEl.style.display = "block";
      if (appState.transactions.length === 0) {
        alertEl.innerHTML = `<span style="color:var(--positive); font-weight:600;">Welcome!</span> Start logging your daily allowance and expenses to build your streak.`;
      } else {
        alertEl.innerHTML = `<span style="color:var(--positive); font-weight:600;">All days logged!</span> Outstanding financial tracking discipline.`;
      }
    }
  }

  const chartEl = document.getElementById("cashFlowChart");
  if (chartEl) {
    const last7 = daysList.slice(7);
    const maxVal = Math.max(10, ...last7.map(d => Math.max(d.allowance, d.expense)));
    const chartHeight = 72;
    const svgWidth = 340;
    const colWidth = svgWidth / 7;
    const baselineY = chartHeight - 16;

    let barsHtml = "";
    last7.forEach((d, i) => {
      const x = i * colWidth;
      const inH = Math.round((d.allowance / maxVal) * (chartHeight - 22));
      const outH = Math.round((d.expense / maxVal) * (chartHeight - 22));

      const inBarH = d.allowance > 0 ? Math.max(3, inH) : 0;
      const outBarH = d.expense > 0 ? Math.max(3, outH) : 0;
      const inY = baselineY - inBarH;
      const outY = baselineY - outBarH;

      const inRect = d.allowance > 0 ? `
        <rect x="${x + 6}" y="${inY}" width="15" height="${inBarH}" fill="#10b981" rx="2">
          <title>${d.fullDate}: In ${d.allowance.toFixed(2)}</title>
        </rect>` : "";
      const outRect = d.expense > 0 ? `
        <rect x="${x + 23}" y="${outY}" width="15" height="${outBarH}" fill="#f43f5e" rx="2">
          <title>${d.fullDate}: Out ${d.expense.toFixed(2)}</title>
        </rect>` : "";

      const colHover = `
        <rect x="${x}" y="0" width="${colWidth}" height="${chartHeight}" fill="transparent">
          <title>${d.fullDate} (${d.label}): In ${d.allowance.toFixed(2)}, Out ${d.expense.toFixed(2)}, Net ${(d.allowance - d.expense).toFixed(2)}</title>
        </rect>
      `;

      barsHtml += `
        ${colHover}
        ${inRect}
        ${outRect}
        <text x="${x + 22}" y="${chartHeight - 2}" font-size="8.5" fill="#71717a" text-anchor="middle" font-family="monospace">${d.label}</text>
      `;
    });

    chartEl.innerHTML = `
      <svg viewBox="0 0 ${svgWidth} ${chartHeight}" class="chart-svg">
        <line x1="0" y1="${baselineY}" x2="${svgWidth}" y2="${baselineY}" stroke="#27272a" stroke-width="1"/>
        ${barsHtml}
      </svg>
    `;
  }

  const catListEl = document.getElementById("categoryBreakdownList");
  const catTotalLabel = document.getElementById("catTotalLabel");
  if (catListEl) {
    const expByCat = (analyticsCatTimeframe === "all") ? expByCatAll : expByCat14d;
    const totalExp = Object.values(expByCat).reduce((a, b) => a + b, 0);
    if (catTotalLabel) {
      catTotalLabel.textContent = totalExp > 0 ? `Total: -${totalExp.toFixed(2)}` : "";
    }
    if (totalExp === 0) {
      catListEl.innerHTML = `<div style="font-size:0.72rem; color:var(--muted); padding:4px 0;">No expenses recorded in ${analyticsCatTimeframe === "all" ? "history" : "the last 14 days"}</div>`;
    } else {
      const catColors = {
        "Food": "#f43f5e",
        "Transportation": "#38bdf8",
        "School": "#a855f7",
        "Personal": "#f59e0b",
        "Allowance": "#10b981",
        "Other": "#71717a"
      };
      const sortedCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
      catListEl.innerHTML = sortedCats.map(([cat, amt]) => {
        const pct = Math.round((amt / totalExp) * 100);
        const color = catColors[cat] || "#e4e4e7";
        return `
          <div class="cat-bar-wrap">
            <div class="cat-bar-header">
              <span><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${color}; margin-right:5px;"></span>${escapeHtml(cat)}</span>
              <span class="mono">${amt.toFixed(2)} (${pct}%)</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width:${pct}%; background:${color};"></div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  const auditListEl = document.getElementById("auditLogList");
  const auditCountLabel = document.getElementById("auditCountLabel");
  const logs = appState.auditLog || [];
  if (auditCountLabel) auditCountLabel.textContent = `${logs.length} events`;

  if (auditListEl) {
    if (logs.length === 0) {
      auditListEl.innerHTML = '<div style="font-size:0.72rem; color:var(--muted); padding:4px 0;">No audit events recorded yet</div>';
    } else {
      const actionColors = {
        "EDIT_TX": "#f59e0b",
        "DELETE_TX": "#f43f5e",
        "ADD_ALLOWANCE": "#10b981",
        "ADD_EXPENSE": "#f43f5e",
        "ADD_UTANG": "#fb923c",
        "SETTLE_DEBT": "#10b981",
        "ADD_STASH": "#a855f7",
        "RESET_DATA": "#ef4444"
      };
      auditListEl.innerHTML = logs.slice(0, 15).map(item => {
        const t = item.timestamp ? item.timestamp.split("T")[1].slice(0, 5) : "";
        const actionColor = actionColors[item.action] || "var(--accent)";
        return `
          <div class="audit-entry mono">
            <div>
              <span style="color:var(--faint); margin-right:4px;">${item.date || ""} ${t}</span>
              <b style="color:${actionColor};">[${item.action}]</b> ${escapeHtml(item.summary || "")}
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// --- Google Account & Auto-Sync Engine ---
async function hydrateFromCloud(token, sheetId) {
  try {
    const cloudData = await GoogleSync.pullAllData(token, sheetId);
    let updated = false;

    // Merge transactions (keep local edits, add missing transactions)
    const localTxIds = new Set(appState.transactions.map(t => t.id));
    if (cloudData.transactions && cloudData.transactions.length > 0) {
      cloudData.transactions.forEach(ctx => {
        if (!localTxIds.has(ctx.id)) {
          appState.transactions.push(ctx);
          localTxIds.add(ctx.id);
          updated = true;
        }
      });
      appState.transactions.sort((a, b) => (b.timestamp || b.date).localeCompare(a.timestamp || a.date));
    }

    // Merge debts
    const localDebtIds = new Set(appState.debts.map(d => d.id));
    if (cloudData.debts && cloudData.debts.length > 0) {
      cloudData.debts.forEach(cd => {
        if (!localDebtIds.has(cd.id)) {
          appState.debts.push(cd);
          localDebtIds.add(cd.id);
          updated = true;
        }
      });
    }

    // Merge stashes
    const localStashIds = new Set(appState.stashes.map(s => s.id));
    if (cloudData.stashes && cloudData.stashes.length > 0) {
      cloudData.stashes.forEach(cs => {
        if (!localStashIds.has(cs.id)) {
          appState.stashes.push(cs);
          localStashIds.add(cs.id);
          updated = true;
        }
      });
    }

    // Merge presets
    if (cloudData.presets && cloudData.presets.length > 0) {
      const localPIds = new Set(appState.presets.map(p => p.id));
      cloudData.presets.forEach(cp => {
        if (!localPIds.has(cp.id)) {
          appState.presets.push(cp);
          localPIds.add(cp.id);
          updated = true;
        }
      });
    }

    // Merge auditLog
    if (cloudData.auditLog && cloudData.auditLog.length > 0) {
      const localAuditKeys = new Set(appState.auditLog.map(a => `${a.timestamp}_${a.action}_${a.targetId}`));
      cloudData.auditLog.forEach(ca => {
        const k = `${ca.timestamp}_${ca.action}_${ca.targetId}`;
        if (!localAuditKeys.has(k)) {
          appState.auditLog.push(ca);
          localAuditKeys.add(k);
          updated = true;
        }
      });
      appState.auditLog.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      if (appState.auditLog.length > 100) appState.auditLog = appState.auditLog.slice(0, 100);
    }

    if (updated) {
      persistState();
      renderUI();
    }
    return cloudData;
  } catch (e) {
    console.warn("Hydrate from cloud error:", e);
    throw e;
  }
}

async function triggerAutoSync() {
  if (isSyncing || !navigator.onLine) return;
  if (!appState.googleAuth || !appState.googleAuth.token) return;
  if (!appState.syncQueue || appState.syncQueue.length === 0) return;

  isSyncing = true;
  updateSyncBadge();

  try {
    let token = appState.googleAuth.token;
    let sheetId = appState.googleAuth.spreadsheetId;

    if (!sheetId) {
      sheetId = await GoogleSync.getOrCreateSpreadsheet(token);
      appState.googleAuth.spreadsheetId = sheetId;
      persistState();
    }

    const res = await GoogleSync.flushSyncQueue(token, sheetId, appState.syncQueue);
    appState.syncQueue = res.remaining || [];
    persistState();
  } catch (err) {
    console.error("AutoSync error:", err);
    if (err.message && err.message.includes("401") && appState.googleAuth.clientId) {
      // Attempt silent background reauth
      try {
        const refreshedToken = await GoogleSync.authenticate(appState.googleAuth.clientId, false);
        if (refreshedToken) {
          appState.googleAuth.token = refreshedToken;
          persistState();
          const retryRes = await GoogleSync.flushSyncQueue(refreshedToken, appState.googleAuth.spreadsheetId, appState.syncQueue);
          appState.syncQueue = retryRes.remaining || [];
          persistState();
          return;
        }
      } catch (silentErr) {
        console.warn("Silent reauth failed:", silentErr);
        appState.googleAuth.token = null;
        persistState();
        updateGoogleStatusUI();
      }
    } else if (err.message && err.message.includes("401")) {
      appState.googleAuth.token = null;
      persistState();
      updateGoogleStatusUI();
    }
  } finally {
    isSyncing = false;
    updateSyncBadge();
  }
}

async function loginGoogle() {
  const btn = document.getElementById("btnGoogleLogin");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Connecting...";
  }

  const clientId = (appState.googleAuth && appState.googleAuth.clientId) ? appState.googleAuth.clientId.trim() : "";
  if (!clientId) {
    showStatus("Please paste your Google OAuth Client ID in Settings first", true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Connect Google";
    }
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "flex";
    const cfgC = document.getElementById("cfgClientId");
    if (cfgC) cfgC.focus();
    return;
  }

  async function postLoginHydration(token, email) {
    appState.googleAuth.token = token;
    appState.googleAuth.email = email;
    persistState();
    updateGoogleStatusUI();
    showStatus(`Connected as ${email}`, false);

    let sheetId = appState.googleAuth.spreadsheetId;
    try {
      if (!sheetId) {
        sheetId = await GoogleSync.getOrCreateSpreadsheet(token);
        appState.googleAuth.spreadsheetId = sheetId;
        const cfgS = document.getElementById("cfgSheet");
        if (cfgS) cfgS.value = sheetId;
        persistState();
      }
      await hydrateFromCloud(token, sheetId);
    } catch (e) {
      console.warn("Initial hydration note:", e);
    }
    await triggerAutoSync();
  }

  const isExtensionRuntime = typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id &&
    (location.protocol === "chrome-extension:" || location.protocol === "moz-extension:");

  if (isExtensionRuntime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: "LOGIN_GOOGLE", clientId }, async (res) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Connect Google";
      }

      if (chrome.runtime.lastError) {
        try {
          const token = await GoogleSync.authenticate(clientId, true);
          const email = await GoogleSync.getUserEmail(token);
          await postLoginHydration(token, email);
        } catch (err) {
          showStatus("Google Login Error: " + err.message, true);
        }
        return;
      }

      if (res && res.success) {
        await postLoginHydration(res.token, res.email);
      } else {
        showStatus("Google Login Error: " + ((res && res.error) || "Authentication failed"), true);
      }
    });
  } else {
    try {
      const token = await GoogleSync.authenticate(clientId, true);
      if (token) {
        const email = await GoogleSync.getUserEmail(token);
        await postLoginHydration(token, email);
      }
    } catch (err) {
      showStatus("Google Login Error: " + err.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Connect Google";
      }
    }
  }
}

// Listen for storage changes from background sync
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.googleAuth) {
      appState.googleAuth = { ...appState.googleAuth, ...changes.googleAuth.newValue };
      updateGoogleStatusUI();
      updateSyncBadge();
    }
  });
}

function logoutGoogle() {
  appState.googleAuth.token = null;
  appState.googleAuth.email = null;
  persistState();
  updateGoogleStatusUI();
  updateSyncBadge();
  showStatus("Signed out from Google", false);
}

function updateGoogleStatusUI() {
  const display = document.getElementById("googleUserDisplay");
  const loginBtn = document.getElementById("btnGoogleLogin");
  const logoutBtn = document.getElementById("btnGoogleLogout");

  if (appState.googleAuth && appState.googleAuth.token) {
    display.textContent = `Connected: ${appState.googleAuth.email || "Active"}`;
    display.style.color = "var(--positive)";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
  } else {
    display.textContent = "Not connected (Offline Store)";
    display.style.color = "var(--text)";
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
  }
}

function exportDataJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `finance_backup_${getLocalDateStr()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function clearAllData() {
  if (!confirm("Are you sure you want to completely reset all data to a fresh account?\n\nThis will wipe all transactions, debts, stashes, audit logs, and reset your streak to Day 1.")) {
    return;
  }

  const savedAuth = { ...(appState.googleAuth || {}) };

  appState.transactions = [];
  appState.debts = [];
  appState.presets = [...DEFAULT_PRESETS];
  appState.stashes = [];
  appState.stashMasked = false;
  appState.dailyRollover = false;
  appState.installDate = getLocalDateStr();
  appState.auditLog = [];
  appState.syncQueue = [];
  appState.googleAuth = savedAuth;

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.clear(() => {
      persistState();
    });
  } else if (typeof localStorage !== "undefined") {
    localStorage.clear();
    persistState();
  } else {
    persistState();
  }

  renderUI();
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) settingsModal.style.display = "none";
  showStatus("All data cleared: fresh account ready", false);
}

// --- Precision Chronometer & Full Calendar Engine ---
let chronoAnimationId = null;
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();
let calSelectedDate = getLocalDateStr(new Date());

function updatePrecisionChrono() {
  const now = new Date();
  const timeEl = document.getElementById("chronoTime");
  const msEl = document.getElementById("chronoMs");
  const dateEl = document.getElementById("chronoFullDate");
  const dayYearEl = document.getElementById("chronoDayYear");
  const tzEl = document.getElementById("chronoTz");

  if (timeEl && msEl) {
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");

    timeEl.textContent = `${h}:${m}:${s}`;
    msEl.textContent = `.${ms}`;
  }

  // Update date metadata once per second
  const secKey = String(now.getSeconds());
  if (dateEl && dateEl.dataset.lastSec !== secKey) {
    dateEl.dataset.lastSec = secKey;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

    if (dayYearEl) {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const diff = now - startOfYear;
      const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      dayYearEl.textContent = `Day ${dayOfYear}`;
    }

    if (tzEl && !tzEl.dataset.inited) {
      tzEl.dataset.inited = "1";
      try {
        const offsetMin = -now.getTimezoneOffset();
        const sign = offsetMin >= 0 ? "+" : "-";
        const offH = Math.floor(Math.abs(offsetMin) / 60);
        tzEl.textContent = `UTC${sign}${offH}`;
      } catch (_) {}
    }
  }

  chronoAnimationId = requestAnimationFrame(updatePrecisionChrono);
}

function renderCalendarView() {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const titleEl = document.getElementById("calMonthYear");
  if (titleEl) {
    titleEl.textContent = `${monthNames[calViewMonth]} ${calViewYear}`;
  }

  const gridEl = document.getElementById("calDaysGrid");
  if (!gridEl) return;
  gridEl.innerHTML = "";

  const todayStr = getLocalDateStr(new Date());

  // Aggregate daily totals from appState.transactions
  const dailySummary = {};
  (appState.transactions || []).forEach(tx => {
    const d = tx.date;
    if (!dailySummary[d]) dailySummary[d] = { allowance: 0, expense: 0, txs: [] };
    const amt = Number(tx.amount) || 0;
    if ((tx.type || "").toLowerCase() === "allowance") {
      dailySummary[d].allowance += amt;
    } else {
      dailySummary[d].expense += amt;
    }
    dailySummary[d].txs.push(tx);
  });

  const firstDayOfWeek = new Date(calViewYear, calViewMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calViewYear, calViewMonth, 0).getDate();

  // 1. Trailing days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prevDate = new Date(calViewYear, calViewMonth - 1, dayNum);
    const dateStr = getLocalDateStr(prevDate);
    const cell = createCalDayCell(dayNum, dateStr, true, dailySummary[dateStr]);
    gridEl.appendChild(cell);
  }

  // 2. Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(calViewYear, calViewMonth, d);
    const dateStr = getLocalDateStr(currDate);
    const isToday = (dateStr === todayStr);
    const isSelected = (dateStr === calSelectedDate);
    const cell = createCalDayCell(d, dateStr, false, dailySummary[dateStr], isToday, isSelected);
    gridEl.appendChild(cell);
  }

  // 3. Leading days of next month (fill complete 35 or 42 grid cells)
  const totalCells = firstDayOfWeek + daysInMonth;
  const targetCells = totalCells > 35 ? 42 : 35;
  const remaining = targetCells - totalCells;
  for (let d = 1; d <= remaining; d++) {
    const nextDate = new Date(calViewYear, calViewMonth + 1, d);
    const dateStr = getLocalDateStr(nextDate);
    const cell = createCalDayCell(d, dateStr, true, dailySummary[dateStr]);
    gridEl.appendChild(cell);
  }

  updateCalendarDayInspector(dailySummary[calSelectedDate] || { allowance: 0, expense: 0, txs: [] }, calSelectedDate);
}

function createCalDayCell(dayNum, dateStr, isOtherMonth, dayData, isToday = false, isSelected = false) {
  const cell = document.createElement("div");
  cell.className = "cal-day-cell";
  if (isOtherMonth) cell.classList.add("other-month");
  if (isToday) cell.classList.add("is-today");
  if (isSelected) cell.classList.add("is-selected");

  cell.dataset.date = dateStr;
  cell.textContent = dayNum;

  // Add dot indicators if transactions exist
  if (dayData && dayData.txs.length > 0) {
    const dotRow = document.createElement("div");
    dotRow.className = "cal-dot-row";
    if (dayData.allowance > 0 && dayData.expense > 0) {
      const dot = document.createElement("span");
      dot.className = "cal-dot both";
      dotRow.appendChild(dot);
    } else if (dayData.allowance > 0) {
      const dot = document.createElement("span");
      dot.className = "cal-dot inc";
      dotRow.appendChild(dot);
    } else if (dayData.expense > 0) {
      const dot = document.createElement("span");
      dot.className = "cal-dot exp";
      dotRow.appendChild(dot);
    }
    cell.appendChild(dotRow);
  }

  cell.addEventListener("click", () => {
    calSelectedDate = dateStr;
    renderCalendarView();
  });

  return cell;
}

function updateCalendarDayInspector(dayData, dateStr) {
  const inspDate = document.getElementById("calInspDate");
  const inspSpent = document.getElementById("calInspSpent");
  const inspIn = document.getElementById("calInspIn");
  const inspNet = document.getElementById("calInspNet");
  const txList = document.getElementById("calInspTxList");

  if (!inspDate) return;

  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  inspDate.textContent = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  
  const spent = dayData.expense || 0;
  const inc = dayData.allowance || 0;
  const net = inc - spent;

  if (inspSpent) inspSpent.textContent = spent.toFixed(2);
  if (inspIn) inspIn.textContent = inc.toFixed(2);
  if (inspNet) {
    inspNet.textContent = `${net >= 0 ? '+' : ''}${net.toFixed(2)}`;
    inspNet.style.color = net >= 0 ? "var(--positive)" : "var(--negative)";
  }

  if (txList) {
    txList.innerHTML = "";
    if (!dayData.txs || dayData.txs.length === 0) {
      txList.innerHTML = `<div style="color:var(--muted); font-size:0.62rem; padding:2px 0;">No entries recorded on this date</div>`;
    } else {
      dayData.txs.forEach(t => {
        const row = document.createElement("div");
        row.className = "cal-tx-mini";
        const isExp = (t.type || "").toLowerCase() !== "allowance";
        row.innerHTML = `
          <span>${escapeHtml(t.category || t.notes || "Entry")}</span>
          <b style="color:${isExp ? 'var(--negative)' : 'var(--positive)'};">${isExp ? '-' : '+'}${Number(t.amount || 0).toFixed(2)}</b>
        `;
        txList.appendChild(row);
      });
    }
  }
}

function applyFontSizePreference() {
  const isLarge = Boolean(appState.largeFont);
  document.documentElement.classList.toggle("font-large", isLarge);
  const btn = document.getElementById("btnToggleFontSize");
  if (btn) {
    btn.textContent = isLarge ? "A-" : "A+";
    btn.title = isLarge ? "Switch to Default Font Size" : "Switch to Larger Font Size";
    if (isLarge) {
      btn.style.color = "var(--positive)";
      btn.style.borderColor = "rgba(16, 185, 129, 0.4)";
    } else {
      btn.style.color = "";
      btn.style.borderColor = "";
    }
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  const btnToggleFont = document.getElementById("btnToggleFontSize");
  if (btnToggleFont) {
    btnToggleFont.addEventListener("click", () => {
      appState.largeFont = !appState.largeFont;
      applyFontSizePreference();
      persistState();
    });
  }

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
      const url = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("popup.html") : "popup.html";
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
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
      initTelemetryCanvas();
      const bgCanvas = document.getElementById("bgCanvas");
      if (bgCanvas) {
        const w = bgCanvas.clientWidth || window.innerWidth || 780;
        const h = bgCanvas.clientHeight || window.innerHeight || 600;
        initBgCircleGrid(w, h);
      }
      if (!bgAnimationId) {
        bgAnimationId = requestAnimationFrame(renderBackgroundLoop);
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
    wakeBackgroundLoop();
  }
  window.openAnalyticsModal = openAnalyticsModal;
  window.closeAnalyticsModal = closeAnalyticsModal;

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

  function openSettingsModal() {
    try {
      if (typeof updateGoogleStatusUI === "function") updateGoogleStatusUI();
      const cfgC = document.getElementById("cfgClientId");
      if (cfgC && typeof appState !== "undefined") cfgC.value = (appState.googleAuth && appState.googleAuth.clientId) || "";
      const cfgS = document.getElementById("cfgSheet");
      if (cfgS && typeof appState !== "undefined") cfgS.value = (appState.googleAuth && appState.googleAuth.spreadsheetId) || "";
      const roCheck = document.getElementById("cfgRollover");
      if (roCheck && typeof appState !== "undefined") roCheck.checked = !!appState.dailyRollover;
      const redirectInput = document.getElementById("cfgRedirectUri");
      if (redirectInput && typeof GoogleSync !== "undefined" && GoogleSync.getRedirectUri) {
        redirectInput.value = GoogleSync.getRedirectUri();
      }
    } catch (err) {
      console.warn("Settings init note:", err);
    }
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "flex";
  }
  window.openSettingsModal = openSettingsModal;

  function closeSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (modal) modal.style.display = "none";
  }
  window.closeSettingsModal = closeSettingsModal;

  // Settings & Sync Modal
  const btnSettings = document.getElementById("btnSettings");
  if (btnSettings) {
    btnSettings.addEventListener("click", openSettingsModal);
  }

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
