// Actualiza el HUD (dinero, gemas, piso, puntos, ingresos/s y tiempo).
// Calcula las ganancias por segundo sumando, por cada piso desbloqueado con auto-minero activo,
// los ciclos por segundo (1000ms / intervalo) multiplicados por la cantidad minada por ciclo
// (limitada por la capacidad del elevador y del almacén) y el multiplicador de venta.
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

// Renderiza la barra de pisos: un punto por piso marcado como actual, desbloqueado o bloqueado,
// cada uno con su tooltip, coste de desbloqueo y evento de clic para cambiar de piso.
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
// Nombres en español de cada tipo de mejora, usados para mostrar mensajes legibles
// al comprar mejoras (buyUpgrade / buyGlobalUpgrade) en lugar de la clave interna.
const TYPE_NAMES = {
  miner: "Minero",
  elevator: "Elevador",
  storage: "Almacén",
  sellMultiplier: "Multiplicador de Venta",
  autoMiner: "Auto-Minero",
  luck: "Suerte",
  speedBoost: "Velocidad Global",
  goldBoost: "Fortuna",
  critChance: "Golpe Crítico",
  drill: "Taladro",
  comboDuration: "Resistencia de Combo"
};

// ============================================================
// GAME ACTIONS
// ============================================================
// Cambia al piso indicado. Si el piso aún está bloqueado, intenta desbloquearlo
// gastando su coste de desbloqueo; si no hay suficiente oro, muestra un aviso.
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

// Maneja el clic en el canvas: convierte las coordenadas del ratón (en píxeles de pantalla,
// ajustadas por devicePixelRatio) a coordenadas del mundo dividiendo por la escala de vista
// (viewScale) y restando el desplazamiento (viewOffX/Y). Luego hace "hit-testing" contra las
// cajas de colisión del minero, elevador y almacén para detectar qué objeto fue tocado.
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

  // Caja de colisión del minero: al escalar (s>1) el área crece centrándose en el punto original.
  const mw = f.miner.width * s, mh = f.miner.height * s;
  const mx = f.miner.x - f.miner.width * (s - 1) / 2;
  const my = f.miner.y - f.miner.height * (s - 1) / 2;
  if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
    // Sólo inicia a minar si no está minando, no está esperando y está en su punto original.
    if (!f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= MINER_HOME_X) {
      f.miner.isMining = true;
      game.totalClicks++;
      addComboClick();
      triggerScreenShake(2, 100);
      spawnParticles(f.miner.x + 40, f.miner.y + 20, FLOOR_CONFIGS[game.currentFloor].oreColor, 3);
    }
  }

  // Caja de colisión del elevador (mismo cálculo de centrado que el minero).
  const ew = f.elevator.width * s, eh = f.elevator.height * s;
  const ex = f.elevator.x - f.elevator.width * (s - 1) / 2;
  const ey = f.elevator.y - f.elevator.height * (s - 1) / 2;
  if (x >= ex && x <= ex + ew && y >= ey && y <= ey + eh) {
    if (!f.elevator.isMoving) {
      f.elevator.isMoving = true;
      game.totalClicks++;
      addComboClick();
    }
  }

  // Caja de colisión del almacén (mismo cálculo de centrado que los anteriores).
  const sw = f.storage.width * s, sh = f.storage.height * s;
  const sx = f.storage.x - f.storage.width * (s - 1) / 2;
  const sy = f.storage.y - f.storage.height * (s - 1) / 2;
  if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
    if (!f.storage.isCollecting) {
      f.storage.isCollecting = true;
      game.totalClicks++;
      addComboClick();
    }
  }
}

// ============================================================
// SHOP / PANELS
// ============================================================
// Abre el panel indicado (shop, achievements, stats o prestige): lo muestra, pausa el juego
// y renderiza su contenido según el tipo.
function openPanel(type) {
  document.getElementById(`panel-${type}`).classList.add("active");
  game.paused = true;
  if (type === "shop") renderShop();
  else if (type === "achievements") renderAchievements();
  else if (type === "stats") renderStats();
  else if (type === "prestige") renderPrestige();
}

// Cierra el panel indicado y reanuda el juego (quita la pausa).
function closePanel(type) {
  document.getElementById(`panel-${type}`).classList.remove("active");
  game.paused = false;
}

// Renderiza el contenido de la tienda del piso actual: mejoras del piso (minero, elevador,
// almacén, multiplicador de venta, auto-minero) y mejoras globales (suerte, velocidad),
// más la opción de desbloquear el siguiente piso. Cada item recibe una clase según su estado
// de compra: 'cant-afford' (no alcanza el oro/gemas) o 'maxed' (nivel máximo alcanzado).
function renderShop() {
  const body = document.getElementById("shopBody");
  const fu = floorUpgrades[game.currentFloor];
  const config = FLOOR_CONFIGS[game.currentFloor];

  let html = `<div class="shop-section"><h3><i class="fas fa-mountain"></i> Piso ${game.currentFloor + 1}: ${config.name}</h3>`;

  // Clase de estado: si no se puede comprar, 'maxed' si llegó al nivel máximo o 'cant-afford' si falta oro.
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
      <div class="desc">Auto mina cada ${fu.autoMiner.isActive() ? (fu.autoMiner.getInterval() / 1000).toFixed(1) + 's' : '5s'}</div>
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
      <div class="desc">+0.5% chance gemas (actual: ${(globalUpgrades.luck.getGemChance() * 100).toFixed(1)}%)</div>
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

  const goldCost = globalUpgrades.goldBoost.getCurrentCost();
  const canGold = game.gems >= goldCost && globalUpgrades.goldBoost.level < globalUpgrades.goldBoost.maxLevel;
  html += `<div class="shop-item ${!canGold ? (globalUpgrades.goldBoost.level >= globalUpgrades.goldBoost.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('goldBoost')">
    <div class="shop-icon" style="background:rgba(255,215,0,0.15);">💵</div>
    <div class="shop-info">
      <div class="name">Fortuna</div>
      <div class="desc">+10% oro por venta (actual: ${globalUpgrades.goldBoost.getMult().toFixed(1)}x)</div>
      <div class="level">Nivel ${globalUpgrades.goldBoost.level}/${globalUpgrades.goldBoost.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.goldBoost.level >= globalUpgrades.goldBoost.maxLevel ? 'MAX' : '💎 ' + goldCost}</div>
  </div>`;

  const critCost = globalUpgrades.critChance.getCurrentCost();
  const canCrit = game.gems >= critCost && globalUpgrades.critChance.level < globalUpgrades.critChance.maxLevel;
  html += `<div class="shop-item ${!canCrit ? (globalUpgrades.critChance.level >= globalUpgrades.critChance.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('critChance')">
    <div class="shop-icon" style="background:rgba(255,69,0,0.15);">🎯</div>
    <div class="shop-info">
      <div class="name">Golpe Crítico</div>
      <div class="desc">+3% de minar x2 material (actual: ${(globalUpgrades.critChance.getChance() * 100).toFixed(0)}%)</div>
      <div class="level">Nivel ${globalUpgrades.critChance.level}/${globalUpgrades.critChance.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.critChance.level >= globalUpgrades.critChance.maxLevel ? 'MAX' : '💎 ' + critCost}</div>
  </div>`;

  const drillCost = globalUpgrades.drill.getCurrentCost();
  const canDrill = game.gems >= drillCost && globalUpgrades.drill.level < globalUpgrades.drill.maxLevel;
  html += `<div class="shop-item ${!canDrill ? (globalUpgrades.drill.level >= globalUpgrades.drill.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('drill')">
    <div class="shop-icon" style="background:rgba(96,165,250,0.15);">🛠️</div>
    <div class="shop-info">
      <div class="name">Taladro</div>
      <div class="desc">-4% tiempo de minado (actual: ${Math.round((1 - globalUpgrades.drill.getTimeMult()) * 100)}% más rápido)</div>
      <div class="level">Nivel ${globalUpgrades.drill.level}/${globalUpgrades.drill.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.drill.level >= globalUpgrades.drill.maxLevel ? 'MAX' : '💎 ' + drillCost}</div>
  </div>`;

  const comboCost = globalUpgrades.comboDuration.getCurrentCost();
  const canComboDur = game.gems >= comboCost && globalUpgrades.comboDuration.level < globalUpgrades.comboDuration.maxLevel;
  html += `<div class="shop-item ${!canComboDur ? (globalUpgrades.comboDuration.level >= globalUpgrades.comboDuration.maxLevel ? 'maxed' : 'cant-afford') : ''}" onclick="buyGlobalUpgrade('comboDuration')">
    <div class="shop-icon" style="background:rgba(255,102,0,0.15);">⏳</div>
    <div class="shop-info">
      <div class="name">Resistencia de Combo</div>
      <div class="desc">+0.25s antes de perder combo (actual: ${(globalUpgrades.comboDuration.getDuration() / 1000).toFixed(2)}s)</div>
      <div class="level">Nivel ${globalUpgrades.comboDuration.level}/${globalUpgrades.comboDuration.maxLevel}</div>
    </div>
    <div class="shop-cost cost-gem">${globalUpgrades.comboDuration.level >= globalUpgrades.comboDuration.maxLevel ? 'MAX' : '💎 ' + comboCost}</div>
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

// Compra una mejora del piso actual: resta el coste del oro, sube un nivel, re-renderiza la
// tienda, verifica logros y muestra notificación + sacudida de pantalla.
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

// Compra una mejora global (suerte o velocidad): resta el coste de las gemas, sube un nivel,
// re-renderiza la tienda, verifica logros y muestra notificación usando gemas.
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

// Renderiza la lista de logros: muestra el contador de desbloqueados y cada logro con su
// icono, nombre (oculto como '???' si no está desbloqueado), descripción y recompensa.
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

// Renderiza el panel de estadísticas con una cuadrícula de tarjetas (oro total, gemas,
// material minado, clics, prestigios, puntuación, tiempo jugado, pisos y combo máximo).
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
        <div class="stat-value" style="color:#FF4500;">${game.maxCombo}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">⚡ Combo Actual</div>
        <div class="stat-value" style="color:${getComboColor() || 'var(--text-primary)'};">${combo.count} (x${combo.multiplier.toFixed(1)})</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💰 Oro Actual</div>
        <div class="stat-value" style="color:var(--gold);">$${formatNum(game.cash)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💠 Gemas Totales</div>
        <div class="stat-value" style="color:var(--purple);">${formatNum(game.totalGems)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🎉 Eventos Activados</div>
        <div class="stat-value" style="color:#22d3ee;">${bonusEvent.totalTriggered}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🏆 Logros</div>
        <div class="stat-value" style="color:var(--gold);">${unlockedAchievements.size}/${ACHIEVEMENTS.length}</div>
      </div>
    </div>
  `;
}

// Renderiza el panel de prestigio: explica el reinicio, muestra las gemas a ganar
// (calculatePrestigeGems) y los botones para cancelar o confirmar el prestigio.
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
// Revisa todos los logros: si alguno no está desbloqueado y su condición se cumple (ach.check()),
// lo añade al set, notifica, verifica logros y otorga su recompensa (gemas u oro según el texto).
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
        game.totalGems += gems;
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
// Añade una entrada al log de eventos del panel lateral: la inserta al principio con la hora
// local (es-MX) y limita el historial a 50 entradas eliminando las más antiguas.
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
// Muestra la barra de evento activo en la parte inferior del juego, rellenándola al 100%
// con el color del evento y mostrando su icono, nombre y descripción.
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

// Oculta la barra de evento activo (la deja con display none).
function hideBonusBar() {
  const bar = document.getElementById('activeBonusBar');
  if (bar) bar.style.display = 'none';
}

// Actualiza el relleno y el tiempo restante de la barra de evento activo según el progreso del temporizador.
function updateActiveBonusBar() {
  if (!bonusEvent.active) return;
  const progress = Math.max(0, bonusEvent.timer / bonusEvent.duration);
  const fill = document.getElementById('bonusBarFill');
  const time = document.getElementById('bonusBarTime');
  if (fill) fill.style.width = (progress * 100) + '%';
  if (time) time.textContent = Math.ceil(bonusEvent.timer / 1000) + 's';
}

// Muestra una notificación tipo "toast" temporal (3s) y la duplica en el log de eventos
// como 'logro' si es un logro o 'info' en caso contrario.
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
// Formatea un número grande usando sufijos K (miles), M (millones), B (mil millones) y T (billones).
function formatNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toLocaleString();
}

// Convierte una cantidad de segundos en texto legible (h/m/s) omitiendo las unidades en cero.
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
// Inicia una partida nueva desde cero: reinicia el estado del juego, pisos, mejoras, combo y
// eventos, y muestra la interfaz del juego ocultando el menú principal.
function startNewGame() {
  game = {
    cash: 0, gems: 0, totalEarned: 0, totalMined: 0, totalClicks: 0,
    score: 0, maxCombo: 0, totalGems: 0, currentFloor: 0, prestigeCount: 0,
    prestigeGems: 0, totalPrestigeGems: 0, startTime: Date.now(), lastSave: Date.now(),
    paused: false, started: true
  };
  unlockedFloors = [true, false, false, false, false, false, false, false, false, false];
  unlockedAchievements = new Set();
  initAllFloors();
  initFloorUpgrades();
  // Reaplica el layout responsivo (las posiciones base son del mundo 1000x750).
  lastLayoutW = 1000;
  relayoutWorld();
  globalUpgrades.luck.level = 0;
  globalUpgrades.speedBoost.level = 0;
  globalUpgrades.goldBoost.level = 0;
  globalUpgrades.critChance.level = 0;
  globalUpgrades.drill.level = 0;
  globalUpgrades.comboDuration.level = 0;
  combo.count = 0;
  combo.multiplier = 1;
  bonusEvent.active = false;
  bonusEvent.totalTriggered = 0;
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

// Continúa una partida guardada: carga los datos, marca el juego como iniciado y muestra la interfaz.
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

// Muestra el menú principal y, si existe una partida guardada, intenta leer sus estadísticas
// para mostrarlas como resumen (manejando errores de guardado corrupto).
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

// Aplica el tema indicado (light/dark) al documento y a la pantalla de carga, y actualiza el icono del botón.
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

// Alterna entre tema claro y oscuro, lo aplica, lo guarda en localStorage y muestra un aviso.
function toggleTheme() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const newTheme = isLight ? "dark" : "light";
  applyTheme(newTheme);
  try { localStorage.setItem(THEME_KEY, newTheme); } catch (e) { }
  showToast(newTheme === "light" ? "☀️ Tema claro" : "🌙 Tema oscuro");
}

// Inicializa el tema leyendo la preferencia guardada en localStorage (por defecto 'dark').
function initTheme() {
  let theme = "dark";
  try { theme = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { }
  applyTheme(theme);
}

// ============================================================
// RETURN TO MENU
// ============================================================
// Cierra todos los paneles abiertos (tienda, logros, stats, prestigio, howto) y quita la pausa.
function closeAllPanels() {
  ["shop", "achievements", "stats", "prestige", "howto"].forEach(p => {
    document.getElementById(`panel-${p}`).classList.remove("active");
  });
  game.paused = false;
}

// Guarda y vuelve al menú principal: pausa el juego, cierra paneles, oculta la interfaz y muestra el menú.
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

// Finaliza la pantalla de carga ocultándola (sólo una vez, gracias al flag loadingDone).
function finishLoading() {
  if (loadingDone) return;
  loadingDone = true;
  document.getElementById("loadingScreen").classList.add("hidden");
}

// Ejecuta la animación de la pantalla de carga: avanza una barra de progreso aleatorio,
// actualiza el porcentaje y rota los consejos (THEME_TIPS) hasta llegar al 100% y luego finaliza.
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

