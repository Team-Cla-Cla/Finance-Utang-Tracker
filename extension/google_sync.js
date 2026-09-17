// google_sync.js - Direct Google Sheets API v4 & OAuth 2.0 Integration

const GoogleSync = (function() {
  const DEFAULT_CLIENT_ID = "26981ed0d57bbad37e728ff58134270c"; // Configurable in settings
  const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  function getRedirectUri() {
    if (typeof browser !== "undefined" && browser.identity && browser.identity.getRedirectURL) {
      return browser.identity.getRedirectURL();
    }
    if (typeof chrome !== "undefined" && chrome.identity && chrome.identity.getRedirectURL) {
      return chrome.identity.getRedirectURL();
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      return "https://" + chrome.runtime.id + ".chromiumapp.org/";
    }
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin + window.location.pathname;
    }
    return "https://extension.chromiumapp.org/";
  }

  function extractSpreadsheetId(input) {
    if (!input || typeof input !== "string") return "";
    const str = input.trim();
    const match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    return str;
  }

  // Sanitize values starting with =, +, -, @ to prevent formula injection in Sheets
  function sanitizeVal(val) {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("=") || trimmed.startsWith("+") || trimmed.startsWith("-") || trimmed.startsWith("@")) {
        return "'" + val;
      }
    }
    return val;
  }

  // Parse amount strictly handling integers, decimals, commas, currency strings, and precision rounding
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

  function extractTokenFromUrl(url) {
    if (!url) throw new Error("No response URL received from authentication provider.");
    const match = url.match(/[#&]access_token=([^&]+)/);
    if (match && match[1]) {
      return match[1];
    }
    const errMatch = url.match(/[#&]error=([^&]+)/);
    if (errMatch) {
      throw new Error(decodeURIComponent(errMatch[1]));
    }
    throw new Error("Failed to obtain access token from response URL.");
  }

  // Cross-browser OAuth flow (Chrome, Firefox & Standalone Web)
  async function authenticate(clientId, interactive = true) {
    const cId = clientId ? clientId.trim() : DEFAULT_CLIENT_ID;
    const redirectUri = getRedirectUri();

    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
      "client_id=" + encodeURIComponent(cId) +
      "&response_type=token" +
      "&redirect_uri=" + encodeURIComponent(redirectUri) +
      "&scope=" + encodeURIComponent(SCOPES.join(" ")) +
      "&prompt=" + (interactive ? "select_account" : "none");

    // 1. Firefox WebExtensions (native Promise)
    if (typeof browser !== "undefined" && browser.identity && browser.identity.launchWebAuthFlow) {
      try {
        const responseUrl = await browser.identity.launchWebAuthFlow({ url: authUrl, interactive });
        return extractTokenFromUrl(responseUrl);
      } catch (err) {
        throw new Error(err.message || "Authentication cancelled.");
      }
    }

    // 2. Chromium Extensions (callback-based)
    if (typeof chrome !== "undefined" && chrome.identity && chrome.identity.launchWebAuthFlow) {
      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, function(responseUrl) {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          try {
            resolve(extractTokenFromUrl(responseUrl));
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    // 3. Standalone Web / Mobile Mode (redirect flow)
    if (typeof window !== "undefined" && window.location) {
      window.location.href = authUrl;
      return new Promise(() => {}); // Wait for page navigation
    }

    throw new Error("OAuth identity flow not supported in this environment.");
  }

  // Get user profile email
  async function getUserEmail(token) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const info = await res.json();
        return info.email || "Connected";
      }
    } catch (e) {
      console.warn("Could not fetch user email", e);
    }
    return "Connected";
  }

  // Find existing sheet or create a brand new one
  async function getOrCreateSpreadsheet(token, customSheetId) {
    if (customSheetId) {
      const cleanId = extractSpreadsheetId(customSheetId);
      // Verify access
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=spreadsheetId,properties.title`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        return cleanId;
      }
      throw new Error(`Cannot access sheet ${cleanId}. Make sure it is shared or owned by your Google Account.`);
    }

    // Auto-create "Personal Finance Ledger"
    const createPayload = {
      properties: { title: "Personal Finance Ledger" },
      sheets: [
        {
          properties: { title: "Transactions" },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{
              values: [
                { userEnteredValue: { stringValue: "ID" } },
                { userEnteredValue: { stringValue: "Timestamp" } },
                { userEnteredValue: { stringValue: "Date" } },
                { userEnteredValue: { stringValue: "Type" } },
                { userEnteredValue: { stringValue: "Category" } },
                { userEnteredValue: { stringValue: "Amount" } },
                { userEnteredValue: { stringValue: "Notes" } }
              ]
            }]
          }]
        },
        {
          properties: { title: "Debts" },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{
              values: [
                { userEnteredValue: { stringValue: "ID" } },
                { userEnteredValue: { stringValue: "Timestamp" } },
                { userEnteredValue: { stringValue: "Date" } },
                { userEnteredValue: { stringValue: "Person" } },
                { userEnteredValue: { stringValue: "Direction" } },
                { userEnteredValue: { stringValue: "Amount" } },
                { userEnteredValue: { stringValue: "PaidAmount" } },
                { userEnteredValue: { stringValue: "Status" } },
                { userEnteredValue: { stringValue: "Notes" } }
              ]
            }]
          }]
        },
        {
          properties: { title: "Presets" },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{
              values: [
                { userEnteredValue: { stringValue: "ID" } },
                { userEnteredValue: { stringValue: "Label" } },
                { userEnteredValue: { stringValue: "Amount" } },
                { userEnteredValue: { stringValue: "Category" } },
                { userEnteredValue: { stringValue: "Note" } },
                { userEnteredValue: { stringValue: "Type" } }
              ]
            }]
          }]
        },
        {
          properties: { title: "Stashes" },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{
              values: [
                { userEnteredValue: { stringValue: "ID" } },
                { userEnteredValue: { stringValue: "Timestamp" } },
                { userEnteredValue: { stringValue: "Date" } },
                { userEnteredValue: { stringValue: "Amount" } },
                { userEnteredValue: { stringValue: "Note" } },
                { userEnteredValue: { stringValue: "Status" } }
              ]
            }]
          }]
        },
        {
          properties: { title: "AuditLog" },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{
              values: [
                { userEnteredValue: { stringValue: "Timestamp" } },
                { userEnteredValue: { stringValue: "Action" } },
                { userEnteredValue: { stringValue: "TargetID" } },
                { userEnteredValue: { stringValue: "Summary" } },
                { userEnteredValue: { stringValue: "Date" } }
              ]
            }]
          }]
        }
      ]
    };

    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createPayload)
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Google Spreadsheet: ${err}`);
    }

    const created = await createRes.json();
    return created.spreadsheetId;
  }

  // Append a transaction row directly via Sheets API v4
  async function appendTransaction(token, sheetId, tx) {
    const range = "Transactions!A:G";
    const body = {
      values: [[
        tx.id,
        tx.timestamp || new Date().toISOString(),
        tx.date,
        tx.type,
        sanitizeVal(tx.category),
        Number(tx.amount),
        sanitizeVal(tx.notes || "")
      ]]
    };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets API Append Error: ${err}`);
    }
    return res.json();
  }

  // Append a debt row directly via Sheets API v4
  async function appendDebt(token, sheetId, debt) {
    const range = "Debts!A:I";
    const body = {
      values: [[
        debt.id,
        debt.timestamp || new Date().toISOString(),
        debt.date,
        sanitizeVal(debt.person),
        debt.direction,
        Number(debt.amount),
        Number(debt.paid || 0),
        debt.status || "Active",
        sanitizeVal(debt.notes || "")
      ]]
    };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets API Debt Append Error: ${err}`);
    }
    return res.json();
  }

  // Append an audit log row via Sheets API v4
  async function appendAuditLog(token, sheetId, logItem) {
    const range = "AuditLog!A:E";
    const body = {
      values: [[
        logItem.timestamp || new Date().toISOString(),
        logItem.action || "EVENT",
        logItem.targetId || "",
        sanitizeVal(logItem.summary || ""),
        logItem.date || ""
      ]]
    };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("AuditLog append warning:", err);
    }
    return res.ok ? res.json() : null;
  }

  // Append a stash record via Sheets API v4
  async function appendStash(token, sheetId, stashItem) {
    const range = "Stashes!A:F";
    const body = {
      values: [[
        stashItem.id,
        stashItem.timestamp || new Date().toISOString(),
        stashItem.date,
        Number(stashItem.amount),
        sanitizeVal(stashItem.note || "Reserve"),
        stashItem.status || "Active"
      ]]
    };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("Stashes append warning:", err);
    }
    return res.ok ? res.json() : null;
  }

  // Update existing transaction in Sheets API v4
  async function updateTransaction(token, sheetId, tx) {
    if (!tx || !tx.id) return;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Transactions!A:A`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return appendTransaction(token, sheetId, tx);
    const data = await res.json();
    const rows = data.values || [];
    const rowIndex = rows.findIndex(r => r && r[0] === tx.id);
    if (rowIndex === -1) {
      return appendTransaction(token, sheetId, tx);
    }
    const rowNum = rowIndex + 1;
    const range = `Transactions!A${rowNum}:G${rowNum}`;
    const body = {
      values: [[
        tx.id,
        tx.timestamp || new Date().toISOString(),
        tx.date,
        tx.type,
        sanitizeVal(tx.category),
        Number(tx.amount),
        sanitizeVal(tx.notes || "")
      ]]
    };
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  // Update debt status and paid amount in Sheets API v4
  async function updateDebtStatus(token, sheetId, data) {
    if (!data || !data.id) return;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Debts!A:A`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const resData = await res.json();
    const rows = resData.values || [];
    const rowIndex = rows.findIndex(r => r && r[0] === data.id);
    if (rowIndex === -1) return;
    const rowNum = rowIndex + 1;
    const range = `Debts!G${rowNum}:H${rowNum}`;
    const body = {
      values: [[
        Number(data.newPaid),
        data.status || "Active"
      ]]
    };
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  // Clear deleted row by ID from sheet
  async function deleteRowById(token, sheetId, sheetName, id) {
    if (!id) return;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:A`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const resData = await res.json();
    const rows = resData.values || [];
    const rowIndex = rows.findIndex(r => r && r[0] === id);
    if (rowIndex === -1) return;
    const rowNum = rowIndex + 1;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A${rowNum}:Z${rowNum}:clear`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
  }

  // Sync full Presets list to Presets tab
  async function syncPresetsToSheet(token, sheetId, presets) {
    if (!presets || !Array.isArray(presets)) return;
    const range = "Presets!A2:F" + (presets.length + 1);
    const body = {
      values: presets.map(p => [
        p.id,
        sanitizeVal(p.label),
        Number(p.amount),
        sanitizeVal(p.category),
        sanitizeVal(p.note || ""),
        p.type || "Expense"
      ])
    };

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Presets!A2:F100:clear`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }).catch(() => {});

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return res.ok ? res.json() : null;
  }

  // Two-Way Sync / Cloud Hydration: Pull all existing tabs from Google Sheets
  async function pullAllData(token, sheetId) {
    const ranges = [
      "Transactions!A2:G",
      "Debts!A2:I",
      "Presets!A2:F",
      "Stashes!A2:F",
      "AuditLog!A2:E"
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?` +
      ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets API Pull Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const result = {
      transactions: [],
      debts: [],
      presets: [],
      stashes: [],
      auditLog: []
    };

    if (!data.valueRanges) return result;

    data.valueRanges.forEach(vr => {
      const range = vr.range || "";
      const rows = vr.values || [];
      if (range.indexOf("Transactions") !== -1) {
        result.transactions = rows.map(r => ({
          id: r[0] || "",
          timestamp: r[1] || "",
          date: r[2] || "",
          type: r[3] || "Expense",
          category: r[4] || "Other",
          amount: parseAmount(r[5]),
          notes: r[6] || ""
        })).filter(t => t.id && t.amount > 0);
      } else if (range.indexOf("Debts") !== -1) {
        result.debts = rows.map(r => ({
          id: r[0] || "",
          timestamp: r[1] || "",
          date: r[2] || "",
          person: r[3] || "",
          direction: r[4] || "I owe them",
          amount: parseAmount(r[5]),
          paid: parseAmount(r[6]),
          status: r[7] || "Active",
          notes: r[8] || ""
        })).filter(d => d.id && d.amount > 0);
      } else if (range.indexOf("Presets") !== -1) {
        result.presets = rows.map(r => ({
          id: r[0] || "",
          label: r[1] || "",
          amount: parseAmount(r[2]),
          category: r[3] || "Other",
          note: r[4] || "",
          type: r[5] || "Expense"
        })).filter(p => p.id && p.amount > 0);
      } else if (range.indexOf("Stashes") !== -1) {
        result.stashes = rows.map(r => ({
          id: r[0] || "",
          timestamp: r[1] || "",
          date: r[2] || "",
          amount: parseAmount(r[3]),
          note: r[4] || "Reserve",
          status: r[5] || "Active"
        })).filter(s => s.id && s.amount > 0);
      } else if (range.indexOf("AuditLog") !== -1) {
        result.auditLog = rows.map(r => ({
          timestamp: r[0] || "",
          action: r[1] || "EVENT",
          targetId: r[2] || "",
          summary: r[3] || "",
          date: r[4] || ""
        })).filter(a => a.action);
      }
    });

    return result;
  }

  // Flush local pending queue to Google Sheets
  async function flushSyncQueue(token, sheetId, queue) {
    if (!queue || queue.length === 0) return { synced: 0, remaining: [] };
    let synced = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        if (item.op === "ADD_TX") {
          await appendTransaction(token, sheetId, item.data);
          synced++;
        } else if (item.op === "EDIT_TX") {
          await updateTransaction(token, sheetId, item.data);
          synced++;
        } else if (item.op === "DEL_TX") {
          await deleteRowById(token, sheetId, "Transactions", item.data.id);
          synced++;
        } else if (item.op === "ADD_DEBT") {
          await appendDebt(token, sheetId, item.data);
          synced++;
        } else if (item.op === "SETTLE_DEBT") {
          await updateDebtStatus(token, sheetId, item.data);
          synced++;
        } else if (item.op === "DEL_DEBT") {
          await deleteRowById(token, sheetId, "Debts", item.data.id);
          synced++;
        } else if (item.op === "AUDIT_LOG") {
          await appendAuditLog(token, sheetId, item.data);
          synced++;
        } else if (item.op === "SYNC_PRESETS") {
          await syncPresetsToSheet(token, sheetId, item.data);
          synced++;
        } else if (item.op === "SYNC_STASHES") {
          await appendStash(token, sheetId, item.data);
          synced++;
        } else {
          synced++;
        }
      } catch (e) {
        console.error("Sync item failed:", e);
        if (e.message && e.message.includes("401")) {
          // Propagate 401 immediately so silent reauth can be triggered
          throw e;
        }
        remaining.push(item);
      }
    }

    return { synced, remaining };
  }

  return {
    authenticate,
    getUserEmail,
    getOrCreateSpreadsheet,
    appendTransaction,
    updateTransaction,
    appendDebt,
    updateDebtStatus,
    deleteRowById,
    appendAuditLog,
    appendStash,
    syncPresetsToSheet,
    pullAllData,
    flushSyncQueue,
    extractSpreadsheetId,
    getRedirectUri,
    sanitizeVal,
    parseAmount
  };
})();
