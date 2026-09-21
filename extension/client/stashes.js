// Stash feature presentation controller.
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
  appState.stashes = FinanceDomain.stashDeposit(appState.stashes, stash);

  queueSyncItem({ op: "ADD_TX", data: tx });
  queueSyncItem({ op: "SYNC_STASHES", data: stash });
  persistState();
  renderUI();
  showStatus(`Stashed ${amt.toFixed(2)} into Vault`, false);
  triggerAutoSync();
}

function unstash(stashId) {
  const item = appState.stashes.find(s => s.id === stashId);
  if (!item) return;
  const amt = Number(item.amount) || 0;
  const cleanNote = item.note || "Reserve";

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

  const result = FinanceApplication.unstashState(appState.stashes, appState.transactions, appState.syncQueue, stashId, tx);
  if (!result.item) return;
  appState.stashes = result.stashes;
  appState.transactions = result.transactions;
  appState.syncQueue = result.syncQueue;
  persistState();
  renderUI();
  showStatus(`Added ${amt.toFixed(2)} back to today's finance`, false);
  triggerAutoSync();
}

function deleteStash(stashId) {
  const item = appState.stashes.find(s => s.id === stashId);
  if (!item) return;
  const amt = Number(item.amount) || 0;

  const refund = confirm(`Delete Stash Record (₱${amt.toFixed(2)})?\n\n- Click OK to REFUND ₱${amt.toFixed(2)} back to your spendable cash.\n- Click CANCEL to choose whether to permanently discard without refunding.`);
  if (refund) {
    unstash(stashId);
    return;
  }

  if (confirm(`Permanently discard stash record (₱${amt.toFixed(2)}) WITHOUT returning funds to spendable cash?`)) {
    const result = FinanceApplication.deleteStash(appState.stashes, appState.syncQueue, stashId);
    if (!result.item) return;
    appState.stashes = result.stashes;
    appState.syncQueue = result.syncQueue;
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

