// ============================================================
// IDLE MINER - Edición Profunda v3
// Mejorado con sistema de combos, eventos especiales, efectos ambientales,
// vibración de pantalla y renderizado visual mejorado
// ============================================================

// Lienzo y contexto de dibujo 2D del juego
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
// Dimensiones lógicas del mundo (resolución base de dibujo)
const W = 1000, H = 750;
// Factor de escala de los personajes/sprites
const CHAR_SCALE = 2.8;
// Escala y desplazamiento usados para ajustar el lienzo a la pantalla (letterboxing)
let viewScale = 1, viewOffX = 0, viewOffY = 0;

// Redimensiona el lienzo al tamaño real del elemento (teniendo en cuenta el devicePixelRatio)
// y recalcula la escala/centrado para mantener la proporción del mundo (W x H).
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  let cssW = rect.width, cssH = rect.height;
  // Si el canvas aún no tiene tamaño válido, usa las dimensiones base por defecto
  if (cssW < 10 || cssH < 10) { cssW = W; cssH = H; }
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  // Escala uniforme = la menor relación para que todo el mundo quepa en pantalla
  viewScale = Math.min(canvas.width / W, canvas.height / H);
  viewOffX = (canvas.width - W * viewScale) / 2;
  viewOffY = (canvas.height - H * viewScale) / 2;
  ctx.imageSmoothingEnabled = true;
}

// ============================================================
// CARGADOR DE SPRITES
// ============================================================
// Diccionario que contendrá las imágenes cargadas, indexadas por nombre
const sprites = {};
// Lista de nombres de sprites del minero y la tolva (animaciones y estados)
const spriteNames = [
  "miner_idle", "miner_walk_1", "miner_walk_2",
  "miner_walk_reverse_1", "miner_walk_reverse_2",
  "miner_elevador_0", "miner_elevador_1", "miner_elevador_2",
  "miner_tolva_1", "miner_tolva_2",
  "miner_tolva_reverse_1", "miner_tolva_reverse_2",
  "miner_tolva_reverse_3", "miner_tolva_reverse_4",
  "miner_mine",
  "tolva_miner_0", "tolva_miner_1", "tolva_miner_2", "tolva_miner_3"
];
// Carga de forma diferida cada sprite asignando su ruta en la carpeta Sprites/
spriteNames.forEach(name => {
  sprites[name] = new Image();
  sprites[name].src = `Sprites/${name}.png`;
});
// Imagen de fondo del juego
const backgroundImage = new Image();
backgroundImage.src = "fondo.png";

// ============================================================
// ESTADO DEL JUEGO
// ============================================================
// Estado global persistente de la partida.
// cash: oro disponible; gems: gemas disponibles; totalEarned/totalMined/totalClicks: acumulados históricos
// score: puntuación; currentFloor: piso activo; prestigeCount: nº de prestigios realizados
// prestigeGems/totalPrestigeGems: gemas de prestigio de esta ronda y en total
// startTime/lastSave: marcas de tiempo para sesión y autoguardado; paused/started: banderas de control
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
// Estado del combo de clics: count = clics encadenados; multiplier = multiplicador actual
// lastClick = tiempo del último clic; decayTime = ms sin clic tras los cuales el combo decae en 1
// maxCombo = tope de clics; thresholds/multValues = umbrales de clics y su multiplicador asociado
let combo = {
  count: 0,
  multiplier: 1,
  lastClick: 0,
  decayTime: 1500,
  maxCombo: 50,
  thresholds: [5, 10, 15, 25, 35, 50],
  multValues: [1.2, 1.5, 1.8, 2.2, 2.8, 3.5]
};

// Reduce el combo en 1 cada vez que pasa decayTime sin clic (decaimiento progresivo del combo)
function updateCombo() {
  const now = Date.now();
  if (now - combo.lastClick > combo.decayTime && combo.count > 0) {
    combo.count = Math.max(0, combo.count - 1);
    updateComboMultiplier();
  }
}

// Registra un clic de minado: incrementa el combo (hasta maxCombo) y refresca el multiplicador
function addComboClick() {
  combo.count = Math.min(combo.count + 1, combo.maxCombo);
  combo.lastClick = Date.now();
  updateComboMultiplier();
}

// Recalcula el multiplicador del combo: toma el mayor umbral alcanzado por count
// (se recorre la lista de mayor a menor para aplicar el multiplicador más alto)
function updateComboMultiplier() {
  combo.multiplier = 1;
  for (let i = combo.thresholds.length - 1; i >= 0; i--) {
    if (combo.count >= combo.thresholds[i]) {
      combo.multiplier = combo.multValues[i];
      break;
    }
  }
}

// Devuelve el color del indicador de combo según el nivel alcanzado (null si no hay combo)
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
// Estado del evento bonus activo. active = si hay evento en curso; type = definición del evento
// timer = tiempo restante (ms); duration = duración total; x/y = posición del aviso en pantalla
// totalTriggered = nº total de eventos; nextEventTime = espera hasta el próximo; lastEventTime = momento del último
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

// Catálogo de tipos de evento: cada uno con id, nombre, icono, color, multiplicador (mult) y descripción
const BONUS_TYPES = [
  { id: "gold_rush", name: "¡Fiebre del Oro!", icon: "💰", color: "#FFD700", mult: 3, desc: "x3 oro durante 8s" },
  { id: "gem_storm", name: "¡Tormenta de Gemas!", icon: "💎", color: "#a78bfa", mult: 5, desc: "x5 probabilidad de gemas" },
  { id: "speed_demon", name: "¡Velocidad Extrema!", icon: "⚡", color: "#60a5fa", mult: 2, desc: "x2 velocidad de minería" }
];

// Controla la temporización de eventos: lanza uno nuevo tras nextEventTime y descuenta su duración
function updateBonusEvents(dt) {
  const now = Date.now();

  // Si no hay evento activo y ya pasó el tiempo de espera, inicia uno nuevo
  if (!bonusEvent.active && now - bonusEvent.lastEventTime > bonusEvent.nextEventTime) {
    startBonusEvent();
  }

  if (bonusEvent.active) {
    bonusEvent.timer -= dt;
    updateActiveBonusBar();
    if (bonusEvent.timer <= 0) {
      bonusEvent.active = false;
      hideBonusBar();
      addEventLog(`${bonusEvent.type.icon} Evento terminado: ${bonusEvent.type.name}`, 'info');
    }
  }
}

// Inicia un evento aleatorio: elige tipo, fija timer a la duración, posiciona el aviso y
// reprograma el próximo evento con un retraso aleatorio (entre 45s y 105s)
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

  showBonusBar(type);
  addEventLog(`${type.icon} ¡EVENTO! ${type.name} — ${type.desc}`, 'bonus');
  spawnParticles(bonusEvent.x, bonusEvent.y, type.color, 20);
}

// Multiplicador de oro: x3 solo durante "Fiebre del Oro", 1 en cualquier otro caso
function getBonusMultiplier() {
  if (!bonusEvent.active) return 1;
  if (bonusEvent.type.id === "gold_rush") return bonusEvent.type.mult;
  return 1;
}

// Bonus de probabilidad de gema: x5 durante "Tormenta de Gemas", 1 si no
function getGemChanceBonus() {
  if (!bonusEvent.active) return 1;
  if (bonusEvent.type.id === "gem_storm") return bonusEvent.type.mult;
  return 1;
}

// Bonus de velocidad de minería: x2 durante "Velocidad Extrema", 1 si no
function getSpeedBonus() {
  if (!bonusEvent.active) return 1;
  if (bonusEvent.type.id === "speed_demon") return bonusEvent.type.mult;
  return 1;
}

// ============================================================
// EFECTOS DE PANTALLA
// ============================================================
// Estado de la vibración de pantalla: intensity = fuerza; duration = duración; elapsed = tiempo transcurrido
let screenShake = { intensity: 0, duration: 0, elapsed: 0 };

// Activa una vibración de pantalla con la intensidad y duración indicadas
function triggerScreenShake(intensity, duration) {
  screenShake.intensity = intensity;
  screenShake.duration = duration;
  screenShake.elapsed = 0;
}

// Avanza el tiempo de la vibración; al terminar, anula la intensidad para detener el efecto
function updateScreenShake(dt) {
  if (screenShake.elapsed < screenShake.duration) {
    screenShake.elapsed += dt;
  } else {
    screenShake.intensity = 0;
  }
}

// Calcula el desplazamiento aleatorio actual de la vibración.
// El factor decay (1 - progreso) hace que la sacudida sea más fuerte al inicio y se apague con el tiempo
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
// Partículas decorativas de fondo que flotan en pantalla
let ambientParticles = [];

// Crea 30 partículas con posición, tamaño, velocidad, opacidad y deriva aleatorias
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

// Mueve las partículas hacia arriba y las reposiciona al salir de los bordes (efecto de bucle)
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

// Dibuja las partículas ambientales usando el color del mineral del piso actual
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
// Configuración estática de cada piso. Campos:
// name: nombre; bg: color de fondo; rockColor: color de roca; oreColor: color del mineral
// oreValue: valor por unidad de mineral; oreChance: probabilidad de encontrar mineral al minar
// unlockCost: coste en oro para desbloquear (0 = ya desbloqueado); depth: profundidad (m)
// material: nombre del material; materialIcon: emoji representativo
const FLOOR_CONFIGS = [
  { name: "Superficie", bg: "#87CEEB", rockColor: "#8B7355", oreColor: "#FFD700", oreValue: 1, oreChance: 0.3, unlockCost: 0, depth: 0, material: "Tierra", materialIcon: "🧱" },
  { name: "Tierra", bg: "#6B4226", rockColor: "#5C3317", oreColor: "#C0C0C0", oreValue: 2, oreChance: 0.25, unlockCost: 500, depth: 100, material: "Carbón", materialIcon: "⬛" },
  { name: "Piedra", bg: "#4A4A4A", rockColor: "#3A3A3A", oreColor: "#CD7F32", oreValue: 5, oreChance: 0.2, unlockCost: 5000, depth: 300, material: "Hierro", materialIcon: "🪨" },
  { name: "Cueva Cristalina", bg: "#1a3a5c", rockColor: "#2a4a6c", oreColor: "#00CED1", oreValue: 12, oreChance: 0.18, unlockCost: 25000, depth: 600, material: "Cobre", materialIcon: "💎" },
  { name: "Magma", bg: "#4a0a0a", rockColor: "#3a0a0a", oreColor: "#FF4500", oreValue: 30, oreChance: 0.15, unlockCost: 100000, depth: 1000, material: "Oro", materialIcon: "🥇" },
  { name: "Obsidiana", bg: "#0a0a1a", rockColor: "#050510", oreColor: "#9400D3", oreValue: 75, oreChance: 0.12, unlockCost: 500000, depth: 1500, material: "Plata", materialIcon: "🥈" },
  { name: "Diamante", bg: "#0a1a2a", rockColor: "#0a1525", oreColor: "#00FFFF", oreValue: 200, oreChance: 0.1, unlockCost: 2500000, depth: 2200, material: "Platino", materialIcon: "💠" },
  { name: "Núcleo Exterior", bg: "#2a0a00", rockColor: "#1a0500", oreColor: "#FF6347", oreValue: 500, oreChance: 0.08, unlockCost: 10000000, depth: 3000, material: "Rubí", materialIcon: "🔴" },
  { name: "Núcleo Interno", bg: "#1a0000", rockColor: "#0f0000", oreColor: "#FFD700", oreValue: 1500, oreChance: 0.06, unlockCost: 50000000, depth: 4000, material: "Esmeralda", materialIcon: "🟢" },
  { name: "Centro de la Tierra", bg: "#000000", rockColor: "#050005", oreColor: "#FFFFFF", oreValue: 5000, oreChance: 0.04, unlockCost: 250000000, depth: 5000, material: "Diamante", materialIcon: "💎" }
];

// Bandera por piso que indica si está desbloqueado (el piso 0 siempre lo está)
let unlockedFloors = [true, false, false, false, false, false, false, false, false, false];

// ============================================================
// SISTEMA DE MINERÍA POR PISO
// ============================================================
// Array con el estado en tiempo de ejecución de cada piso (minero, elevador, tolva, etc.)
let floors = [];

// Construye el estado inicial de un piso: posiciones del minero/elevador/almacén, cajas,
// estados de espera, auto-minero y contador de gemas encontradas en ese piso
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

// Inicializa todos los pisos y las partículas ambientales
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
// Fábrica de mejoras de un piso. Cada mejora tiene nivel, coste base y un multiplicador de coste,
// de modo que el precio de subir de nivel escala exponencialmente: coste = baseCost * mult^level
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
      // El tiempo de recolección se reduce un 5% por nivel (decaimiento exponencial), con mínimo de 100ms
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

// Estado de mejoras por piso (un bloque de createUpgrades por cada piso)
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
// Mejoras que afectan a todo el juego (se pagan con gemas). El coste escala igual que las del piso.
const globalUpgrades = {
  // luck: aumenta la probabilidad base de encontrar gemas por nivel
  luck: {
    level: 0, maxLevel: 25, baseCost: 2000, costMultiplier: 2.2, currency: "gems",
    getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
    getGemChance() { return 0.01 + this.level * 0.005; }
  },
  // speedBoost: multiplicador global de velocidad de minería (+10% por nivel)
  speedBoost: {
    level: 0, maxLevel: 20, baseCost: 5000, costMultiplier: 2.0, currency: "gems",
    getCurrentCost() { return Math.floor(this.baseCost * Math.pow(this.costMultiplier, this.level)); },
    getSpeedMult() { return 1 + this.level * 0.1; }
  }
};

// ============================================================
// LOGROS
// ============================================================
// Lista de logros: cada uno con id, nombre, descripción, icono, función check() (¿desbloqueado?)
// y reward (recompensa en texto). check() se evalúa contra el estado global de la partida
const ACHIEVEMENTS = [
  { id: "first_mine", name: "Primera Mina", desc: "Mina por primera vez", icon: "⛏️", check: () => game.totalClicks >= 1, reward: "50 oro" },
  { id: "hundred_clicks", name: "Minero Dedicado", desc: "Haz clic 100 veces", icon: "⚒️", check: () => game.totalClicks >= 100, reward: "200 oro" },
  { id: "thousand_clicks", name: "Minero Experto", desc: "Haz clic 1,000 veces", icon: "💎", check: () => game.totalClicks >= 1000, reward: "1 gema" },
  { id: "first_k", name: "Primer Mil", desc: "Gana $1,000 en total", icon: "💰", check: () => game.totalEarned >= 1000, reward: "100 oro" },
  { id: "first_100k", name: "Rico", desc: "Gana $100,000 en total", icon: "🏦", check: () => game.totalEarned >= 100000, reward: "5 gemas" },
  { id: "first_million", name: "Millonario", desc: "Gana $1,000,000 en total", icon: "👑", check: () => game.totalEarned >= 1000000, reward: "25 gemas" },
  { id: "floor_2", name: "Explorador", desc: "Desbloquea el Piso 2", icon: "🗺️", check: () => unlockedFloors[1], reward: "2 gemas" },
  { id: "floor_5", name: "Profundo", desc: "Desbloquea el Piso 5", icon: "🌋", check: () => unlockedFloors[4], reward: "10 gemas" },
  { id: "floor_10", name: "Centro de la Tierra", desc: "Desbloquea todos los pisos", icon: "🌍", check: () => unlockedFloors[9], reward: "50 gemas" },
  { id: "prestige_1", name: "Renacimiento", desc: "Haz tu primer prestigio", icon: "✨", check: () => game.prestigeCount >= 1, reward: "10 gemas" },
  { id: "prestige_5", name: "Veterano", desc: "Haz 5 prestigios", icon: "🌟", check: () => game.prestigeCount >= 5, reward: "50 gemas" },
  { id: "auto_miner", name: "Automatización", desc: "Compra un auto-minero", icon: "🤖", check: () => { for (let f of floorUpgrades) if (f.autoMiner.level > 0) return true; return false; }, reward: "5 gemas" },
  { id: "speed_max", name: "Velocidad Máxima", desc: "Maximiza la velocidad del elevador", icon: "⚡", check: () => { for (let f of floorUpgrades) if (f.elevator.level >= f.elevator.maxLevel) return true; return false; }, reward: "15 gemas" },
  { id: "ten_k_mined", name: "Toneladas", desc: "Mina 10,000 unidades", icon: "⚖️", check: () => game.totalMined >= 10000, reward: "3 gemas" },
  { id: "score_100k", name: "Puntuación Alta", desc: "Alcanza 100,000 puntos", icon: "🏆", check: () => game.score >= 100000, reward: "20 gemas" },
  { id: "combo_10", name: "Maestro del Combo", desc: "Alcanza un combo de 10", icon: "🔥", check: () => combo.count >= 10, reward: "3 gemas" },
  { id: "combo_25", name: "Leyenda del Combo", desc: "Alcanza un combo de 25", icon: "🚀", check: () => combo.count >= 25, reward: "10 gemas" }
];

// Conjunto de ids de logros ya desbloqueados
let unlockedAchievements = new Set();

// ============================================================
// SISTEMA DE GUARDADO / CARGA (ofuscado + verificación de integridad)
// ============================================================
// Guarda el estado del juego de forma ofuscada y comprueba la integridad al cargarlo
// (las funciones saveGame/loadGame continúan en el resto del archivo)
