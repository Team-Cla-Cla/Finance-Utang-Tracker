// --- Interactive Background Grid & Ambient Orb Dynamics ---
// Note: globalMouse tracks whole-window viewport coordinates for the background grid canvas.
let bgAnimationId = null;
const globalMouse = { x: -1000, y: -1000, active: false };
let bgDots = [];
let bgGridW = 0;
let bgGridH = 0;

// Global cursor tracking across the entire window for the background canvas
window.addEventListener("mousemove", (e) => {
  if (!shouldRunBgAnimation()) return;
  globalMouse.x = e.clientX;
  globalMouse.y = e.clientY;
  globalMouse.active = true;
  resetOrbIdleTimer();
  wakeBackgroundLoop();
}, { passive: true });

window.addEventListener("mouseleave", () => {
  globalMouse.active = false;
  activateOrb();
});

window.addEventListener("touchmove", (e) => {
  if (e.touches && e.touches.length > 0) {
    globalMouse.x = e.touches[0].clientX;
    globalMouse.y = e.touches[0].clientY;
    globalMouse.active = true;
    resetOrbIdleTimer();
    wakeBackgroundLoop();
  }
}, { passive: true });

window.addEventListener("touchend", () => {
  globalMouse.active = false;
  resetOrbIdleTimer();
});

window.addEventListener("blur", () => {
  isWindowFocused = false;
  activateOrb();
});

window.addEventListener("focus", () => {
  isWindowFocused = true;
  lastOrbTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  resetOrbIdleTimer();
  wakeBackgroundLoop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (bgAnimationId) {
      cancelAnimationFrame(bgAnimationId);
      bgAnimationId = null;
    }
  } else {
    lastOrbTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    isWindowFocused = (typeof document !== "undefined" && document.hasFocus) ? document.hasFocus() : true;
    if (!isWindowFocused) {
      activateOrb();
    } else {
      resetOrbIdleTimer();
    }
    wakeBackgroundLoop();
  }
});


function initBgCircleGrid(w, h) {
  bgGridW = w;
  bgGridH = h;
  bgDots = [];
  golCols = Math.ceil(w / golSpacing) + 1;
  golRows = Math.ceil(h / golSpacing) + 1;
  golStartX = (w - (golCols - 1) * golSpacing) / 2;
  golStartY = (h - (golRows - 1) * golSpacing) / 2;

  const totalCells = golCols * golRows;
  golGrid = new Uint8Array(totalCells);
  golNextGrid = new Uint8Array(totalCells);

  for (let c = 0; c < golCols; c++) {
    for (let r = 0; r < golRows; r++) {
      const ox = golStartX + c * golSpacing;
      const oy = golStartY + r * golSpacing;
      bgDots.push({
        c: c,
        r: r,
        ox: ox,
        oy: oy,
        x: ox,
        y: oy,
        vx: 0,
        vy: 0,
        baseR: 1.35,
        r: 1.35,
        alpha: 0.14,
        energy: 0,
        phase: (c * 0.38 + r * 0.52) % (Math.PI * 2)
      });
    }
  }

  // Seed initial life patterns
  spawnGolPattern(w * 0.5, h * 0.45, 2); // R-Pentomino in center
  spawnGolPattern(w * 0.25, h * 0.3, 0);  // Glider in upper-left
  spawnGolPattern(w * 0.75, h * 0.65, 3); // LWSS in lower-right
}

function drawBackgroundGrid(canvas) {
  if (!canvas) return false;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth || document.documentElement.clientWidth || 800;
  const h = window.innerHeight || document.documentElement.clientHeight || 600;

  if (w < 10 || h < 10) return false;

  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    initBgCircleGrid(w, h);
  } else if (bgDots.length === 0 || Math.abs(bgGridW - w) > 2 || Math.abs(bgGridH - h) > 2) {
    initBgCircleGrid(w, h);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  let anyMoving = false;

  // Step Game of Life cellular automaton at ~7 generations/sec
  const curNow = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (curNow - lastGolTick >= GOL_TICK_MS) {
    lastGolTick = curNow;
    stepGameOfLife();
  }

  // Update Ambient Floating Orbs Physics & Smooth Wandering
  const dt = Math.min(0.064, Math.max(0.008, (curNow - lastOrbTick) / 1000));
  lastOrbTick = curNow;

  const numOrbs = activeOrbs.length;
  const pad = 100;

  for (let o = 0; o < numOrbs; o++) {
    const org = activeOrbs[o];
    org.breathPhase += dt * org.breathSpeed;
    if (org.breathPhase > Math.PI * 2) org.breathPhase -= Math.PI * 2;
    const bSin = Math.sin(org.breathPhase);
    org.currentBSin = bSin;

    // Organic harmonic steering
    org.angle += (Math.sin(curNow * 0.0013 + org.id) * 0.048 + Math.cos(curNow * 0.0009 + org.id * 2) * 0.04);

    // Boundary repulsion cushion
    if (org.x < pad) org.angle += (pad - org.x) * 0.0014;
    else if (org.x > w - pad) org.angle -= (org.x - (w - pad)) * 0.0014;
    if (org.y < pad) org.angle += (pad - org.y) * 0.0014;
    else if (org.y > h - pad) org.angle -= (org.y - (h - pad)) * 0.0014;

    const speedPulse = org.speed * (1 + 0.3 * bSin) * 65 * dt;
    org.vx = (org.vx * 0.86) + Math.cos(org.angle) * speedPulse * 0.14;
    org.vy = (org.vy * 0.86) + Math.sin(org.angle) * speedPulse * 0.14;
    org.x += org.vx;
    org.y += org.vy;

    org.x = Math.max(25, Math.min(w - 25, org.x));
    org.y = Math.max(25, Math.min(h - 25, org.y));

    org.currentInfluenceR = org.baseInfluenceR + 60 * bSin;
    org.currentSpotR = org.baseSpotR + 80 * bSin;
    org.alpha += (org.targetAlpha - org.alpha) * 0.1;

    // Ignite cells under organism core
    if (golGrid) {
      const orgC = Math.round((org.x - golStartX) / golSpacing);
      const orgR = Math.round((org.y - golStartY) / golSpacing);
      if (orgC >= 0 && orgC < golCols && orgR >= 0 && orgR < golRows) {
        golGrid[orgC * golRows + orgR] = 1;
      }

      // Drop life spores on peak respiration
      if (bSin > 0.84 && (curNow - org.lastSeedTime > 420)) {
        org.lastSeedTime = curNow;
        spawnGolPattern(org.x, org.y, org.id % 4);
      }
    }

    anyMoving = true;
  }

  // User mouse also ignites cells
  if (globalMouse.active && golGrid) {
    const mouseC = Math.round((globalMouse.x - golStartX) / golSpacing);
    const mouseR = Math.round((globalMouse.y - golStartY) / golSpacing);
    if (mouseC >= 0 && mouseC < golCols && mouseR >= 0 && mouseR < golRows) {
      golGrid[mouseC * golRows + mouseR] = 1;
    }
  }

  // 1. Ambient spotlight glow for floating orbs
  for (let o = 0; o < numOrbs; o++) {
    const org = activeOrbs[o];
    const radGrad = ctx.createRadialGradient(
      org.x, org.y, 0,
      org.x, org.y, org.currentSpotR
    );
    const bSin = org.currentBSin;
    if (org.hueType === 0) {
      // Emerald
      radGrad.addColorStop(0, `rgba(16, 185, 129, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(56, 189, 248, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 1) {
      // Electric Cyan
      radGrad.addColorStop(0, `rgba(56, 189, 248, ${(0.14 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(16, 185, 129, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 2) {
      // Deep Aqua / Teal
      radGrad.addColorStop(0, `rgba(20, 184, 166, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(14, 165, 233, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 3) {
      // Warm Amber / Gold
      radGrad.addColorStop(0, `rgba(245, 158, 11, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(234, 88, 12, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else if (org.hueType === 4) {
      // Soft Violet
      radGrad.addColorStop(0, `rgba(168, 85, 247, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(59, 130, 246, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    } else {
      // Rose / Coral
      radGrad.addColorStop(0, `rgba(244, 63, 94, ${(0.13 + 0.04 * bSin) * org.alpha})`);
      radGrad.addColorStop(0.5, `rgba(245, 158, 11, ${(0.06 + 0.03 * bSin) * org.alpha})`);
    }
    radGrad.addColorStop(1, "rgba(8, 8, 10, 0)");
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(org.x, org.y, org.currentSpotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cursor spotlight glow if active
  if (globalMouse.active) {
    const spotR = 320;
    const radGrad = ctx.createRadialGradient(
      globalMouse.x, globalMouse.y, 0,
      globalMouse.x, globalMouse.y, spotR
    );
    radGrad.addColorStop(0, "rgba(16, 185, 129, 0.14)");
    radGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.06)");
    radGrad.addColorStop(1, "rgba(8, 8, 10, 0)");
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(globalMouse.x, globalMouse.y, spotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Interactive Matrix of Circles (Game of Life, Ambient Orbs & Scale Pulsing)
  const len = bgDots.length;
  const globalBreath = Math.sin(curNow * 0.0028);

  const slateDots = [];
  const emeraldDots = [];
  const cyanDots = [];
  const haloRings = [];

  for (let i = 0; i < len; i++) {
    const dot = bgDots[i];
    let targetX = dot.ox;
    let targetY = dot.oy;
    let targetR = 1.35;
    let targetAlpha = 0.14;
    let isNear = false;
    let factor = 0;

    // Cellular Automaton state & smooth phosphorescent energy
    const isAlive = (golGrid && golGrid[dot.c * golRows + dot.r] === 1);
    if (isAlive) {
      dot.energy += (1.0 - dot.energy) * 0.28;
    } else if (dot.energy > 0.005) {
      dot.energy += (0.0 - dot.energy) * 0.038;
    } else {
      dot.energy = 0;
    }

    // Dynamic scale pulsing (small to big)
    const cellPulse = Math.sin(curNow * 0.0045 + dot.phase);

    if (dot.energy > 0.03) {
      const pulseDelta = (2.2 + 1.6 * cellPulse) * dot.energy;
      targetR = 1.35 + pulseDelta;
      targetAlpha = 0.16 + dot.energy * (0.68 + 0.16 * cellPulse);
      anyMoving = true;
    } else {
      targetR = 1.25 + 0.15 * globalBreath;
      targetAlpha = 0.12 + 0.03 * globalBreath;
    }

    // Deflection from cursor (with fast bounding-box pre-filter)
    if (globalMouse.active) {
      const dx = dot.ox - globalMouse.x;
      const dy = dot.oy - globalMouse.y;
      const influenceR = 270;
      if (Math.abs(dx) <= influenceR && Math.abs(dy) <= influenceR) {
        const dist = Math.hypot(dx, dy);
        if (dist < influenceR) {
          isNear = true;
          factor = (influenceR - dist) / influenceR;
          const smooth = factor * factor;
          const angle = Math.atan2(dy, dx);
          targetX += Math.cos(angle) * smooth * 28;
          targetY += Math.sin(angle) * smooth * 28;
        }
      }
    }

    // Deflection from floating orbs (with fast bounding-box pre-filter)
    for (let o = 0; o < numOrbs; o++) {
      const org = activeOrbs[o];
      const r = org.currentInfluenceR;
      const dx = dot.ox - org.x;
      const dy = dot.oy - org.y;
      if (Math.abs(dx) <= r && Math.abs(dy) <= r) {
        const dist = Math.hypot(dx, dy);
        if (dist < r) {
          const f = (r - dist) / r;
          if (f > factor) {
            factor = f;
            isNear = true;
          }
          const smooth = f * f;
          const angle = Math.atan2(dy, dx);
          targetX += Math.cos(angle) * smooth * (24 + 5 * org.currentBSin);
          targetY += Math.sin(angle) * smooth * (24 + 5 * org.currentBSin);
        }
      }
    }

    if (isNear) {
      targetR = Math.max(targetR, 1.45 + factor * factor * 3.2);
      targetAlpha = Math.max(targetAlpha, 0.22 + factor * 0.76);
    }

    // Spring damping physics
    dot.vx = (dot.vx + (targetX - dot.x) * 0.24) * 0.72;
    dot.vy = (dot.vy + (targetY - dot.y) * 0.24) * 0.72;
    dot.x += dot.vx;
    dot.y += dot.vy;

    if (Math.abs(dot.vx) > 0.02 || Math.abs(dot.vy) > 0.02 || Math.abs(dot.x - dot.ox) > 0.1 || Math.abs(dot.y - dot.oy) > 0.1) {
      anyMoving = true;
    }

    dot.r += (targetR - dot.r) * 0.28;
    dot.alpha += (targetAlpha - dot.alpha) * 0.28;

    // Bucket into batch render lists by visual intensity
    if (dot.energy > 0.45 || (isNear && factor > 0.5)) {
      cyanDots.push(dot);
    } else if (dot.energy > 0.12 || isNear) {
      emeraldDots.push(dot);
    } else {
      slateDots.push(dot);
    }

    // Pulsing halo ring on living clusters and active influence zone
    if (dot.energy > 0.38) {
      haloRings.push({
        x: dot.x,
        y: dot.y,
        r: dot.r * (1.75 + 0.35 * cellPulse)
      });
    } else if (isNear && factor > 0.35) {
      haloRings.push({
        x: dot.x,
        y: dot.y,
        r: dot.r * 2.2
      });
    }
  }

  // --- BATCH DRAW ALL DOTS (Single path & fill per color bucket for maximum 60fps performance) ---
  if (slateDots.length > 0) {
    ctx.fillStyle = `rgba(161, 161, 170, ${0.12 + 0.03 * globalBreath})`;
    ctx.beginPath();
    for (let i = 0; i < slateDots.length; i++) {
      const d = slateDots[i];
      ctx.moveTo(d.x + d.r, d.y);
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  if (emeraldDots.length > 0) {
    ctx.fillStyle = "rgba(16, 185, 129, 0.72)";
    ctx.beginPath();
    for (let i = 0; i < emeraldDots.length; i++) {
      const d = emeraldDots[i];
      ctx.moveTo(d.x + d.r, d.y);
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  if (cyanDots.length > 0) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.88)";
    ctx.beginPath();
    for (let i = 0; i < cyanDots.length; i++) {
      const d = cyanDots[i];
      ctx.moveTo(d.x + d.r, d.y);
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  if (haloRings.length > 0) {
    ctx.strokeStyle = "rgba(56, 189, 248, 0.38)";
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    for (let i = 0; i < haloRings.length; i++) {
      const h = haloRings[i];
      ctx.moveTo(h.x + h.r, h.y);
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  ctx.restore();
  return anyMoving;
}


function isExtensionPopupMode() {
  const isExtProtocol = typeof window !== "undefined" && window.location &&
    (window.location.protocol === "chrome-extension:" || window.location.protocol === "moz-extension:");
  const isFullTab = typeof window !== "undefined" && window.location &&
    (window.location.search.includes("tab=1") || window.innerWidth >= 840);
  return isExtProtocol && !isFullTab;
}

function shouldRunBgAnimation() {
  if (typeof appState !== "undefined" && typeof appState.disableBgAnimation === "boolean") {
    return !appState.disableBgAnimation;
  }
  // Default: True everywhere! With batched rendering and 30fps throttle, CPU is <1% with 0ms input latency
  return true;
}

function drawStaticBackground(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth || document.documentElement.clientWidth || 380;
  const h = window.innerHeight || document.documentElement.clientHeight || 590;

  if (w < 10 || h < 10) return;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Elegant subtle ambient radial glow for static mode
  const radGrad = ctx.createRadialGradient(w * 0.35, h * 0.25, 0, w * 0.35, h * 0.25, Math.max(w, h) * 0.55);
  radGrad.addColorStop(0, "rgba(16, 185, 129, 0.08)");
  radGrad.addColorStop(0.6, "rgba(56, 189, 248, 0.04)");
  radGrad.addColorStop(1, "rgba(8, 8, 10, 0)");
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, w, h);

  // Clean, zero-CPU dark matrix
  const spacing = 28;
  ctx.fillStyle = "rgba(161, 161, 170, 0.12)";
  ctx.beginPath();
  for (let x = spacing / 2; x < w; x += spacing) {
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.moveTo(x + 1.35, y);
      ctx.arc(x, y, 1.35, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

let lastBgFrameTime = 0;

function renderBackgroundLoop(timestamp) {
  if (!shouldRunBgAnimation()) {
    const bgCanvas = document.getElementById("bgCanvas");
    if (bgCanvas) drawStaticBackground(bgCanvas);
    bgAnimationId = null;
    return;
  }

  // Adaptive framerate throttling: 30 FPS in extension popup (33ms) for zero lag & 0% idle CPU; 60 FPS (16ms) in browser tab
  const minInterval = isExtensionPopupMode() ? 33 : 16;
  const now = (typeof timestamp === "number" && timestamp > 0) ? timestamp : ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
  if (now - lastBgFrameTime < minInterval) {
    bgAnimationId = requestAnimationFrame(renderBackgroundLoop);
    return;
  }
  lastBgFrameTime = now;

  const bgCanvas = document.getElementById("bgCanvas");
  let anyMoving = false;
  if (bgCanvas) {
    anyMoving = drawBackgroundGrid(bgCanvas);
  }

  const modal = document.getElementById("analyticsModal");
  if (modal && modal.style.display !== "none") {
    const canvas = document.getElementById("telemetryCanvas");
    if (canvas) {
      drawTelemetryChart(canvas);
    }
  }

  if (globalMouse.active || activeOrbs.length > 0 || anyMoving || (modal && modal.style.display !== "none")) {
    bgAnimationId = requestAnimationFrame(renderBackgroundLoop);
  } else {
    bgAnimationId = null;
  }
}

function wakeBackgroundLoop() {
  if (!shouldRunBgAnimation()) {
    const bgCanvas = document.getElementById("bgCanvas");
    if (bgCanvas) drawStaticBackground(bgCanvas);
    return;
  }
  if (!bgAnimationId) {
    bgAnimationId = requestAnimationFrame(renderBackgroundLoop);
  }
}

