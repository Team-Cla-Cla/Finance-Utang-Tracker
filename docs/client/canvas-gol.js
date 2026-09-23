// Conway's Game of Life Cellular Automaton & Pattern Engine.

// Conway's Game of Life Cellular Automaton & Dynamic Pulsing State
let golCols = 0;
let golRows = 0;
let golStartX = 0;
let golStartY = 0;
const golSpacing = 28;
let golGrid = null;
let golNextGrid = null;
let lastGolTick = 0;
const GOL_TICK_MS = 140; // ~7 generations/sec
let golPatternIndex = 0;
let lastOrbSeedTime = 0;

// Iconic Conway Patterns (relative offsets [dc, dr])
const GOL_PATTERNS = [
  // 0: Glider (glides diagonally across the screen)
  [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  // 1: Pulsar / Cross oscillator
  [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]],
  // 2: R-Pentomino (long-lived chaotic burst evolving for > 80 generations)
  [[0, 1], [1, 0], [1, 1], [1, 2], [2, 0]],
  // 3: Lightweight Spaceship (LWSS)
  [[0, 1], [0, 4], [1, 0], [2, 0], [3, 0], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3]],
  // 4: Beacon / Toad oscillator
  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2], [2, 3], [3, 2], [3, 3]],
  // 5: Exploding Nova Ring
  [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0], [0, -1], [0, 1]]
];

function spawnGolPattern(centerX, centerY, patternType = -1) {
  if (!golGrid || golCols < 4 || golRows < 4) return;
  const c = Math.round((centerX - golStartX) / golSpacing);
  const r = Math.round((centerY - golStartY) / golSpacing);
  if (c < 0 || c >= golCols || r < 0 || r >= golRows) return;

  const pattern = patternType >= 0 
    ? GOL_PATTERNS[patternType % GOL_PATTERNS.length] 
    : GOL_PATTERNS[(golPatternIndex++) % GOL_PATTERNS.length];

  for (let i = 0; i < pattern.length; i++) {
    const dc = pattern[i][0];
    const dr = pattern[i][1];
    const nc = (c + dc + golCols) % golCols;
    const nr = (r + dr + golRows) % golRows;
    const idx = nc * golRows + nr;
    golGrid[idx] = 1;
    if (bgDots[idx]) {
      bgDots[idx].energy = 1.0;
      bgDots[idx].r = 4.8;
    }
  }

  // Physical deflection shockwave propagating outward from click / spawn point
  const shockRadius = 175;
  const numDots = bgDots.length;
  for (let i = 0; i < numDots; i++) {
    const dot = bgDots[i];
    const dx = dot.ox - centerX;
    const dy = dot.oy - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < shockRadius && dist > 1) {
      const force = (1 - dist / shockRadius) * 16;
      const angle = Math.atan2(dy, dx);
      dot.vx += Math.cos(angle) * force;
      dot.vy += Math.sin(angle) * force;
    }
  }

  wakeBackgroundLoop();
}

// Each button click or UI control spawns a living cellular automaton pattern!
window.addEventListener("click", (e) => {
  const target = e.target;
  const isButton = target && (
    target.tagName === "BUTTON" ||
    target.closest("button") ||
    target.classList.contains("btn") ||
    target.closest(".btn") ||
    target.classList.contains("action-btn") ||
    target.classList.contains("pill-btn") ||
    target.classList.contains("stash-pill") ||
    target.closest(".modal-close-btn") ||
    target.closest(".stash-card") ||
    target.closest(".summary-card") ||
    target.closest(".analytics-stat-card") ||
    target.getAttribute("role") === "button" ||
    target.tagName === "A"
  );

  if (isButton) {
    // Spawn 1 new living organism that swims outward from this button!
    spawnOrbInNextSpace(e.clientX, e.clientY);
  } else if (e.clientX < window.innerWidth && e.clientY < window.innerHeight) {
    // Subtle mini-burst on other background clicks
    spawnGolPattern(e.clientX, e.clientY, 1);
  }
}, true);

function stepGameOfLife() {
  if (!golGrid || golCols < 3 || golRows < 3) return;
  let aliveCount = 0;

  for (let c = 0; c < golCols; c++) {
    const cLeft = (c - 1 + golCols) % golCols;
    const cRight = (c + 1) % golCols;

    for (let r = 0; r < golRows; r++) {
      const rUp = (r - 1 + golRows) % golRows;
      const rDown = (r + 1) % golRows;

      // 8 toroidal neighbors
      const neighbors =
        golGrid[cLeft * golRows + rUp] +
        golGrid[cLeft * golRows + r] +
        golGrid[cLeft * golRows + rDown] +
        golGrid[c * golRows + rUp] +
        golGrid[c * golRows + rDown] +
        golGrid[cRight * golRows + rUp] +
        golGrid[cRight * golRows + r] +
        golGrid[cRight * golRows + rDown];

      const idx = c * golRows + r;
      const wasAlive = golGrid[idx];

      if (wasAlive === 1) {
        if (neighbors === 2 || neighbors === 3) {
          golNextGrid[idx] = 1;
          aliveCount++;
        } else {
          golNextGrid[idx] = 0;
        }
      } else {
        if (neighbors === 3) {
          golNextGrid[idx] = 1;
          aliveCount++;
        } else {
          golNextGrid[idx] = 0;
        }
      }
    }
  }

  // Fast typed array buffer swap
  const temp = golGrid;
  golGrid = golNextGrid;
  golNextGrid = temp;

  // Extinction safeguard: if total living cells drop below 4, inject a fresh seed
  if (aliveCount < 4 && (activeOrbs.length > 0 || !isWindowFocused)) {
    const randX = 100 + Math.random() * (bgGridW - 200);
    const randY = 100 + Math.random() * (bgGridH - 200);
    spawnGolPattern(randX, randY, 0); // Glider
  }
}
