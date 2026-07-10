function updateHUD() {
  document.getElementById("hudCash").textContent = `$${formatNum(game.cash)}`;
  document.getElementById("hudGems").textContent = `💎 ${game.gems}`;
  document.getElementById("hudFloor").textContent = `Piso ${game.currentFloor + 1}: ${FLOOR_CONFIGS[game.currentFloor].name}`;
  document.getElementById("hudScore").textContent = `Puntos: ${formatNum(game.score)}`;

  let perSec = 0;
  for (let i = 0; i < floors.length; i++) {
    if (!unlockedFloors[i]) continue;
    const fu = floorUpgrades[i];
    if (fu.autoMiner.isActive()) {
      const ciclosPorSeg = 1000 / fu.autoMiner.getInterval();
      const cantidad = Math.min(fu.miner.getMiningAmount(), fu.elevator.getCapacity(), fu.storage.getCapacity());
      perSec += ciclosPorSeg * cantidad * fu.sellMultiplier.getMultiplier();
    }
  }
  document.getElementById("hudPerSec").textContent = `$${formatNum(Math.floor(perSec))}/s`;

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
const TYPE_NAMES = {
  miner: "Minero",
  elevator: "Elevador",
  storage: "Almacén",
  sellMultiplier: "Multiplicador de Venta",
  autoMiner: "Auto-Minero",
  luck: "Suerte",
  speedBoost: "Velocidad Global"
};

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
      showToast(`🏔️ ¡Piso ${index + 1} desbloqueado!`);
      addEventLog(`🏔️ ¡Piso ${index + 1} (${FLOOR_CONFIGS[index].name}) desbloqueado!`, 'piso');
      triggerScreenShake(5, 300);
      checkAchievements();
      updateFloorBar();
    } else {
      showToast(`⚠️ Necesitas $${formatNum(cost)} para desbloquear este piso`);
    }
    return;
  }
  game.currentFloor = index;
  updateFloorBar();
}

function handleCanvasClick(event) {
  if (game.paused || !game.started) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const px = (event.clientX - rect.left) * dpr;
  const py = (event.clientY - rect.top) * dpr;
  const x = (px - viewOffX) / viewScale;
  const y = (py - viewOffY) / viewScale;

  const f = floors[game.currentFloor];
  const s = CHAR_SCALE;

  const mw = f.miner.width * s, mh = f.miner.height * s;
  const mx = f.miner.x - f.miner.width * (s - 1) / 2;
  const my = f.miner.y - f.miner.height * (s - 1) / 2;
  if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
    if (!f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= 282) {
      f.miner.isMining = true;
      game.totalClicks++;
      addComboClick();
      hasClickedBefore = true;
      triggerScreenShake(2, 100);
      spawnParticles(f.miner.x + 40, f.miner.y + 20, FLOOR_CONFIGS[game.currentFloor].oreColor, 3);
    }
  }

  const ew = f.elevator.width * s, eh = f.elevator.height * s;
  const ex = f.elevator.x - f.elevator.width * (s - 1) / 2;
  const ey = f.elevator.y - f.elevator.height * (s - 1) / 2;
  if (x >= ex && x <= ex + ew && y >= ey && y <= ey + eh) {
    if (!f.elevator.isMoving) {
      f.elevator.isMoving = true;
      game.totalClicks++;
      addComboClick();
      hasClickedBefore = true;
    }
  }

  const sw = f.storage.width * s, sh = f.storage.height * s;
  const sx = f.storage.x - f.storage.width * (s - 1) / 2;
  const sy = f.storage.y - f.storage.height * (s - 1) / 2;
  if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
    if (!f.storage.isCollecting) {
      f.storage.isCollecting = true;
      game.totalClicks++;
      addComboClick();
      hasClickedBefore = true;
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

  let html = `<div class="shop-section"><h3><i class="fas fa-mountain"></i> Piso ${game.currentFloor + 1}: ${config.name}</h3>`;

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

  const sellCost = fu.sellMultiplier.getCurrentCost();
  const canSell = game.cash >= sellCost && fu.sellMultiplier.level < fu.sellMultiplier.maxLevel;
  html += `<div class="shop-item ${!canSell ? (fu.sellMultiplier.level >= fu.sellMultiplier.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('sellMultiplier')">
    <div class="shop-icon" style="background:rgba(255,215,0,0.15);">💰</div>
    <div class="shop-info">
      <div class="name">Multiplicador Venta</div>
      <div class="desc">+2x valor (actual: ${fu.sellMultiplier.getMultiplier()}x)</div>
      <div class="level">Nivel ${fu.sellMultiplier.level}/${fu.sellMultiplier.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.sellMultiplier.level >= fu.sellMultiplier.maxLevel ? 'MAX' : '$' + formatNum(sellCost)}</div>
  </div>`;

  const autoCost = fu.autoMiner.getCurrentCost();
  const canAuto = game.cash >= autoCost && fu.autoMiner.level < fu.autoMiner.maxLevel;
  html += `<div class="shop-item ${!canAuto ? (fu.autoMiner.level >= fu.autoMiner.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyUpgrade('autoMiner')">
    <div class="shop-icon" style="background:rgba(139,92,246,0.15);">🤖</div>
    <div class="shop-info">
      <div class="name">Auto-Minero</div>
      <div class="desc">Auto mina cada ${fu.autoMiner.isActive() ? (fu.autoMiner.getInterval()/1000).toFixed(1) + 's' : '5s'}</div>
      <div class="level">Nivel ${fu.autoMiner.level}/${fu.autoMiner.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gold">${fu.autoMiner.level >= fu.autoMiner.maxLevel ? 'MAX' : '$' + formatNum(autoCost)}</div>
  </div>`;

  html += `</div>`;

  html += `<div class="shop-section"><h3><i class="fas fa-globe"></i> Mejoras Globales</h3>`;

  const luckCost = globalUpgrades.luck.getCurrentCost();
  const canLuck = game.gems >= luckCost && globalUpgrades.luck.level < globalUpgrades.luck.maxLevel;
  html += `<div class="shop-item ${!canLuck ? (globalUpgrades.luck.level >= globalUpgrades.luck.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('luck')">
    <div class="shop-icon" style="background:rgba(167,139,250,0.15);">🍀</div>
    <div class="shop-info">
      <div class="name">Suerte</div>
      <div class="desc">+0.5% chance gemas (actual: ${(globalUpgrades.luck.getGemChance()*100).toFixed(1)}%)</div>
      <div class="level">Nivel ${globalUpgrades.luck.level}/${globalUpgrades.luck.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.luck.level >= globalUpgrades.luck.maxLevel ? 'MAX' : '💎 ' + luckCost}</div>
  </div>`;

  const speedCost = globalUpgrades.speedBoost.getCurrentCost();
  const canSpeed = game.gems >= speedCost && globalUpgrades.speedBoost.level < globalUpgrades.speedBoost.maxLevel;
  html += `<div class="shop-item ${!canSpeed ? (globalUpgrades.speedBoost.level >= globalUpgrades.speedBoost.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('speedBoost')">
    <div class="shop-icon" style="background:rgba(236,72,153,0.15);">⚡</div>
    <div class="shop-info">
      <div class="name">Velocidad Global</div>
      <div class="desc">+10% velocidad (actual: ${globalUpgrades.speedBoost.getSpeedMult().toFixed(1)}x)</div>
      <div class="level">Nivel ${globalUpgrades.speedBoost.level}/${globalUpgrades.speedBoost.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.speedBoost.level >= globalUpgrades.speedBoost.maxLevel ? 'MAX' : '💎 ' + speedCost}</div>
  </div>`;

  html += `</div>`;

  const nextFloor = game.currentFloor + 1;
  if (nextFloor < FLOOR_CONFIGS.length && !unlockedFloors[nextFloor]) {
    const cost = FLOOR_CONFIGS[nextFloor].unlockCost;
    const canUnlock = game.cash >= cost;
    html += `<div class="shop-section"><h3><i class="fas fa-unlock"></i> Desbloquear Piso</h3>
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
    showToast(`✅ ${TYPE_NAMES[type] || type} mejorado a nivel ${upgrade.level}`);
    addEventLog(`✅ ${TYPE_NAMES[type] || type} → nivel ${upgrade.level}`, 'info');
    triggerScreenShake(3, 150);
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
    showToast(`✅ ${TYPE_NAMES[type] || type} mejorado a nivel ${upgrade.level}`);
    addEventLog(`💎 ${TYPE_NAMES[type] || type} → nivel ${upgrade.level}`, 'bonus');
    triggerScreenShake(4, 200);
  }
}

function renderAchievements() {
  const body = document.getElementById("achievementsBody");
  let html = `<div style="margin-bottom:14px;color:var(--text-secondary);font-size:14px;font-family:'VT323',monospace;">${unlockedAchievements.size}/${ACHIEVEMENTS.length} desbloqueados</div>`;

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
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">💰 Oro Total Ganado</div>
        <div class="stat-value" style="color:var(--gold);">$${formatNum(game.totalEarned)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💎 Gemas</div>
        <div class="stat-value" style="color:var(--purple);">${game.gems}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">⛏️ Total Minado</div>
        <div class="stat-value" style="color:var(--emerald);">${formatNum(game.totalMined)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">👆 Clics Totales</div>
        <div class="stat-value" style="color:#ec4899;">${formatNum(game.totalClicks)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">⭐ Prestigios</div>
        <div class="stat-value" style="color:#f59e0b;">${game.prestigeCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🏅 Puntuación</div>
        <div class="stat-value" style="color:#6366f1;">${formatNum(game.score)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">⏱️ Tiempo Jugado</div>
        <div class="stat-value">${formatTime(elapsed)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🏔️ Pisos Desbloqueados</div>
        <div class="stat-value">${unlockedFloors.filter(Boolean).length}/${FLOOR_CONFIGS.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🔥 Combo Máximo</div>
        <div class="stat-value" style="color:#FF4500;">${combo.maxCombo}</div>
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
      <div class="prestige-gems">+${gems} ­💎</div>
      <p style="font-size:13px;color:var(--text-secondary);">Gemas actuales: ${game.gems} | Total prestigio: ${game.totalPrestigeGems}</p>
      <p style="font-size:13px;color:var(--text-secondary);">Prestigios realizados: ${game.prestigeCount}</p>
      ${gems < 1 ? '<p style="color:#ef4444;margin-top:14px;">Necesitas minar más para obtener gemas de prestigio.</p>' : ''}
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
      addEventLog(`🏆 ¡Logro desbloqueado! ${ach.name}`, 'logro');
      triggerScreenShake(5, 300);

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
// SISTEMA DE NOTIFICACIONES (Toast + Log de Eventos)
// ============================================================

// Añade una entrada al log de eventos del panel lateral
function addEventLog(message, type = 'info') {
  const body = document.getElementById('eventLogBody');
  if (!body) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const entry = document.createElement('div');
  entry.className = `event-log-entry type-${type}`;
  entry.innerHTML = `<span class="event-log-time">${timeStr}</span><span class="event-log-msg">${message}</span>`;

  body.insertBefore(entry, body.firstChild);

  // Limitar a 50 entradas
  while (body.children.length > 50) {
    body.removeChild(body.lastChild);
  }
}

function clearEventLog() {
  const body = document.getElementById('eventLogBody');
  if (body) body.innerHTML = '';
}

// Muestra la barra de evento activo en la parte inferior del juego
function showBonusBar(type) {
  const bar = document.getElementById('activeBonusBar');
  if (!bar) return;
  document.getElementById('bonusBarIcon').textContent = type.icon;
  document.getElementById('bonusBarName').textContent = type.name;
  document.getElementById('bonusBarDesc').textContent = type.desc;
  document.getElementById('bonusBarFill').style.background = type.color;
  document.getElementById('bonusBarFill').style.width = '100%';
  bar.style.borderColor = type.color + '55';
  bar.style.display = 'flex';
}

function hideBonusBar() {
  const bar = document.getElementById('activeBonusBar');
  if (bar) bar.style.display = 'none';
}

function updateActiveBonusBar() {
  if (!bonusEvent.active) return;
  const progress = Math.max(0, bonusEvent.timer / bonusEvent.duration);
  const fill = document.getElementById('bonusBarFill');
  const time = document.getElementById('bonusBarTime');
  if (fill) fill.style.width = (progress * 100) + '%';
  if (time) time.textContent = Math.ceil(bonusEvent.timer / 1000) + 's';
}

function showToast(message, isAchievement = false) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast${isAchievement ? ' achievement' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);

  // También añadir al log con tipo apropiado
  const tipo = isAchievement ? 'logro' : 'info';
  addEventLog(message, tipo);
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
  combo.count = 0;
  combo.multiplier = 1;
  bonusEvent.active = false;
  hideBonusBar();
  clearEventLog();
  addEventLog('⛏️ ¡Nueva partida iniciada!', 'piso');

  document.getElementById("startMenu").classList.add("hidden");
  document.getElementById("hud").classList.add("active");
  document.getElementById("sideButtons").classList.add("active");
  document.getElementById("floorBar").classList.add("active");
  document.getElementById("eventLog").classList.add("visible");
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
    document.getElementById("eventLog").classList.add("visible");
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

  if (hasSaveData) {
    try {
      const data = deobfuscateSave(localStorage.getItem(SAVE_KEY));
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
// THEME SYSTEM (claro / oscuro)
// ============================================================
const THEME_KEY = "idleMiner_theme";
const THEME_TIPS = [
  "Toca al minero para extraer material ⛏️",
  "Usa combos tocando rápido para ganar más 🔥",
  "El auto-minero trabaja solo por ti 🤖",
  "Desbloquea pisos más profundos para más oro 🏔️",
  "Las gemas desbloquean mejoras globales 💎",
  "Haz prestigio para ganar bonificaciones ⭐"
];

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    document.getElementById("loadingScreen").classList.add("light");
    const mt = document.getElementById("menuThemeToggle");
    if (mt) mt.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.getElementById("loadingScreen").classList.remove("light");
    const mt = document.getElementById("menuThemeToggle");
    if (mt) mt.innerHTML = '<i class="fas fa-moon"></i>';
  }
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const newTheme = isLight ? "dark" : "light";
  applyTheme(newTheme);
  try { localStorage.setItem(THEME_KEY, newTheme); } catch (e) {}
  showToast(newTheme === "light" ? "Ô☀️ Tema claro" : "🌙 Tema oscuro");
}

function initTheme() {
  let theme = "dark";
  try { theme = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {}
  applyTheme(theme);
}

// ============================================================
// RETURN TO MENU
// ============================================================
function closeAllPanels() {
  ["shop", "achievements", "stats", "prestige", "howto"].forEach(p => {
    document.getElementById(`panel-${p}`).classList.remove("active");
  });
  game.paused = false;
}

function returnToMenu() {
  if (!game.started) return;
  saveGame(true);
  game.paused = true;
  closeAllPanels();
  hideBonusBar();
  document.getElementById("hud").classList.remove("active");
  document.getElementById("sideButtons").classList.remove("active");
  document.getElementById("floorBar").classList.remove("active");
  document.getElementById("eventLog").classList.remove("visible");
  showMainMenu();
}

// ============================================================
// PANTALLA DE CARGA
// ============================================================
let loadingDone = false;

function finishLoading() {
  if (loadingDone) return;
  loadingDone = true;
  document.getElementById("loadingScreen").classList.add("hidden");
}

function runLoadingScreen() {
  const bar = document.getElementById("loadBar");
  const pct = document.getElementById("loadPct");
  const tip = document.getElementById("loadTip");
  let progress = 0;

  tip.textContent = THEME_TIPS[0];
  let tipIdx = 0;

  const interval = setInterval(() => {
    progress += Math.random() * 12 + 6;
    if (progress >= 100) progress = 100;
    bar.style.width = progress + "%";
    pct.textContent = Math.floor(progress) + "%";

    if (progress > (tipIdx + 1) * (100 / THEME_TIPS.length) && tipIdx < THEME_TIPS.length - 1) {
      tipIdx++;
      tip.style.opacity = 0;
      setTimeout(() => { tip.textContent = THEME_TIPS[tipIdx]; tip.style.opacity = 1; }, 400);
    }

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(finishLoading, 500);
    }
  }, 280);
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
let lastTime = Date.now();

