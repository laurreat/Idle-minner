// ============================================================
// IDLE MINER - Deep Earth Edition
// Complete game engine with save system, multi-floor,
// achievements, prestige, auto-miners, and ad integration
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = 1000, H = 750;
const S = 1.25; // scale factor from original 800x600

// ============================================================
// SPRITE LOADER
// ============================================================
const sprites = {};
const spriteNames = [
  "miner_idle","miner_walk_1","miner_walk_2",
  "miner_walk_reverse_1","miner_walk_reverse_2",
  "miner_elevador_0","miner_elevador_1","miner_elevador_2",
  "miner_tolva_1","miner_tolva_2",
  "miner_tolva_reverse_1","miner_tolva_reverse_2",
  "miner_tolva_reverse_3","miner_tolva_reverse_4",
  "miner_mine",
  "tolva_miner_0","tolva_miner_1","tolva_miner_2","tolva_miner_3"
];
spriteNames.forEach(name => {
  sprites[name] = new Image();
  sprites[name].src = `Sprites/${name}.png`;
});
const backgroundImage = new Image();
backgroundImage.src = "fondo.png";

// ============================================================
// GAME STATE
// ============================================================
let game = {
  cash: 0,
  gems: 0,
  totalEarned: 0,
  totalMined: 0,
  totalClicks: 0,
  score: 0,
  currentFloor: 0,
  prestigeCount: 0,
  prestigeGems: 0,
  totalPrestigeGems: 0,
  startTime: Date.now(),
  lastSave: Date.now(),
  paused: false,
  started: false
};

// ============================================================
// FLOORS (10 unique floors with different themes and materials)
// ============================================================
const FLOOR_CONFIGS = [
  { name: "Superficie", bg: "#87CEEB", rockColor: "#8B7355", oreColor: "#FFD700", oreValue: 1, oreChance: 0.3, unlockCost: 0, depth: 0, material: "Tierra", materialIcon: "🟫" },
  { name: "Tierra", bg: "#6B4226", rockColor: "#5C3317", oreColor: "#C0C0C0", oreValue: 2, oreChance: 0.25, unlockCost: 500, depth: 100, material: "Carbón", materialIcon: "⬛" },
  { name: "Piedra", bg: "#4A4A4A", rockColor: "#3A3A3A", oreColor: "#CD7F32", oreValue: 5, oreChance: 0.2, unlockCost: 5000, depth: 300, material: "Hierro", materialIcon: "🔩" },
  { name: "Cueva Cristalina", bg: "#1a3a5c", rockColor: "#2a4a6c", oreColor: "#00CED1", oreValue: 12, oreChance: 0.18, unlockCost: 25000, depth: 600, material: "Cobre", materialIcon: "🟠" },
  { name: "Magma", bg: "#4a0a0a", rockColor: "#3a0a0a", oreColor: "#FF4500", oreValue: 30, oreChance: 0.15, unlockCost: 100000, depth: 1000, material: "Oro", materialIcon: "🟡" },
  { name: "Obsidiana", bg: "#0a0a1a", rockColor: "#050510", oreColor: "#9400D3", oreValue: 75, oreChance: 0.12, unlockCost: 500000, depth: 1500, material: "Plata", materialIcon: "⚪" },
  { name: "Diamante", bg: "#0a1a2a", rockColor: "#0a1525", oreColor: "#00FFFF", oreValue: 200, oreChance: 0.1, unlockCost: 2500000, depth: 2200, material: "Platino", materialIcon: "💠" },
  { name: "Núcleo Exterior", bg: "#2a0a00", rockColor: "#1a0500", oreColor: "#FF6347", oreValue: 500, oreChance: 0.08, unlockCost: 10000000, depth: 3000, material: "Rubí", materialIcon: "🔴" },
  { name: "Núcleo Interno", bg: "#1a0000", rockColor: "#0f0000", oreColor: "#FFD700", oreValue: 1500, oreChance: 0.06, unlockCost: 50000000, depth: 4000, material: "Esmeralda", materialIcon: "🟢" },
  { name: "Centro de la Tierra", bg: "#000000", rockColor: "#050005", oreColor: "#FFFFFF", oreValue: 5000, oreChance: 0.04, unlockCost: 250000000, depth: 5000, material: "Diamante", materialIcon: "💎" }
];

// Unlocked floors
let unlockedFloors = [true, false, false, false, false, false, false, false, false, false];

// ============================================================
// FLOOR-SPECIFIC MINING SYSTEM
// ============================================================
let floors = [];

function initFloor(index) {
  const config = FLOOR_CONFIGS[index];
  return {
    index: index,
    config: config,
    miner: { x: 350, y: 560, width: 45, height: 45, material: 0, isMining: false },
    elevator: { x: 100, y: 300, width: 45, height: 45, carrying: 0, isMoving: false, direction: 1, state: "idle", maxCapacity: 130 },
    storage: { x: 800, y: 300, width: 45, height: 45, carrying: 0, isCollecting: false, state: "idle", currentSprite: null, initialX: 800, maxCapacity: 100, collectionTime: 500 },
    minerBox: { x: 200, y: 560, width: 77, height: 77, material: 0 },
    elevatorBox: { x: 90, y: 240, width: 1, height: 1, material: 0 },
    minerState: { isWaiting: false, miningTimeout: null, miningTime: 5000 },
    elevatorState: { isWaiting: false, elevatorTimeout: null },
    storageState: { isWaiting: false, storageTimeout: null },
    autoMiner: { active: false, timer: 0, interval: 3000 },
    particles: [],
    gemsFound: 0
  };
}

function initAllFloors() {
  floors = [];
  for (let i = 0; i < FLOOR_CONFIGS.length; i++) {
    floors.push(initFloor(i));
  }
}

// ============================================================
// UPGRADES (per-floor)
// ============================================================
function createUpgrades() {
  return {
    miner: {
      level: 0, maxLevel: 50, baseCost: 100, baseTime: 5000, baseMining: 10,
      costMultiplier: 1.8,
      getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
      getMiningAmount() { return this.baseMining + this.level * 3; },
      getMiningTime() { return Math.max(500, this.baseTime - this.level * 80); }
    },
    elevator: {
      level: 0, maxLevel: 50, baseCost: 200, baseSpeed: 2, baseCapacity: 50,
      costMultiplier: 1.7,
      getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
      getSpeed() { return this.baseSpeed + this.level * 0.4; },
      getCapacity() { return this.baseCapacity + this.level * 15; }
    },
    storage: {
      level: 0, maxLevel: 50, baseCost: 300, baseCapacity: 40, baseCollectionTime: 800,
      costMultiplier: 1.7,
      getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
      getCapacity() { return this.baseCapacity + this.level * 20; },
      getCollectionTime() { return Math.max(100, this.baseCollectionTime * Math.pow(0.95, this.level)); }
    },
    autoMiner: {
      level: 0, maxLevel: 20, baseCost: 5000, baseInterval: 5000,
      costMultiplier: 2.5,
      getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
      getInterval() { return Math.max(500, this.baseInterval - this.level * 200); },
      isActive() { return this.level > 0; }
    },
    sellMultiplier: {
      level: 0, maxLevel: 30, baseCost: 1000, baseMultiplier: 10,
      costMultiplier: 2.0,
      getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
      getMultiplier() { return this.baseMultiplier + this.level * 2; }
    }
  };
}

// Per-floor upgrades
let floorUpgrades = [];
function initFloorUpgrades() {
  floorUpgrades = [];
  for (let i = 0; i < FLOOR_CONFIGS.length; i++) {
    floorUpgrades.push(createUpgrades());
  }
}

// ============================================================
// GLOBAL UPGRADES (apply to all floors)
// ============================================================
const globalUpgrades = {
  luck: {
    level: 0, maxLevel: 25, baseCost: 2000, costMultiplier: 2.2, currency: "gems",
    getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
    getGemChance() { return 0.01 + this.level * 0.005; }
  },
  speedBoost: {
    level: 0, maxLevel: 20, baseCost: 5000, costMultiplier: 2.0, currency: "gems",
    getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
    getSpeedMult() { return 1 + this.level * 0.1; }
  }
};

// ============================================================
// ACHIEVEMENTS
// ============================================================
const ACHIEVEMENTS = [
  { id: "first_mine", name: "Primera Mina", desc: "Mina por primera vez", icon: "⛏️", check: () => game.totalClicks >= 1, reward: "50 oro" },
  { id: "hundred_clicks", name: "Minero Dedicado", desc: "Haz clic 100 veces", icon: "👆", check: () => game.totalClicks >= 100, reward: "200 oro" },
  { id: "thousand_clicks", name: "Minero Experto", desc: "Haz clic 1,000 veces", icon: "💪", check: () => game.totalClicks >= 1000, reward: "1 gema" },
  { id: "first_k", name: "Primer Mil", desc: "Gana $1,000 en total", icon: "💰", check: () => game.totalEarned >= 1000, reward: "100 oro" },
  { id: "first_100k", name: "Rico", desc: "Gana $100,000 en total", icon: "🤑", check: () => game.totalEarned >= 100000, reward: "5 gemas" },
  { id: "first_million", name: "Millonario", desc: "Gana $1,000,000 en total", icon: "💎", check: () => game.totalEarned >= 1000000, reward: "25 gemas" },
  { id: "floor_2", name: "Explorador", desc: "Desbloquea el Piso 2", icon: "🔓", check: () => unlockedFloors[1], reward: "2 gemas" },
  { id: "floor_5", name: "Profundo", desc: "Desbloquea el Piso 5", icon: "🕳️", check: () => unlockedFloors[4], reward: "10 gemas" },
  { id: "floor_10", name: "Centro de la Tierra", desc: "Desbloquea todos los pisos", icon: "🌍", check: () => unlockedFloors[9], reward: "50 gemas" },
  { id: "prestige_1", name: "Renacimiento", desc: "Haz tu primer prestigio", icon: "⭐", check: () => game.prestigeCount >= 1, reward: "10 gemas" },
  { id: "prestige_5", name: "Veterano", desc: "Haz 5 prestigios", icon: "🌟", check: () => game.prestigeCount >= 5, reward: "50 gemas" },
  { id: "auto_miner", name: "Automatización", desc: "Compra un auto-minero", icon: "🤖", check: () => { for (let f of floorUpgrades) if (f.autoMiner.level > 0) return true; return false; }, reward: "5 gemas" },
  { id: "speed_max", name: "Velocidad Máxima", desc: "Maximiza la velocidad del elevador", icon: "⚡", check: () => { for (let f of floorUpgrades) if (f.elevator.level >= f.elevator.maxLevel) return true; return false; }, reward: "15 gemas" },
  { id: "ten_k_mined", name: "Toneladas", desc: "Mina 10,000 unidades", icon: "🏔️", check: () => game.totalMined >= 10000, reward: "3 gemas" },
  { id: "score_100k", name: "Puntuación Alta", desc: "Alcanza 100,000 puntos", icon: "🏆", check: () => game.score >= 100000, reward: "20 gemas" }
];

let unlockedAchievements = new Set();

// ============================================================
// SAVE / LOAD SYSTEM (localStorage)
// ============================================================
const SAVE_KEY = "idleMiner_deepEarth_v2";

function saveGame() {
  const saveData = {
    game: game,
    unlockedFloors: unlockedFloors,
    unlockedAchievements: [...unlockedAchievements],
    floors: floors.map(f => ({
      miner: f.miner,
      elevator: { x: f.elevator.x, y: f.elevator.y, carrying: f.elevator.carrying, isMoving: false, direction: 1, state: "idle", maxCapacity: f.elevator.maxCapacity },
      storage: { x: f.storage.x, carrying: f.storage.carrying, isCollecting: false, state: "idle", currentSprite: null, initialX: 600, maxCapacity: f.storage.maxCapacity, collectionTime: f.storage.collectionTime },
      minerBox: f.minerBox,
      elevatorBox: f.elevatorBox,
      gemsFound: f.gemsFound,
      minerState: { isWaiting: false, miningTimeout: null, miningTime: f.minerState.miningTime },
      elevatorState: { isWaiting: false, elevatorTimeout: null },
      storageState: { isWaiting: false, storageTimeout: null },
      autoMiner: f.autoMiner
    })),
    floorUpgrades: floorUpgrades.map(fu => ({
      miner: { level: fu.miner.level },
      elevator: { level: fu.elevator.level },
      storage: { level: fu.storage.level },
      autoMiner: { level: fu.autoMiner.level },
      sellMultiplier: { level: fu.sellMultiplier.level }
    })),
    globalUpgrades: {
      luck: { level: globalUpgrades.luck.level },
      speedBoost: { level: globalUpgrades.speedBoost.level }
    }
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    showToast("💾 Partida guardada");
  } catch (e) {
    console.error("Save failed:", e);
  }
}

function loadGame() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return false;

    const save = JSON.parse(data);

    // Restore game state
    Object.assign(game, save.game);
    unlockedFloors = save.unlockedFloors;
    unlockedAchievements = new Set(save.unlockedAchievements);

    // Restore floors
    initAllFloors();
    if (save.floors) {
      save.floors.forEach((sf, i) => {
        if (floors[i]) {
          Object.assign(floors[i].miner, sf.miner);
          Object.assign(floors[i].elevator, sf.elevator);
          Object.assign(floors[i].storage, sf.storage);
          Object.assign(floors[i].minerBox, sf.minerBox);
          Object.assign(floors[i].elevatorBox, sf.elevatorBox);
          Object.assign(floors[i].minerState, sf.minerState);
          Object.assign(floors[i].elevatorState, sf.elevatorState);
          Object.assign(floors[i].storageState, sf.storageState);
          Object.assign(floors[i].autoMiner, sf.autoMiner);
          floors[i].gemsFound = sf.gemsFound || 0;
        }
      });
    }

    // Restore upgrades
    initFloorUpgrades();
    if (save.floorUpgrades) {
      save.floorUpgrades.forEach((sfu, i) => {
        if (floorUpgrades[i]) {
          floorUpgrades[i].miner.level = sfu.miner.level;
          floorUpgrades[i].elevator.level = sfu.elevator.level;
          floorUpgrades[i].storage.level = sfu.storage.level;
          floorUpgrades[i].autoMiner.level = sfu.autoMiner.level;
          floorUpgrades[i].sellMultiplier.level = sfu.sellMultiplier.level;
        }
      });
    }

    // Restore global upgrades
    if (save.globalUpgrades) {
      globalUpgrades.luck.level = save.globalUpgrades.luck.level || 0;
      globalUpgrades.speedBoost.level = save.globalUpgrades.speedBoost.level || 0;
    }

    // Calculate offline earnings
    const offlineTime = (Date.now() - game.lastSave) / 1000;
    if (offlineTime > 30) {
      const offlineEarnings = calculateOfflineEarnings(offlineTime);
      if (offlineEarnings > 0) {
        game.cash += offlineEarnings;
        game.totalEarned += offlineEarnings;
        setTimeout(() => showToast(`💤 Ganaste $${formatNum(offlineEarnings)} mientras no estabas (${formatTime(offlineTime)})`), 1000);
      }
    }

    return true;
  } catch (e) {
    console.error("Load failed:", e);
    return false;
  }
}

function calculateOfflineEarnings(seconds) {
  let total = 0;
  for (let i = 0; i < floors.length; i++) {
    if (!unlockedFloors[i]) continue;
    const fu = floorUpgrades[i];
    if (fu.autoMiner.level > 0) {
      const interval = fu.autoMiner.getInterval() / 1000;
      const cycles = seconds / interval;
      const miningAmount = fu.miner.getMiningAmount();
      const sellMult = fu.sellMultiplier.getMultiplier();
      const elevatorCap = fu.elevator.getCapacity();
      const storageCap = fu.storage.getCapacity();
      const perCycle = Math.min(miningAmount, elevatorCap, storageCap) * sellMult;
      total += cycles * perCycle * 0.5; // 50% efficiency offline
    }
  }
  return Math.floor(total);
}

function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

// ============================================================
// PRESTIGE SYSTEM
// ============================================================
function calculatePrestigeGems() {
  return Math.floor(Math.pow(game.totalEarned / 100000, 0.5));
}

function doPrestige() {
  const gems = calculatePrestigeGems();
  if (gems < 1) return;

  game.prestigeCount++;
  game.prestigeGems += gems;
  game.totalPrestigeGems += gems;
  game.gems += gems;

  // Reset
  game.cash = 0;
  game.totalEarned = 0;
  game.totalMined = 0;
  game.totalClicks = 0;
  game.score = 0;
  game.currentFloor = 0;
  game.startTime = Date.now();

  unlockedFloors = [true, false, false, false, false, false, false, false, false, false];

  initAllFloors();
  initFloorUpgrades();

  saveGame();
  showToast(`⭐ ¡Prestigio! +${gems} gemas`);
  closePanel('prestige');
}

// ============================================================
// PARTICLES
// ============================================================
function spawnParticles(x, y, color, count) {
  const f = floors[game.currentFloor];
  for (let i = 0; i < count; i++) {
    f.particles.push({
      x: x + Math.random() * 40 - 20,
      y: y + Math.random() * 20 - 10,
      vx: Math.random() * 3 - 1.5,
      vy: -Math.random() * 4 - 1,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      size: 3 + Math.random() * 4,
      color: color
    });
  }
}

function updateParticles() {
  const f = floors[game.currentFloor];
  f.particles = f.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
    return p.life > 0;
  });
}

function drawParticles() {
  const f = floors[game.currentFloor];
  f.particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ============================================================
// FLOATING TEXT
// ============================================================
let floatingTexts = [];

function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
}

function updateFloatingTexts() {
  floatingTexts = floatingTexts.filter(ft => {
    ft.y += ft.vy;
    ft.life -= 0.015;
    return ft.life > 0;
  });
}

function drawFloatingTexts() {
  floatingTexts.forEach(ft => {
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = ft.color;
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
  });
  ctx.globalAlpha = 1;
}

// ============================================================
// FLOOR MOVEMENT LOGIC
// ============================================================
function getFloorSpeedMult() {
  return globalUpgrades.speedBoost.getSpeedMult();
}

function moveMiner(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.miner.isMining && f.miner.x < 800) {
    f.miner.x += 2.5 * speedMult;
  } else if (f.miner.x >= 800 && !f.minerState.isWaiting) {
    f.minerState.isWaiting = true;
    f.minerState.miningTimeout = setTimeout(() => {
      const amount = fu.miner.getMiningAmount();
      f.miner.material += amount;
      f.minerBox.material += amount;
      f.miner.material = 0;
      game.totalMined += amount;
      game.score += amount * FLOOR_CONFIGS[floorIdx].oreValue;

      // Chance to find gems
      if (Math.random() < globalUpgrades.luck.getGemChance()) {
        f.gemsFound++;
        game.gems++;
        spawnParticles(f.miner.x, f.miner.y, "#a78bfa", 8);
        spawnFloatingText(f.miner.x, f.miner.y - 20, "+1 💎", "#a78bfa");
      }

      spawnParticles(f.miner.x, f.miner.y, FLOOR_CONFIGS[floorIdx].oreColor, 5);
      f.miner.isMining = false;
      f.minerState.isWaiting = false;
    }, fu.miner.getMiningTime());
  } else if (!f.miner.isMining && f.miner.x > 350) {
    f.miner.x -= 2.5 * speedMult;
    if (f.miner.x <= 350) {
      f.miner.x = 350;
    }
  }
}

function moveElevator(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.elevator.isMoving) {
    if (f.elevator.direction === 1) {
      f.elevator.state = "down";
      if (f.elevator.y < f.minerBox.y && !f.elevatorState.isWaiting) {
        f.elevator.y += fu.elevator.getSpeed() * speedMult;
      } else if (f.elevator.y >= f.minerBox.y && !f.elevatorState.isWaiting) {
        const materialToTake = Math.min(f.minerBox.material, fu.elevator.getCapacity());
        const waitTime = materialToTake * (1000 / fu.elevator.getCapacity());
        f.elevatorState.isWaiting = true;
        f.elevatorState.elevatorTimeout = setTimeout(() => {
          f.elevator.carrying = materialToTake;
          f.minerBox.material -= materialToTake;
          f.elevator.direction = -1;
          f.elevator.state = "up";
          f.elevatorState.isWaiting = false;
        }, waitTime);
      }
    } else {
      f.elevator.y -= fu.elevator.getSpeed() * speedMult;
      if (f.elevator.y <= 275) {
        f.elevator.isMoving = false;
        f.elevator.direction = 1;
        f.elevator.state = "idle";
        f.elevatorBox.material += f.elevator.carrying;
        f.elevator.carrying = 0;
      }
    }
  }
}

function moveStorage(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.storage.isCollecting) {
    if (f.storage.state === "idle") {
      f.storage.state = "moving";
    }
    if (f.storage.state === "moving") {
      if (f.storage.x > 212) {
        f.storage.x -= 2.5 * speedMult;
        f.storage.currentSprite = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_tolva_1 : sprites.miner_tolva_2;
      } else if (!f.storageState.isWaiting) {
        if (f.elevatorBox.material > 0) {
          const materialToCollect = Math.min(f.elevatorBox.material, fu.storage.getCapacity());
          const waitTime = materialToCollect * fu.storage.getCollectionTime() / fu.storage.getCapacity();
          f.storageState.isWaiting = true;
          f.storageState.storageTimeout = setTimeout(() => {
            f.storage.carrying = materialToCollect;
            f.elevatorBox.material -= materialToCollect;
            f.storage.state = "returning_full";
            f.storageState.isWaiting = false;
          }, waitTime);
        } else {
          f.storage.state = "returning_empty";
        }
      }
    }
  }

  if (f.storage.state === "returning_full") {
    if (f.storage.x < f.storage.initialX) {
      f.storage.x += 2.5 * speedMult;
      f.storage.currentSprite = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_tolva_reverse_1 : sprites.miner_tolva_reverse_2;
    } else {
      if (f.storage.carrying > 0) {
        const sellMult = fu.sellMultiplier.getMultiplier();
        const earned = f.storage.carrying * sellMult;
        game.cash += earned;
        game.totalEarned += earned;
        game.score += earned;
        spawnFloatingText(f.storage.x, f.storage.y - 30, `+$${formatNum(earned)}`, "#FFD700");
        f.storage.carrying = 0;
      }
      f.storage.state = "idle";
      f.storage.isCollecting = false;
      f.storage.currentSprite = sprites.miner_tolva_1;
    }
  }

  if (f.storage.state === "returning_empty") {
    if (f.storage.x < f.storage.initialX) {
      f.storage.x += 2.5 * speedMult;
      f.storage.currentSprite = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_tolva_reverse_3 : sprites.miner_tolva_reverse_4;
    } else {
      f.storage.state = "idle";
      f.storage.isCollecting = false;
      f.storage.currentSprite = sprites.miner_tolva_1;
    }
  }
}

// Auto miner
function updateAutoMiner(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];

  if (fu.autoMiner.isActive() && !f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= 300) {
    f.autoMiner.timer += 16;
    if (f.autoMiner.timer >= fu.autoMiner.getInterval()) {
      f.autoMiner.timer = 0;
      f.miner.isMining = true;
    }
  }
}

// ============================================================
// DRAWING
// ============================================================
function drawBackground() {
  const f = floors[game.currentFloor];
  const config = f.config;

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, config.bg);
  grad.addColorStop(1, config.rockColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Rock texture dots
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let i = 0; i < 50; i++) {
    const rx = (i * 137 + config.depth) % W;
    const ry = (i * 251 + config.depth * 2) % H;
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // Depth indicator
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`${config.depth}m`, 10, H - 10);

  // Try to draw background image if available
  if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(backgroundImage, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

function drawBoxes(floorIdx) {
  const f = floors[floorIdx];
  const config = f.config;

  // MinerBox
  let tolvaSprite;
  const oro = f.minerBox.material * config.oreValue;
  if (oro <= 900) tolvaSprite = sprites.tolva_miner_0;
  else if (oro <= 2100) tolvaSprite = sprites.tolva_miner_1;
  else if (oro <= 5000) tolvaSprite = sprites.tolva_miner_2;
  else tolvaSprite = sprites.tolva_miner_3;

  // Draw tolva sprite
  if (tolvaSprite && tolvaSprite.complete) {
    ctx.drawImage(tolvaSprite, f.minerBox.x, f.minerBox.y, f.minerBox.width, f.minerBox.height);
  } else {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(f.minerBox.x, f.minerBox.y, f.minerBox.width, f.minerBox.height);
  }

  // MinerBox label
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, f.minerBox.x - 10, f.minerBox.y - 28, 100, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`⛏ ${f.minerBox.material}`, f.minerBox.x + 40, f.minerBox.y - 13);

  // ElevatorBox label
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, f.elevatorBox.x - 10, f.elevatorBox.y - 28, 100, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#C0C0C0";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`📦 ${f.elevatorBox.material}`, f.elevatorBox.x + 40, f.elevatorBox.y - 13);

  // Storage carrying indicator
  if (f.storage.carrying > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, f.storage.x - 20, f.storage.y - 30, 80, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`💰 ${f.storage.carrying}`, f.storage.x + 20, f.storage.y - 15);
  }
}

function drawMiner(floorIdx) {
  const f = floors[floorIdx];
  let spriteToDraw;

  if (f.miner.isMining) {
    spriteToDraw = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_walk_1 : sprites.miner_walk_2;
  } else if (f.miner.x > 300) {
    spriteToDraw = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_walk_reverse_1 : sprites.miner_walk_reverse_2;
  } else {
    spriteToDraw = sprites.miner_idle;
  }

  const scale = 1.8;
  if (spriteToDraw && spriteToDraw.complete) {
    ctx.drawImage(spriteToDraw,
      f.miner.x - (f.miner.width * (scale - 1)) / 2,
      f.miner.y - (f.miner.height * (scale - 1)) / 2,
      f.miner.width * scale, f.miner.height * scale);
  } else {
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(f.miner.x, f.miner.y, f.miner.width * scale, f.miner.height * scale);
  }
}

function drawElevator(floorIdx) {
  const f = floors[floorIdx];
  let spriteToDraw;
  switch (f.elevator.state) {
    case "down": spriteToDraw = sprites.miner_elevador_1; break;
    case "up": spriteToDraw = sprites.miner_elevador_2; break;
    default: spriteToDraw = sprites.miner_elevador_0;
  }

  const scale = 1.8;
  if (spriteToDraw && spriteToDraw.complete) {
    ctx.drawImage(spriteToDraw,
      f.elevator.x - (f.elevator.width * (scale - 1)) / 2,
      f.elevator.y - (f.elevator.height * (scale - 1)) / 2,
      f.elevator.width * scale, f.elevator.height * scale);
  } else {
    ctx.fillStyle = "#2196F3";
    ctx.fillRect(f.elevator.x, f.elevator.y, f.elevator.width * scale, f.elevator.height * scale);
  }
}

function drawStorage(floorIdx) {
  const f = floors[floorIdx];
  if (!f.storage.currentSprite) f.storage.currentSprite = sprites.miner_tolva_1;
  const scale = 1.8;
  if (f.storage.currentSprite && f.storage.currentSprite.complete) {
    ctx.drawImage(f.storage.currentSprite,
      f.storage.x - (f.storage.width * (scale - 1)) / 2,
      f.storage.y - (f.storage.height * (scale - 1)) / 2,
      f.storage.width * scale, f.storage.height * scale);
  } else {
    ctx.fillStyle = "#FF9800";
    ctx.fillRect(f.storage.x, f.storage.y, f.storage.width * scale, f.storage.height * scale);
  }
}

function drawClickHints() {
  const f = floors[game.currentFloor];
  const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;

  ctx.globalAlpha = pulse * 0.6;
  ctx.fillStyle = "#fff";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";

  // Miner click hint
  if (!f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= 300) {
    ctx.fillText("Click", f.miner.x + 50, f.miner.y + 120);
  }

  // Elevator click hint
  if (!f.elevator.isMoving) {
    ctx.fillText("Click", f.elevator.x + 50, f.elevator.y + 120);
  }

  // Storage click hint
  if (!f.storage.isCollecting) {
    ctx.fillText("Click", f.storage.x + 50, f.storage.y + 120);
  }

  ctx.globalAlpha = 1;
}

function drawFloorIndicator() {
  const config = FLOOR_CONFIGS[game.currentFloor];
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, W / 2 - 130, H - 44, 260, 35, 10);
  ctx.fill();
  ctx.fillStyle = config.oreColor;
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${config.name} | Valor: ${config.oreValue}x`, W / 2, H - 22);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// UI UPDATES
// ============================================================
function updateHUD() {
  document.getElementById("hudCash").textContent = `$${formatNum(game.cash)}`;
  document.getElementById("hudGems").textContent = `💎 ${game.gems}`;
  document.getElementById("hudFloor").textContent = `Piso ${game.currentFloor + 1}: ${FLOOR_CONFIGS[game.currentFloor].name}`;
  document.getElementById("hudScore").textContent = `Score: ${formatNum(game.score)}`;

  // Calculate per second
  let perSec = 0;
  for (let i = 0; i < floors.length; i++) {
    if (!unlockedFloors[i]) continue;
    const fu = floorUpgrades[i];
    if (fu.autoMiner.isActive()) {
      const cyclesPerSec = 1000 / fu.autoMiner.getInterval();
      const amount = Math.min(fu.miner.getMiningAmount(), fu.elevator.getCapacity(), fu.storage.getCapacity());
      perSec += cyclesPerSec * amount * fu.sellMultiplier.getMultiplier();
    }
  }
  document.getElementById("hudPerSec").textContent = `$${formatNum(Math.floor(perSec))}/s`;

  // Time
  const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  document.getElementById("hudTime").textContent = `${mins}:${secs}`;
}

function updateFloorBar() {
  const bar = document.getElementById("floorBar");
  bar.innerHTML = "";
  FLOOR_CONFIGS.forEach((config, i) => {
    const dot = document.createElement("div");
    dot.className = "floor-dot";
    if (i === game.currentFloor) dot.classList.add("current");
    else if (unlockedFloors[i]) dot.classList.add("unlocked");
    else dot.classList.add("locked");
    dot.setAttribute("data-tooltip", `${config.name} - ${config.material}`);
    dot.title = config.name + (unlockedFloors[i] ? "" : ` ($${formatNum(config.unlockCost)})`);
    dot.onclick = () => switchFloor(i);
    bar.appendChild(dot);
  });
}

// ============================================================
// GAME ACTIONS
// ============================================================
function switchFloor(index) {
  if (!unlockedFloors[index]) {
    const cost = FLOOR_CONFIGS[index].unlockCost;
    if (game.cash >= cost) {
      game.cash -= cost;
      unlockedFloors[index] = true;
      game.currentFloor = index;
      showToast(`🔓 ¡Piso ${index + 1} desbloqueado!`);
      checkAchievements();
      updateFloorBar();
    } else {
      showToast(`❌ Necesitas $${formatNum(cost)}`);
    }
    return;
  }
  game.currentFloor = index;
  updateFloorBar();
}

function handleCanvasClick(event) {
  if (game.paused || !game.started) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const f = floors[game.currentFloor];

  // Click on miner
  if (x >= f.miner.x && x <= f.miner.x + f.miner.width * 1.8 &&
      y >= f.miner.y && y <= f.miner.y + f.miner.height * 1.8) {
    if (!f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= 300) {
      f.miner.isMining = true;
      game.totalClicks++;
    }
  }

  // Click on elevator
  if (x >= f.elevator.x && x <= f.elevator.x + f.elevator.width * 1.8 &&
      y >= f.elevator.y && y <= f.elevator.y + f.elevator.height * 1.8) {
    if (!f.elevator.isMoving) {
      f.elevator.isMoving = true;
      game.totalClicks++;
    }
  }

  // Click on storage
  if (x >= f.storage.x && x <= f.storage.x + f.storage.width * 1.8 &&
      y >= f.storage.y && y <= f.storage.y + f.storage.height * 1.8) {
    if (!f.storage.isCollecting) {
      f.storage.isCollecting = true;
      game.totalClicks++;
    }
  }
}

// ============================================================
// SHOP / PANELS
// ============================================================
function openPanel(type) {
  document.getElementById(`panel-${type}`).classList.add("active");
  game.paused = true;
  if (type === "shop") renderShop();
  else if (type === "achievements") renderAchievements();
  else if (type === "stats") renderStats();
  else if (type === "prestige") renderPrestige();
}

function closePanel(type) {
  document.getElementById(`panel-${type}`).classList.remove("active");
  game.paused = false;
}

function renderShop() {
  const body = document.getElementById("shopBody");
  const fu = floorUpgrades[game.currentFloor];
  const config = FLOOR_CONFIGS[game.currentFloor];

  let html = `<div class="shop-section"><h3>⛏️ Piso ${game.currentFloor + 1}: ${config.name}</h3>`;

  // Miner upgrade
  const minerCost = fu.miner.getCurrentCost();
  const canMiner = game.cash >= minerCost && fu.miner.level < fu.miner.maxLevel;
  html += `<div class="shop-item ${!canMiner ? (fu.miner.level >= fu.miner.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('miner')">
    <div class="shop-icon" style="background:rgba(16,185,129,0.15);">⛏️</div>
    <div class="shop-info">
      <div class="name">Minero</div>
      <div class="desc">+3 material, -80ms tiempo</div>
      <div class="level">Nivel ${fu.miner.level}/${fu.miner.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.miner.level >= fu.miner.maxLevel ? 'MAX' : '$' + formatNum(minerCost)}</div>
  </div>`;

  // Elevator upgrade
  const elevCost = fu.elevator.getCurrentCost();
  const canElev = game.cash >= elevCost && fu.elevator.level < fu.elevator.maxLevel;
  html += `<div class="shop-item ${!canElev ? (fu.elevator.level >= fu.elevator.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('elevator')">
    <div class="shop-icon" style="background:rgba(33,150,243,0.15);">🛗</div>
    <div class="shop-info">
      <div class="name">Elevador</div>
      <div class="desc">+0.4 velocidad, +15 capacidad</div>
      <div class="level">Nivel ${fu.elevator.level}/${fu.elevator.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.elevator.level >= fu.elevator.maxLevel ? 'MAX' : '$' + formatNum(elevCost)}</div>
  </div>`;

  // Storage upgrade
  const storCost = fu.storage.getCurrentCost();
  const canStor = game.cash >= storCost && fu.storage.level < fu.storage.maxLevel;
  html += `<div class="shop-item ${!canStor ? (fu.storage.level >= fu.storage.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('storage')">
    <div class="shop-icon" style="background:rgba(255,152,0,0.15);">📦</div>
    <div class="shop-info">
      <div class="name">Almacén</div>
      <div class="desc">+20 capacidad, -5% tiempo</div>
      <div class="level">Nivel ${fu.storage.level}/${fu.storage.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.storage.level >= fu.storage.maxLevel ? 'MAX' : '$' + formatNum(storCost)}</div>
  </div>`;

  // Sell multiplier
  const sellCost = fu.sellMultiplier.getCurrentCost();
  const canSell = game.cash >= sellCost && fu.sellMultiplier.level < fu.sellMultiplier.maxLevel;
  html += `<div class="shop-item ${!canSell ? (fu.sellMultiplier.level >= fu.sellMultiplier.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('sellMultiplier')">
    <div class="shop-icon" style="background:rgba(255,215,0,0.15);">💰</div>
    <div class="shop-info">
      <div class="name">Multiplicador Venta</div>
      <div class="desc">+2x valor de venta (actual: ${fu.sellMultiplier.getMultiplier()}x)</div>
      <div class="level">Nivel ${fu.sellMultiplier.level}/${fu.sellMultiplier.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.sellMultiplier.level >= fu.sellMultiplier.maxLevel ? 'MAX' : '$' + formatNum(sellCost)}</div>
  </div>`;

  // Auto Miner
  const autoCost = fu.autoMiner.getCurrentCost();
  const canAuto = game.cash >= autoCost && fu.autoMiner.level < fu.autoMiner.maxLevel;
  html += `<div class="shop-item ${!canAuto ? (fu.autoMiner.level >= fu.autoMiner.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('autoMiner')">
    <div class="shop-icon" style="background:rgba(139,92,246,0.15);">🤖</div>
    <div class="shop-info">
      <div class="name">Auto-Minero</div>
      <div class="desc">Mina automáticamente cada ${fu.autoMiner.isActive() ? (fu.autoMiner.getInterval()/1000).toFixed(1) + 's' : '5s'}</div>
      <div class="level">Nivel ${fu.autoMiner.level}/${fu.autoMiner.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.autoMiner.level >= fu.autoMiner.maxLevel ? 'MAX' : '$' + formatNum(autoCost)}</div>
  </div>`;

  html += `</div>`;

  // Global upgrades
  html += `<div class="shop-section"><h3>🌍 Mejoras Globales</h3>`;

  // Luck
  const luckCost = globalUpgrades.luck.getCurrentCost();
  const canLuck = game.gems >= luckCost && globalUpgrades.luck.level < globalUpgrades.luck.maxLevel;
  html += `<div class="shop-item ${!canLuck ? (globalUpgrades.luck.level >= globalUpgrades.luck.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('luck')">
    <div class="shop-icon" style="background:rgba(167,139,250,0.15);">🍀</div>
    <div class="shop-info">
      <div class="name">Suerte</div>
      <div class="desc">+0.5% chance de gemas (actual: ${(globalUpgrades.luck.getGemChance()*100).toFixed(1)}%)</div>
      <div class="level">Nivel ${globalUpgrades.luck.level}/${globalUpgrades.luck.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.luck.level >= globalUpgrades.luck.maxLevel ? 'MAX' : '💎 ' + luckCost}</div>
  </div>`;

  // Speed Boost
  const speedCost = globalUpgrades.speedBoost.getCurrentCost();
  const canSpeed = game.gems >= speedCost && globalUpgrades.speedBoost.level < globalUpgrades.speedBoost.maxLevel;
  html += `<div class="shop-item ${!canSpeed ? (globalUpgrades.speedBoost.level >= globalUpgrades.speedBoost.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('speedBoost')">
    <div class="shop-icon" style="background:rgba(236,72,153,0.15);">⚡</div>
    <div class="shop-info">
      <div class="name">Velocidad Global</div>
      <div class="desc">+10% velocidad en todos los pisos (actual: ${globalUpgrades.speedBoost.getSpeedMult().toFixed(1)}x)</div>
      <div class="level">Nivel ${globalUpgrades.speedBoost.level}/${globalUpgrades.speedBoost.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.speedBoost.level >= globalUpgrades.speedBoost.maxLevel ? 'MAX' : '💎 ' + speedCost}</div>
  </div>`;

  html += `</div>`;

  // Unlock next floor
  const nextFloor = game.currentFloor + 1;
  if (nextFloor < FLOOR_CONFIGS.length && !unlockedFloors[nextFloor]) {
    const cost = FLOOR_CONFIGS[nextFloor].unlockCost;
    const canUnlock = game.cash >= cost;
    html += `<div class="shop-section"><h3>🔓 Desbloquear Piso</h3>
    <div class="shop-item ${!canUnlock ? 'cant-afford' : ''}" onclick="switchFloor(${nextFloor})">
      <div class="shop-icon" style="background:rgba(255,215,0,0.15);">🗺️</div>
      <div class="shop-info">
        <div class="name">${FLOOR_CONFIGS[nextFloor].name}</div>
        <div class="desc">Profundidad: ${FLOOR_CONFIGS[nextFloor].depth}m | Valor: ${FLOOR_CONFIGS[nextFloor].oreValue}x</div>
      </div>
      <div class="shop-cost cost-gold">$${formatNum(cost)}</div>
    </div></div>`;
  }

  body.innerHTML = html;
}

function buyUpgrade(type) {
  const fu = floorUpgrades[game.currentFloor];
  const upgrade = fu[type];
  const cost = upgrade.getCurrentCost();

  if (game.cash >= cost && upgrade.level < upgrade.maxLevel) {
    game.cash -= cost;
    upgrade.level++;
    renderShop();
    checkAchievements();
    showToast(`⬆️ ${type} mejorado a nivel ${upgrade.level}`);
  }
}

function buyGlobalUpgrade(type) {
  const upgrade = globalUpgrades[type];
  const cost = upgrade.getCurrentCost();

  if (game.gems >= cost && upgrade.level < upgrade.maxLevel) {
    game.gems -= cost;
    upgrade.level++;
    renderShop();
    checkAchievements();
    showToast(`⬆️ ${type} mejorado a nivel ${upgrade.level}`);
  }
}

function renderAchievements() {
  const body = document.getElementById("achievementsBody");
  let html = `<div style="margin-bottom:12px;color:#64748b;font-size:13px;">${unlockedAchievements.size}/${ACHIEVEMENTS.length} desbloqueados</div>`;

  ACHIEVEMENTS.forEach(ach => {
    const unlocked = unlockedAchievements.has(ach.id);
    html += `<div class="achievement ${unlocked ? 'unlocked' : 'locked'}">
      <div class="ach-icon">${ach.icon}</div>
      <div class="ach-info">
        <div class="ach-name">${unlocked ? ach.name : '???'}</div>
        <div class="ach-desc">${ach.desc}</div>
        <div class="ach-reward">Recompensa: ${ach.reward}</div>
      </div>
    </div>`;
  });

  body.innerHTML = html;
}

function renderStats() {
  const body = document.getElementById("statsBody");
  const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
  body.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div style="padding:12px;background:rgba(255,215,0,0.08);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">💰 Oro Total Ganado</div>
        <div style="font-size:20px;font-weight:800;color:#FFD700;">$${formatNum(game.totalEarned)}</div>
      </div>
      <div style="padding:12px;background:rgba(167,139,250,0.08);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">💎 Gemas</div>
        <div style="font-size:20px;font-weight:800;color:#a78bfa;">${game.gems}</div>
      </div>
      <div style="padding:12px;background:rgba(16,185,129,0.08);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">⛏️ Total Minado</div>
        <div style="font-size:20px;font-weight:800;color:#10b981;">${formatNum(game.totalMined)}</div>
      </div>
      <div style="padding:12px;background:rgba(236,72,153,0.08);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">👆 Clics Totales</div>
        <div style="font-size:20px;font-weight:800;color:#ec4899;">${formatNum(game.totalClicks)}</div>
      </div>
      <div style="padding:12px;background:rgba(245,158,11,0.08);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">⭐ Prestigios</div>
        <div style="font-size:20px;font-weight:800;color:#f59e0b;">${game.prestigeCount}</div>
      </div>
      <div style="padding:12px;background:rgba(99,102,241,0.08);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">🏆 Puntuación</div>
        <div style="font-size:20px;font-weight:800;color:#6366f1;">${formatNum(game.score)}</div>
      </div>
      <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">⏱️ Tiempo Jugado</div>
        <div style="font-size:20px;font-weight:800;color:#fff;">${formatTime(elapsed)}</div>
      </div>
      <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">🗺️ Pisos Desbloqueados</div>
        <div style="font-size:20px;font-weight:800;color:#fff;">${unlockedFloors.filter(Boolean).length}/${FLOOR_CONFIGS.length}</div>
      </div>
    </div>
  `;
}

function renderPrestige() {
  const body = document.getElementById("prestigeBody");
  const gems = calculatePrestigeGems();
  body.innerHTML = `
    <div class="prestige-info">
      <h3>⭐ Reiniciar por Gemas</h3>
      <p>Al hacer prestigio, pierdes todo tu oro y mejoras de piso, pero ganas <strong>gemas</strong> que dan bonificaciones permanentes.</p>
      <p>Las gemas se usan para mejoras globales que afectan TODOS los pisos.</p>
      <div class="prestige-gems">+${gems} 💎</div>
      <p style="font-size:12px;color:#64748b;">Gemas actuales: ${game.gems} | Total prestigio: ${game.totalPrestigeGems}</p>
      <p style="font-size:12px;color:#64748b;">Prestigios realizados: ${game.prestigeCount}</p>
      ${gems < 1 ? '<p style="color:#ef4444;margin-top:12px;">Necesitas minar más para obtener gemas de prestigio.</p>' : ''}
      <div class="prestige-btns">
        <button class="btn-cancel" onclick="closePanel('prestige')">Cancelar</button>
        ${gems >= 1 ? `<button class="btn-confirm-prestige" onclick="doPrestige()">⭐ Confirmar Prestigio</button>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// ACHIEVEMENTS CHECK
// ============================================================
function checkAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (!unlockedAchievements.has(ach.id) && ach.check()) {
      unlockedAchievements.add(ach.id);
      showToast(`🏆 Logro: ${ach.name}`, true);

      // Grant rewards
      if (ach.reward.includes("gema")) {
        const gems = parseInt(ach.reward) || 1;
        game.gems += gems;
      } else if (ach.reward.includes("oro")) {
        const gold = parseInt(ach.reward.replace(/[^0-9]/g, '')) || 0;
        game.cash += gold;
        game.totalEarned += gold;
      }
    }
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, isAchievement = false) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast${isAchievement ? ' achievement' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// FORMAT HELPERS
// ============================================================
function formatNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toLocaleString();
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ============================================================
// GAME START / CONTINUE
// ============================================================
function startNewGame() {
  game = {
    cash: 0, gems: 0, totalEarned: 0, totalMined: 0, totalClicks: 0,
    score: 0, currentFloor: 0, prestigeCount: 0, prestigeGems: 0,
    totalPrestigeGems: 0, startTime: Date.now(), lastSave: Date.now(),
    paused: false, started: true
  };
  unlockedFloors = [true, false, false, false, false, false, false, false, false, false];
  unlockedAchievements = new Set();
  initAllFloors();
  initFloorUpgrades();
  globalUpgrades.luck.level = 0;
  globalUpgrades.speedBoost.level = 0;

  document.getElementById("startMenu").classList.add("hidden");
  document.getElementById("hud").classList.add("active");
  document.getElementById("sideButtons").classList.add("active");
  document.getElementById("floorBar").classList.add("active");
  updateFloorBar();
}

function continueGame() {
  if (loadGame()) {
    game.started = true;
    game.paused = false;
    document.getElementById("startMenu").classList.add("hidden");
    document.getElementById("hud").classList.add("active");
    document.getElementById("sideButtons").classList.add("active");
    document.getElementById("floorBar").classList.add("active");
    updateFloorBar();
    showToast("📂 Partida cargada");
  }
}

function showMainMenu() {
  document.getElementById("startMenu").classList.remove("hidden");
  document.getElementById("hud").classList.remove("active");
  document.getElementById("sideButtons").classList.remove("active");
  document.getElementById("floorBar").classList.remove("active");

  const hasSaveData = hasSave();
  document.getElementById("btnContinue").style.display = hasSaveData ? "flex" : "none";

  if (hasSaveData) {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      const stats = data.game;
      document.getElementById("menuStats").innerHTML =
        `Última partida: $${formatNum(stats.totalEarned || 0)} | Piso ${stats.currentFloor + 1} | ${formatTime(Math.floor((Date.now() - stats.startTime) / 1000))}`;
    } catch (e) {
      document.getElementById("menuStats").innerHTML = "";
    }
  } else {
    document.getElementById("menuStats").innerHTML = "";
  }
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
function gameLoop() {
  if (game.started && !game.paused) {
    // Update current floor
    moveMiner(game.currentFloor);
    moveElevator(game.currentFloor);
    moveStorage(game.currentFloor);
    updateAutoMiner(game.currentFloor);
    updateParticles();
    updateFloatingTexts();
    checkAchievements();

    // Draw
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawBoxes(game.currentFloor);
    drawMiner(game.currentFloor);
    drawElevator(game.currentFloor);
    drawStorage(game.currentFloor);
    drawParticles();
    drawFloatingTexts();
    drawClickHints();
    drawFloorIndicator();
    updateHUD();
  }

  requestAnimationFrame(gameLoop);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
canvas.addEventListener("click", handleCanvasClick);

// Auto-save every 30 seconds
setInterval(() => {
  if (game.started) {
    game.lastSave = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        game, unlockedFloors, unlockedAchievements: [...unlockedAchievements],
        floors: floors.map(f => ({
          miner: f.miner,
          elevator: { x: f.elevator.x, y: f.elevator.y, carrying: f.elevator.carrying, isMoving: false, direction: 1, state: "idle", maxCapacity: f.elevator.maxCapacity },
          storage: { x: f.storage.x, carrying: f.storage.carrying, isCollecting: false, state: "idle", currentSprite: null, initialX: 600, maxCapacity: f.storage.maxCapacity, collectionTime: f.storage.collectionTime },
          minerBox: f.minerBox, elevatorBox: f.elevatorBox,
          gemsFound: f.gemsFound,
          minerState: { isWaiting: false, miningTimeout: null, miningTime: f.minerState.miningTime },
          elevatorState: { isWaiting: false, elevatorTimeout: null },
          storageState: { isWaiting: false, storageTimeout: null },
          autoMiner: f.autoMiner
        })),
        floorUpgrades: floorUpgrades.map(fu => ({
          miner: { level: fu.miner.level }, elevator: { level: fu.elevator.level },
          storage: { level: fu.storage.level }, autoMiner: { level: fu.autoMiner.level },
          sellMultiplier: { level: fu.sellMultiplier.level }
        })),
        globalUpgrades: { luck: { level: globalUpgrades.luck.level }, speedBoost: { level: globalUpgrades.speedBoost.level } }
      }));
    } catch (e) {}
  }
}, 30000);

// Save on page close
window.addEventListener("beforeunload", () => {
  if (game.started) {
    game.lastSave = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({
      game, unlockedFloors, unlockedAchievements: [...unlockedAchievements],
      floors: floors.map(f => ({
        miner: f.miner,
        elevator: { x: f.elevator.x, y: f.elevator.y, carrying: f.elevator.carrying, isMoving: false, direction: 1, state: "idle", maxCapacity: f.elevator.maxCapacity },
        storage: { x: f.storage.x, carrying: f.storage.carrying, isCollecting: false, state: "idle", currentSprite: null, initialX: 600, maxCapacity: f.storage.maxCapacity, collectionTime: f.storage.collectionTime },
        minerBox: f.minerBox, elevatorBox: f.elevatorBox,
        gemsFound: f.gemsFound,
        minerState: { isWaiting: false, miningTimeout: null, miningTime: f.minerState.miningTime },
        elevatorState: { isWaiting: false, elevatorTimeout: null },
        storageState: { isWaiting: false, storageTimeout: null },
        autoMiner: f.autoMiner
      })),
      floorUpgrades: floorUpgrades.map(fu => ({
        miner: { level: fu.miner.level }, elevator: { level: fu.elevator.level },
        storage: { level: fu.storage.level }, autoMiner: { level: fu.autoMiner.level },
        sellMultiplier: { level: fu.sellMultiplier.level }
      })),
      globalUpgrades: { luck: { level: globalUpgrades.luck.level }, speedBoost: { level: globalUpgrades.speedBoost.level } }
    })); } catch (e) {}
  }
});

// ============================================================
// WATCH REWARD AD
// ============================================================
function watchRewardAd() {
  game.cash += 500;
  game.totalEarned += 500;
  showToast('📺 +500 oro por ver anuncio');
}

// ============================================================
// INIT
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
initAllFloors();
initFloorUpgrades();
showMainMenu();
gameLoop();
