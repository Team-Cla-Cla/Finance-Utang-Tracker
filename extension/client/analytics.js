// Analytics presentation subsystem.
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

