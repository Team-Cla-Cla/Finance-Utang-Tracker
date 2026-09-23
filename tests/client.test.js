const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Helper to load domain & helpers in a VM context
function createContext() {
  const context = {
    console,
    Date,
    Math,
    Object,
    String,
    Number,
    isFinite,
    isNaN,
    Array,
    appState: {
      transactions: [],
      debts: [],
      presets: [],
      stashes: [],
      auditLog: [],
      syncQueue: [],
      dailyRollover: false
    },
    queueSyncItem: function (item) {
      context.appState.syncQueue.push(item);
    },
    persistState: function () {}
  };
  vm.runInNewContext(fs.readFileSync("shared/domain.js", "utf8"), context, { filename: "shared/domain.js" });
  vm.runInContext(fs.readFileSync("docs/client/helpers.js", "utf8"), context, { filename: "docs/client/helpers.js" });
  return context;
}

// 1. Helpers Unit Tests
const ctx = createContext();

// parseAmount
assert.equal(ctx.parseAmount(100), 100);
assert.equal(ctx.parseAmount("100"), 100);
assert.equal(ctx.parseAmount("₱1,250.75"), 1250.75);
assert.equal(ctx.parseAmount("$45.50"), 45.5);
assert.equal(ctx.parseAmount(""), 0);
assert.equal(ctx.parseAmount(null), 0);
assert.equal(ctx.parseAmount(undefined), 0);
assert.equal(ctx.parseAmount("invalid"), 0);
assert.equal(ctx.parseAmount("   250.00  "), 250);

// getLocalDateStr
const fixedDate = new Date(2026, 8, 24, 12, 0, 0); // Sept 24, 2026
assert.equal(ctx.getLocalDateStr(fixedDate), "2026-09-24");
assert.match(ctx.getLocalDateStr(), /^\d{4}-\d{2}-\d{2}$/);

// escapeHtml
assert.equal(ctx.escapeHtml('<script>alert("xss")</script>'), "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
assert.equal(ctx.escapeHtml("Tom & Jerry's"), "Tom &amp; Jerry&#039;s");
assert.equal(ctx.escapeHtml(""), "");
assert.equal(ctx.escapeHtml(null), "");
assert.equal(ctx.escapeHtml(undefined), "");

// 2. Audit Trail Logger Tests
vm.runInContext(fs.readFileSync("docs/client/audit.js", "utf8"), ctx, { filename: "docs/client/audit.js" });
ctx.logAudit({ action: "TEST_ACTION", targetId: "tx_123", summary: "Test audit entry" });

assert.equal(ctx.appState.auditLog.length, 1);
assert.equal(ctx.appState.auditLog[0].action, "TEST_ACTION");
assert.equal(ctx.appState.auditLog[0].targetId, "tx_123");
assert.match(ctx.appState.auditLog[0].id, /^aud_\d+_\d+$/);
assert.equal(ctx.appState.syncQueue.length, 1);
assert.equal(ctx.appState.syncQueue[0].op, "AUDIT_LOG");

// Cap at 100 entries test
for (let i = 0; i < 110; i++) {
  ctx.logAudit({ action: "BULK_AUDIT", summary: "Entry " + i });
}
assert.equal(ctx.appState.auditLog.length, 100);

// 3. Client Module Parity Check (docs/client/ vs extension/client/)
const docsClientDir = "docs/client";
const extClientDir = "extension/client";
const docsFiles = fs.readdirSync(docsClientDir).sort();
const extFiles = fs.readdirSync(extClientDir).sort();

assert.deepEqual(docsFiles, extFiles, "Client file list between docs and extension must match exactly");

for (const file of docsFiles) {
  const docsContent = fs.readFileSync(path.join(docsClientDir, file), "utf8");
  const extContent = fs.readFileSync(path.join(extClientDir, file), "utf8");
  assert.equal(docsContent, extContent, `Client module parity failed for ${file}`);
}

// 4. Service Worker Cache Synchrony Check
const indexHtml = fs.readFileSync("docs/index.html", "utf8");
const swJs = fs.readFileSync("docs/sw.js", "utf8");

const scriptSrcMatches = [...indexHtml.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
for (const src of scriptSrcMatches) {
  if (src.startsWith("http") || src.startsWith("//")) continue;
  const normalized = "./" + src;
  assert.ok(
    swJs.includes(normalized) || swJs.includes(`"${normalized}"`),
    `Service worker sw.js is missing cached asset: ${normalized}`
  );
}

console.log("Client and architecture tests passed.");
