// Preset management presentation controller.
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

