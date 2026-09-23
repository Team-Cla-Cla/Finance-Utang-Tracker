// Finance UI rendering and mode presentation controller.
// --- Metrics Calculation (Instant 0 ms) ---
function computeMetrics() {
  return FinanceDomain.calculateLedger(appState.transactions, appState.debts, appState.dailyRollover, new Date());
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


