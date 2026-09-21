// Calendar and chronometer presentation subsystem.
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

