// Shared presentation utility functions — loaded first, available to all client modules.

// Strict amount parser: handles integers, decimals, commas, currency prefixes, float glitches.
function parseAmount(val) {
  return FinanceDomain.parseAmount(val);
}

// Returns local date string YYYY-MM-DD for a given Date (defaults to now).
function getLocalDateStr(d) {
  return FinanceDomain.getLocalDateStr(d);
}

// Escapes HTML special characters to prevent XSS in innerHTML contexts.
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
