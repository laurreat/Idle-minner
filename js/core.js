// ============================================================
// IDLE MINER - Edición Profunda v3
// Mejorado con sistema de combos, eventos especiales, efectos ambientales,
// vibración de pantalla y renderizado visual mejorado
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = 1000, H = 750;
const CHAR_SCALE = 2.8;
let viewScale = 1, viewOffX = 0, viewOffY = 0;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  let cssW = rect.width, cssH = rect.height;
  if (cssW < 10 || cssH < 10) { cssW = W; cssH = H; }
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  viewScale = Math.min(canvas.width / W, canvas.height / H);
  viewOffX = (canvas.width - W * viewScale) / 2;
  viewOffY = (canvas.height - H * viewScale) / 2;
  ctx.imageSmoothingEnabled = true;
}

// ============================================================
// CARGADOR DE SPRITES
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
// ESTADO DEL JUEGO
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
// SISTEMA DE COMBO
// ============================================================
let combo = {
  count: 0,
  multiplier: 1,
  lastClick: 0,
  decayTime: 1500,
  maxCombo: 50,
  thresholds: [5, 10, 15, 25, 35, 50],
  multValues: [1.2, 1.5, 1.8, 2.2, 2.8, 3.5]
};

function updateCombo() {
  const now = Date.now();
  if (now - combo.lastClick > combo.decayTime && combo.count > 0) {
    combo.count = Math.max(0, combo.count - 1);
    updateComboMultiplier();
  }
}

function addComboClick() {
  combo.count = Math.min(combo.count + 1, combo.maxCombo);
  combo.lastClick = Date.now();
  updateComboMultiplier();
}

function updateComboMultiplier() {
  combo.multiplier = 1;
  for (let i = combo.thresholds.length - 1; i >= 0; i--) {
    if (combo.count >= combo.thresholds[i]) {
      combo.multiplier = combo.multValues[i];
      break;
    }
  }
}

function getComboColor() {
  if (combo.count >= 50) return "#FF0066";
  if (combo.count >= 35) return "#FF4500";
  if (combo.count >= 25) return "#FFD700";
  if (combo.count >= 15) return "#10b981";
  if (combo.count >= 5) return "#60a5fa";
  return null;
}

// ============================================================
// SISTEMA DE EVENTOS ESPECIALES
// ============================================================
let bonusEvent = {
  active: false,
  type: null,
  timer: 0,
  duration: 8000,
  x: 0,
  y: 0,
  totalTriggered: 0,
  nextEventTime: 30000 + Math.random() * 45000,
  lastEventTime: 0
};

const BONUS_TYPES = [
  { id: "gold_rush", name: "Fiebre del Oro!", icon: "­ƒÆ░", color: "#FFD700", mult: 3, desc: "x3 oro por 8s" },
  { id: "gem_storm", name: "Tormenta de Gemas!", icon: "­ƒÆÄ", color: "#a78bfa", mult: 5, desc: "x5 chance gemas" },
  { id: "speed_demon", name: "Velocidad Extrema!", icon: "ÔÜí", color: "#60a5fa", mult: 2, desc: "x2 velocidad" }
];

function updateBonusEvents(dt) {
  const now = Date.now();

  if (!bonusEvent.active && now - bonusEvent.lastEventTime > bonusEvent.nextEventTime) {
    startBonusEvent();
  }

  if (bonusEvent.active) {
    bonusEvent.timer -= dt;
    if (bonusEvent.timer <= 0) {
      bonusEvent.active = false;
      showToast(`${bonusEvent.type.icon} Evento terminado`);
    }
  }
}

function startBonusEvent() {
  const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
  bonusEvent.active = true;
  bonusEvent.type = type;
  bonusEvent.timer = bonusEvent.duration;
  bonusEvent.totalTriggered++;
  bonusEvent.x = 200 + Math.random() * 600;
  bonusEvent.y = 150 + Math.random() * 200;
  bonusEvent.lastEventTime = Date.now();
  bonusEvent.nextEventTime = 45000 + Math.random() * 60000;

  showToast(`${type.icon} ${type.name} ${type.desc}`, true);
  spawnParticles(bonusEvent.x, bonusEvent.y, type.color, 20);
}

function getBonusMultiplier() {
  if (!bonusEvent.active) return 1;
  if (bonusEvent.type.id === "gold_rush") return bonusEvent.type.mult;
  return 1;
}

function getGemChanceBonus() {
  if (!bonusEvent.active) return 1;
  if (bonusEvent.type.id === "gem_storm") return bonusEvent.type.mult;
  return 1;
}

function getSpeedBonus() {
  if (!bonusEvent.active) return 1;
  if (bonusEvent.type.id === "speed_demon") return bonusEvent.type.mult;
  return 1;
}

// ============================================================
// EFECTOS DE PANTALLA
// ============================================================
let screenShake = { intensity: 0, duration: 0, elapsed: 0 };

function triggerScreenShake(intensity, duration) {
  screenShake.intensity = intensity;
  screenShake.duration = duration;
  screenShake.elapsed = 0;
}

function updateScreenShake(dt) {
  if (screenShake.elapsed < screenShake.duration) {
    screenShake.elapsed += dt;
  } else {
    screenShake.intensity = 0;
  }
}

function getShakeOffset() {
  if (screenShake.intensity === 0) return { x: 0, y: 0 };
  const progress = screenShake.elapsed / screenShake.duration;
  const decay = 1 - progress;
  return {
    x: (Math.random() - 0.5) * screenShake.intensity * decay * 2,
    y: (Math.random() - 0.5) * screenShake.intensity * decay * 2
  };
}

// ============================================================
// PARTÍCULAS AMBIENTALES
// ============================================================
let ambientParticles = [];

function initAmbientParticles() {
  ambientParticles = [];
  for (let i = 0; i < 30; i++) {
    ambientParticles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 1 + Math.random() * 2,
      speed: 0.2 + Math.random() * 0.5,
      opacity: 0.1 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.3
    });
  }
}

function updateAmbientParticles() {
  ambientParticles.forEach(p => {
    p.y -= p.speed;
    p.x += p.drift;
    if (p.y < -10) {
      p.y = H + 10;
      p.x = Math.random() * W;
    }
    if (p.x < -10) p.x = W + 10;
    if (p.x > W + 10) p.x = -10;
  });
}

function drawAmbientParticles() {
  const f = floors[game.currentFloor];
  const config = f.config;
  ambientParticles.forEach(p => {
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = config.oreColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ============================================================
// PISOS (10 pisos únicos con diferentes temas y materiales)
// ============================================================
const FLOOR_CONFIGS = [
  { name: "Superficie", bg: "#87CEEB", rockColor: "#8B7355", oreColor: "#FFD700", oreValue: 1, oreChance: 0.3, unlockCost: 0, depth: 0, material: "Tierra", materialIcon: "­ƒƒ½" },
  { name: "Tierra", bg: "#6B4226", rockColor: "#5C3317", oreColor: "#C0C0C0", oreValue: 2, oreChance: 0.25, unlockCost: 500, depth: 100, material: "Carb├│n", materialIcon: "Ô¼ø" },
  { name: "Piedra", bg: "#4A4A4A", rockColor: "#3A3A3A", oreColor: "#CD7F32", oreValue: 5, oreChance: 0.2, unlockCost: 5000, depth: 300, material: "Hierro", materialIcon: "­ƒö®" },
  { name: "Cueva Cristalina", bg: "#1a3a5c", rockColor: "#2a4a6c", oreColor: "#00CED1", oreValue: 12, oreChance: 0.18, unlockCost: 25000, depth: 600, material: "Cobre", materialIcon: "­ƒƒá" },
  { name: "Magma", bg: "#4a0a0a", rockColor: "#3a0a0a", oreColor: "#FF4500", oreValue: 30, oreChance: 0.15, unlockCost: 100000, depth: 1000, material: "Oro", materialIcon: "­ƒƒí" },
  { name: "Obsidiana", bg: "#0a0a1a", rockColor: "#050510", oreColor: "#9400D3", oreValue: 75, oreChance: 0.12, unlockCost: 500000, depth: 1500, material: "Plata", materialIcon: "ÔÜ¬" },
  { name: "Diamante", bg: "#0a1a2a", rockColor: "#0a1525", oreColor: "#00FFFF", oreValue: 200, oreChance: 0.1, unlockCost: 2500000, depth: 2200, material: "Platino", materialIcon: "­ƒÆá" },
  { name: "N├║cleo Exterior", bg: "#2a0a00", rockColor: "#1a0500", oreColor: "#FF6347", oreValue: 500, oreChance: 0.08, unlockCost: 10000000, depth: 3000, material: "Rub├¡", materialIcon: "­ƒö┤" },
  { name: "N├║cleo Interno", bg: "#1a0000", rockColor: "#0f0000", oreColor: "#FFD700", oreValue: 1500, oreChance: 0.06, unlockCost: 50000000, depth: 4000, material: "Esmeralda", materialIcon: "­ƒƒó" },
  { name: "Centro de la Tierra", bg: "#000000", rockColor: "#050005", oreColor: "#FFFFFF", oreValue: 5000, oreChance: 0.04, unlockCost: 250000000, depth: 5000, material: "Diamante", materialIcon: "­ƒÆÄ" }
];

let unlockedFloors = [true, false, false, false, false, false, false, false, false, false];

let hasClickedBefore = false;

// ============================================================
// SISTEMA DE MINERÍA POR PISO
// ============================================================
let floors = [];

function initFloor(index) {
  const config = FLOOR_CONFIGS[index];
  return {
    index: index,
    config: config,
    miner: { x: 282, y: 560, width: 45, height: 45, material: 0, isMining: false },
    elevator: { x: 100, y: 300, width: 45, height: 45, carrying: 0, isMoving: false, direction: 1, state: "idle", maxCapacity: 130 },
    storage: { x: 800, y: 300, width: 45, height: 45, carrying: 0, isCollecting: false, state: "idle", currentSprite: null, initialX: 800, maxCapacity: 100, collectionTime: 500 },
    minerBox: { x: 200, y: 560, width: 77, height: 77, material: 0 },
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
  initAmbientParticles();
}

// ============================================================
// MEJORAS (por piso)
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

let floorUpgrades = [];
function initFloorUpgrades() {
  floorUpgrades = [];
  for (let i = 0; i < FLOOR_CONFIGS.length; i++) {
    floorUpgrades.push(createUpgrades());
  }
}

// ============================================================
// MEJORAS GLOBALES
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
// LOGROS
// ============================================================
const ACHIEVEMENTS = [
  { id: "first_mine", name: "Primera Mina", desc: "Mina por primera vez", icon: "ÔøÅ´©Å", check: () => game.totalClicks >= 1, reward: "50 oro" },
  { id: "hundred_clicks", name: "Minero Dedicado", desc: "Haz clic 100 veces", icon: "­ƒæå", check: () => game.totalClicks >= 100, reward: "200 oro" },
  { id: "thousand_clicks", name: "Minero Experto", desc: "Haz clic 1,000 veces", icon: "­ƒÆ¬", check: () => game.totalClicks >= 1000, reward: "1 gema" },
  { id: "first_k", name: "Primer Mil", desc: "Gana $1,000 en total", icon: "­ƒÆ░", check: () => game.totalEarned >= 1000, reward: "100 oro" },
  { id: "first_100k", name: "Rico", desc: "Gana $100,000 en total", icon: "­ƒñæ", check: () => game.totalEarned >= 100000, reward: "5 gemas" },
  { id: "first_million", name: "Millonario", desc: "Gana $1,000,000 en total", icon: "­ƒÆÄ", check: () => game.totalEarned >= 1000000, reward: "25 gemas" },
  { id: "floor_2", name: "Explorador", desc: "Desbloquea el Piso 2", icon: "­ƒöô", check: () => unlockedFloors[1], reward: "2 gemas" },
  { id: "floor_5", name: "Profundo", desc: "Desbloquea el Piso 5", icon: "­ƒò│´©Å", check: () => unlockedFloors[4], reward: "10 gemas" },
  { id: "floor_10", name: "Centro de la Tierra", desc: "Desbloquea todos los pisos", icon: "­ƒîì", check: () => unlockedFloors[9], reward: "50 gemas" },
  { id: "prestige_1", name: "Renacimiento", desc: "Haz tu primer prestigio", icon: "Ô¡É", check: () => game.prestigeCount >= 1, reward: "10 gemas" },
  { id: "prestige_5", name: "Veterano", desc: "Haz 5 prestigios", icon: "­ƒîƒ", check: () => game.prestigeCount >= 5, reward: "50 gemas" },
  { id: "auto_miner", name: "Automatizaci├│n", desc: "Compra un auto-minero", icon: "­ƒñû", check: () => { for (let f of floorUpgrades) if (f.autoMiner.level > 0) return true; return false; }, reward: "5 gemas" },
  { id: "speed_max", name: "Velocidad M├íxima", desc: "Maximiza la velocidad del elevador", icon: "ÔÜí", check: () => { for (let f of floorUpgrades) if (f.elevator.level >= f.elevator.maxLevel) return true; return false; }, reward: "15 gemas" },
  { id: "ten_k_mined", name: "Toneladas", desc: "Mina 10,000 unidades", icon: "­ƒÅö´©Å", check: () => game.totalMined >= 10000, reward: "3 gemas" },
  { id: "score_100k", name: "Puntuaci├│n Alta", desc: "Alcanza 100,000 puntos", icon: "­ƒÅå", check: () => game.score >= 100000, reward: "20 gemas" },
  { id: "combo_10", name: "Maestro del Combo", desc: "Alcanza un combo de 10", icon: "­ƒöÑ", check: () => combo.count >= 10, reward: "3 gemas" },
  { id: "combo_25", name: "Leyenda del Combo", desc: "Alcanza un combo de 25", icon: "­ƒÆÑ", check: () => combo.count >= 25, reward: "10 gemas" }
];

let unlockedAchievements = new Set();

// ============================================================
// SISTEMA DE GUARDADO / CARGA (ofuscado + verificación de integridad)
// ============================================================
