// Ambient orb animation engine.

// Ambient Floating Light Orbs (Capped to maximum 6, distributed evenly across 6 distinct screen zones)
let activeOrbs = [];
const MAX_ORBS = 6;
let orbIdCounter = 0;
let orbSpawnSlotIndex = 0;
let lastOrbTick = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

// 6 evenly distributed spatial zones across the viewport
const ORB_SPACES = [
  { xRatio: 0.18, yRatio: 0.22, name: "top-left" },
  { xRatio: 0.50, yRatio: 0.18, name: "top-center" },
  { xRatio: 0.82, yRatio: 0.22, name: "top-right" },
  { xRatio: 0.82, yRatio: 0.78, name: "bottom-right" },
  { xRatio: 0.50, yRatio: 0.82, name: "bottom-center" },
  { xRatio: 0.18, yRatio: 0.78, name: "bottom-left" }
];

function createOrb(x, y, customSpeed = null, customHue = null) {
  const angle = Math.random() * Math.PI * 2;
  const spd = customSpeed || (1.3 + Math.random() * 0.8);
  const hue = (customHue !== null) ? customHue : (orbIdCounter % 6);
  return {
    id: ++orbIdCounter,
    x: x,
    y: y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle: angle,
    speed: spd,
    breathPhase: Math.random() * Math.PI * 2,
    breathSpeed: (Math.PI * 2) / (2.6 + Math.random() * 1.2),
    baseInfluenceR: 220 + Math.random() * 50,
    baseSpotR: 300 + Math.random() * 70,
    currentInfluenceR: 220,
    currentSpotR: 300,
    currentBSin: 0,
    hueType: hue, // 0..5: Emerald, Cyan, Teal, Amber Gold, Violet, Rose
    alpha: 0.1,
    targetAlpha: 1.0,
    lastSeedTime: 0
  };
}

function spawnOrbInNextSpace(clickX, clickY) {
  if (!shouldRunBgAnimation()) return;
  const w = window.innerWidth || 800;
  const h = window.innerHeight || 600;

  // Cycle through the 6 evenly spaced zones across the screen
  const slot = ORB_SPACES[orbSpawnSlotIndex % MAX_ORBS];
  orbSpawnSlotIndex++;

  const spawnX = Math.max(30, Math.min(w - 30, slot.xRatio * w + (Math.random() - 0.5) * 40));
  const spawnY = Math.max(30, Math.min(h - 30, slot.yRatio * h + (Math.random() - 0.5) * 40));

  // Maintain max 6 active orbs at all times
  if (activeOrbs.length >= MAX_ORBS) {
    activeOrbs.shift(); // Retire oldest orb
  }

  const orb = createOrb(spawnX, spawnY);
  // Velocity oriented smoothly toward screen center
  const toCenterX = (w / 2) - spawnX;
  const toCenterY = (h / 2) - spawnY;
  const centerAngle = Math.atan2(toCenterY, toCenterX) + (Math.random() - 0.5) * 0.8;
  orb.vx = Math.cos(centerAngle) * 2.6;
  orb.vy = Math.sin(centerAngle) * 2.6;
  activeOrbs.push(orb);

  // Trigger ripple pattern at the clicked button location
  if (typeof clickX === "number" && typeof clickY === "number") {
    spawnGolPattern(clickX, clickY);
  }
  wakeBackgroundLoop();
}

function ensureDefaultOrb() {
  if (activeOrbs.length === 0) {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const slot = ORB_SPACES[0];
    activeOrbs.push(createOrb(slot.xRatio * w, slot.yRatio * h, 1.85, 0));
  }
}

let orbIdleTimer = null;
const IDLE_DELAY_MS = 2500;
let isWindowFocused = (typeof document !== "undefined" && document.hasFocus) ? document.hasFocus() : true;

function activateOrb() {
  ensureDefaultOrb();
  wakeBackgroundLoop();
}

function deactivateOrb() {
  resetOrbIdleTimer();
}

function resetOrbIdleTimer() {
  clearTimeout(orbIdleTimer);
  if (isWindowFocused) {
    orbIdleTimer = setTimeout(() => {
      activateOrb();
    }, IDLE_DELAY_MS);
  }
}

// Start with 1 default living organism
ensureDefaultOrb();
resetOrbIdleTimer();
