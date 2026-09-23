// Telemetry HUD and interactive chart canvas renderer.
// Note: bgMouse tracks coordinates local to the telemetry canvas,
// while globalMouse in canvas-background tracks whole-window viewport coordinates.

let telemetryCanvasInited = false;
const bgMouse = { x: -1000, y: -1000, active: false };
let bgParticles = [];
let chartDataPoints = [];

function initTelemetryCanvas() {
  const canvas = document.getElementById("telemetryCanvas");
  if (!canvas || telemetryCanvasInited) return;
  telemetryCanvasInited = true;

  bgParticles = [];
  for (let i = 0; i < 20; i++) {
    bgParticles.push({
      x: Math.random() * 500,
      y: Math.random() * 160,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.5 + 0.8,
      baseAlpha: Math.random() * 0.3 + 0.15
    });
  }

  const hudTooltip = document.getElementById("canvasHudTooltip");
  const curPointLabel = document.getElementById("canvasCurPoint");

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    bgMouse.x = e.clientX - rect.left;
    bgMouse.y = e.clientY - rect.top;
    bgMouse.active = true;

    if (chartDataPoints.length > 0 && hudTooltip) {
      let closest = chartDataPoints[0];
      let minDist = Math.abs(bgMouse.x - closest.x);
      for (let i = 1; i < chartDataPoints.length; i++) {
        const dist = Math.abs(bgMouse.x - chartDataPoints[i].x);
        if (dist < minDist) {
          minDist = dist;
          closest = chartDataPoints[i];
        }
      }

      if (minDist < 45) {
        hudTooltip.style.display = "block";
        const tooltipW = 160;
        let left = closest.x - tooltipW / 2;
        if (left < 6) left = 6;
        if (left + tooltipW > rect.width - 6) left = rect.width - tooltipW - 6;
        let top = closest.y - 48;
        if (top < 6) top = closest.y + 14;

        hudTooltip.style.left = `${left}px`;
        hudTooltip.style.top = `${top}px`;
        hudTooltip.innerHTML = `
          <div style="font-weight:700; color:#f4f4f5; margin-bottom:2px;">${closest.label} (${closest.fullDate})</div>
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <span>Balance: <b style="color:#10b981;">${closest.cumBal.toFixed(2)}</b></span>
            <span>Net: <b style="color:${closest.dayNet >= 0 ? '#10b981' : '#f43f5e'};">${closest.dayNet >= 0 ? '+' : ''}${closest.dayNet.toFixed(2)}</b></span>
          </div>
        `;
        if (curPointLabel) {
          curPointLabel.textContent = `${closest.label}: ${closest.cumBal.toFixed(2)}`;
        }
      } else {
        hudTooltip.style.display = "none";
      }
    }
  });

  canvas.addEventListener("mouseleave", () => {
    bgMouse.x = -1000;
    bgMouse.y = -1000;
    bgMouse.active = false;
    if (hudTooltip) hudTooltip.style.display = "none";
    if (curPointLabel) curPointLabel.textContent = "interactive";
  });
}

function drawTelemetryChart(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 340;
  const h = canvas.clientHeight || 160;

  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // 1. Interactive Background Dot Grid
  const gridGap = 24;
  for (let gx = 12; gx < w; gx += gridGap) {
    for (let gy = 12; gy < h; gy += gridGap) {
      const dToMouse = Math.hypot(bgMouse.x - gx, bgMouse.y - gy);
      let dotAlpha = 0.12;
      let dotRadius = 1;
      let dotColor = "113, 113, 122"; // zinc
      if (bgMouse.active && dToMouse < 70) {
        const factor = (1 - dToMouse / 70);
        dotAlpha = 0.12 + factor * 0.55;
        dotRadius = 1 + factor * 1.5;
        dotColor = "16, 185, 129"; // emerald
      }
      ctx.fillStyle = `rgba(${dotColor}, ${dotAlpha})`;
      ctx.beginPath();
      ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Floating Constellation Micro-particles with cursor repulsion
  for (let i = 0; i < bgParticles.length; i++) {
    const p = bgParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;

    if (bgMouse.active) {
      const dx = p.x - bgMouse.x;
      const dy = p.y - bgMouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 60 && dist > 1) {
        const force = (60 - dist) / 60 * 0.4;
        p.x += (dx / dist) * force;
        p.y += (dy / dist) * force;
      }
    }

    ctx.fillStyle = `rgba(16, 185, 129, ${p.baseAlpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    for (let j = i + 1; j < bgParticles.length; j++) {
      const p2 = bgParticles[j];
      const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
      if (dist < 42) {
        const lineAlpha = (1 - dist / 42) * 0.18;
        ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha})`;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // 3. Financial Cumulative Balance Trajectory
  if (chartDataPoints.length > 1) {
    const padX = 20;
    const padY = 24;
    const effW = Math.max(10, w - padX * 2);
    const effH = Math.max(10, h - padY * 2);

    const minVal = Math.min(...chartDataPoints.map(p => p.cumBal));
    const maxVal = Math.max(...chartDataPoints.map(p => p.cumBal));
    const range = Math.max(1, maxVal - minVal);

    chartDataPoints.forEach((p, idx) => {
      p.x = padX + (idx / (chartDataPoints.length - 1)) * effW;
      const normY = (p.cumBal - minVal) / range;
      p.y = h - padY - (normY * effH);
    });

    // Area gradient
    ctx.beginPath();
    ctx.moveTo(chartDataPoints[0].x, h - padY);
    ctx.lineTo(chartDataPoints[0].x, chartDataPoints[0].y);
    for (let i = 1; i < chartDataPoints.length; i++) {
      const prev = chartDataPoints[i - 1];
      const curr = chartDataPoints[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    const last = chartDataPoints[chartDataPoints.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(last.x, h - padY);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, padY, 0, h - padY);
    areaGrad.addColorStop(0, "rgba(16, 185, 129, 0.22)");
    areaGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Baseline axis
    ctx.strokeStyle = "#1f1f23";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, h - padY);
    ctx.lineTo(w - padX, h - padY);
    ctx.stroke();

    // Main curve stroke
    ctx.beginPath();
    ctx.moveTo(chartDataPoints[0].x, chartDataPoints[0].y);
    for (let i = 1; i < chartDataPoints.length; i++) {
      const prev = chartDataPoints[i - 1];
      const curr = chartDataPoints[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.lineTo(last.x, last.y);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Data pips
    chartDataPoints.forEach(p => {
      ctx.fillStyle = "#09090b";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Cursor interaction: scanline and snap pip
    if (bgMouse.active) {
      let closest = chartDataPoints[0];
      let minDist = Math.abs(bgMouse.x - closest.x);
      for (let i = 1; i < chartDataPoints.length; i++) {
        const dist = Math.abs(bgMouse.x - chartDataPoints[i].x);
        if (dist < minDist) {
          minDist = dist;
          closest = chartDataPoints[i];
        }
      }

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(244, 244, 245, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(closest.x, padY);
      ctx.lineTo(closest.x, h - padY);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(closest.x, closest.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(closest.x, closest.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
