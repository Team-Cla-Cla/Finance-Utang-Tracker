// Shared presentation state and browser persistence adapter.
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
  disableBgAnimation: null,
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
    chrome.storage.local.get(["transactions", "debts", "presets", "stashes", "stashMasked", "dailyRollover", "largeFont", "disableBgAnimation", "installDate", "auditLog", "syncQueue", "googleAuth"], function(res) {
      if (res.transactions) appState.transactions = res.transactions;
      if (res.debts) appState.debts = res.debts;
      if (res.presets) appState.presets = res.presets;
      if (res.stashes) appState.stashes = res.stashes;
      if (typeof res.stashMasked === "boolean") appState.stashMasked = res.stashMasked;
      if (typeof res.dailyRollover === "boolean") appState.dailyRollover = res.dailyRollover;
      if (typeof res.largeFont === "boolean") appState.largeFont = res.largeFont;
      if (typeof res.disableBgAnimation === "boolean") appState.disableBgAnimation = res.disableBgAnimation;
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
    function safeParse(val, fallback) {
      if (!val) return fallback;
      try {
        const parsed = JSON.parse(val);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
      } catch (_) {
        return fallback;
      }
    }

    const t = localStorage.getItem("transactions");
    const d = localStorage.getItem("debts");
    const p = localStorage.getItem("presets");
    const s = localStorage.getItem("stashes");
    const sm = localStorage.getItem("stashMasked");
    const ro = localStorage.getItem("dailyRollover");
    const lf = localStorage.getItem("largeFont");
    const da = localStorage.getItem("disableBgAnimation");
    const idt = localStorage.getItem("installDate");
    const al = localStorage.getItem("auditLog");
    const q = localStorage.getItem("syncQueue");
    const a = localStorage.getItem("googleAuth");

    if (t) appState.transactions = safeParse(t, appState.transactions);
    if (d) appState.debts = safeParse(d, appState.debts);
    if (p) appState.presets = safeParse(p, appState.presets);
    if (s) appState.stashes = safeParse(s, appState.stashes);
    if (sm) appState.stashMasked = safeParse(sm, appState.stashMasked);
    if (ro) appState.dailyRollover = safeParse(ro, appState.dailyRollover);
    if (lf) appState.largeFont = safeParse(lf, appState.largeFont);
    if (da !== null && da !== undefined) appState.disableBgAnimation = safeParse(da, appState.disableBgAnimation);
    if (idt) appState.installDate = safeParse(idt, null);
    if (!appState.installDate) {
      appState.installDate = getLocalDateStr();
      try {
        localStorage.setItem("installDate", JSON.stringify(appState.installDate));
      } catch (_) {}
    }
    if (al) appState.auditLog = safeParse(al, appState.auditLog);
    if (q) appState.syncQueue = safeParse(q, appState.syncQueue);
    if (a) appState.googleAuth = safeParse(a, appState.googleAuth);
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
      disableBgAnimation: appState.disableBgAnimation,
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
    localStorage.setItem("disableBgAnimation", JSON.stringify(appState.disableBgAnimation));
    localStorage.setItem("installDate", JSON.stringify(appState.installDate));
    localStorage.setItem("auditLog", JSON.stringify(appState.auditLog));
    localStorage.setItem("syncQueue", JSON.stringify(appState.syncQueue));
    localStorage.setItem("googleAuth", JSON.stringify(appState.googleAuth));
  }
}

