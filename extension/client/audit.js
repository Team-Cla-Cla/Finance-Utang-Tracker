// Audit trail logging controller.
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
