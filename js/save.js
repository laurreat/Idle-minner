// Clave usada en localStorage para persistir la partida ofuscada.
const SAVE_KEY = "idleMiner_deepEarth_v3";
// Prefijo (sal) que identifica el formato de guardado y ayuda a validar integridad.
const SAVE_SALT = "IDLEMINER_v3::";
// Llave para el cifrado XOR ligero (ofuscación, no seguridad real).
const SAVE_XOR = "caveMinerSecureKey2024";

// Hash djb2 simplificado: genera una suma de comprobación (checksum) en base 36
// usada para detectar si el guardado fue alterado.
function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Aplica cifrado/descifrado XOR carácter a carácter usando una llave repetida.
function xorString(str, key) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

// Convierte el objeto de guardado en una cadena ilegible (ofuscada)
// Pasos: JSON -> [SAL + checksum + "|" + json] -> XOR -> base64 (UTF-8 seguro).
function obfuscateSave(obj) {
  const json = JSON.stringify(obj);
  const checksum = simpleHash(json);
  const payload = SAVE_SALT + checksum + "|" + json;
  const xored = xorString(payload, SAVE_XOR);
  return btoa(unescape(encodeURIComponent(xored)));
}

// Revierte la ofuscación y valida la integridad (detecta modificaciones)
// Base64 -> XOR -> separa SAL/checksum/JSON -> compara checksum para detectar
// guardados corruptos o manipulados. Si falla, intenta parsear como JSON plano
// (formato heredado de versiones anteriores).
function deobfuscateSave(str) {
  str = (str || "").trim();
  try {
    const xored = decodeURIComponent(escape(atob(str)));
    const payload = xorString(xored, SAVE_XOR);
    if (!payload.startsWith(SAVE_SALT)) throw new Error("no-obfuscated");
    const rest = payload.slice(SAVE_SALT.length);
    const sep = rest.indexOf("|");
    if (sep < 0) throw new Error("corrupt");
    const checksum = rest.slice(0, sep);
    const json = rest.slice(sep + 1);
    // Verifica que el contenido no fue alterado comparando el checksum.
    if (simpleHash(json) !== checksum) throw new Error("tampered");
    return JSON.parse(json);
  } catch (e) {
    // Formato heredado (JSON plano de versiones anteriores)
    return JSON.parse(str);
  }
}

// Reúne todo el estado serializable de la partida: progreso global (game),
// pisos desbloqueados, logros, estado de cada piso (minero, elevador, tolva,
// caja, auto-minero y mejoras) y mejoras globales. Los estados de animación
// transitivos (isMoving, isCollecting, etc.) se reinician a valores idle.
function buildSaveData() {
  return {
    game: game,
    unlockedFloors: unlockedFloors,
    unlockedAchievements: [...unlockedAchievements],
    floors: floors.map(f => ({
      miner: f.miner,
      elevator: { x: f.elevator.x, y: f.elevator.y, carrying: f.elevator.carrying, isMoving: false, direction: 1, state: "idle", maxCapacity: f.elevator.maxCapacity },
      storage: { x: f.storage.x, carrying: f.storage.carrying, isCollecting: false, state: "idle", currentSprite: null, initialX: 1100, maxCapacity: f.storage.maxCapacity, collectionTime: f.storage.collectionTime },
      minerBox: f.minerBox,
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
      speedBoost: { level: globalUpgrades.speedBoost.level },
      goldBoost: { level: globalUpgrades.goldBoost.level },
      critChance: { level: globalUpgrades.critChance.level },
      drill: { level: globalUpgrades.drill.level },
      comboDuration: { level: globalUpgrades.comboDuration.level }
    }
  };
}

// Aplica un objeto de guardado al estado del juego: restaura game, pisos/logros
// desbloqueados, reinicia las estructuras de pisos/mejoras y copia los valores
// guardados. Luego calcula ganancias offline si pasó más de 30 s desde lastSave.
function applySaveData(save) {
  Object.assign(game, save.game);
  unlockedFloors = save.unlockedFloors;
  unlockedAchievements = new Set(save.unlockedAchievements);

  initAllFloors();
  if (save.floors) {
    save.floors.forEach((sf, i) => {
      if (floors[i]) {
        Object.assign(floors[i].miner, sf.miner);
        Object.assign(floors[i].elevator, sf.elevator);
        Object.assign(floors[i].storage, sf.storage);
        Object.assign(floors[i].minerBox, sf.minerBox);
        Object.assign(floors[i].minerState, sf.minerState);
        Object.assign(floors[i].elevatorState, sf.elevatorState);
        Object.assign(floors[i].storageState, sf.storageState);
        Object.assign(floors[i].autoMiner, sf.autoMiner);
        floors[i].gemsFound = sf.gemsFound || 0;
      }
    });
  }

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

  if (save.globalUpgrades) {
    globalUpgrades.luck.level = save.globalUpgrades.luck.level || 0;
    globalUpgrades.speedBoost.level = save.globalUpgrades.speedBoost.level || 0;
    globalUpgrades.goldBoost.level = (save.globalUpgrades.goldBoost && save.globalUpgrades.goldBoost.level) || 0;
    globalUpgrades.critChance.level = (save.globalUpgrades.critChance && save.globalUpgrades.critChance.level) || 0;
    globalUpgrades.drill.level = (save.globalUpgrades.drill && save.globalUpgrades.drill.level) || 0;
    globalUpgrades.comboDuration.level = (save.globalUpgrades.comboDuration && save.globalUpgrades.comboDuration.level) || 0;
  }

  // Calcula cuánto tiempo estuvo ausente el jugador (en segundos).
  const offlineTime = (Date.now() - game.lastSave) / 1000;
  // Solo concede ganancias offline si pasaron más de 30 s.
  if (offlineTime > 30) {
    const offlineEarnings = calculateOfflineEarnings(offlineTime);
    if (offlineEarnings > 0) {
      game.cash += offlineEarnings;
      game.totalEarned += offlineEarnings;
      setTimeout(() => showToast(`💡 Ganaste $${formatNum(offlineEarnings)} mientras no estabas (${formatTime(offlineTime)})`), 1000);
    }
  }
}

// Guardado automático en localStorage (ofuscado y con integridad).
// Marca el momento (lastSave) y escribe la cadena ofuscada; muestra un aviso
// salvo que se pase silent = true (usado por export/auto-save interno).
function saveGame(silent) {
  const saveData = buildSaveData();
  game.lastSave = Date.now();
  saveData.game.lastSave = game.lastSave;
  try {
    localStorage.setItem(SAVE_KEY, obfuscateSave(saveData));
    if (!silent) showToast("💾 Partida guardada");
  } catch (e) {
    console.error("Save failed:", e);
  }
}

// Carga la partida desde localStorage. Si no hay datos o el guardado está
// corrupto, reporta el error y muestra aviso de guardado corrupto.
function loadGame() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return false;
    const save = deobfuscateSave(data);
    applySaveData(save);
    return true;
  } catch (e) {
    console.error("Load failed:", e);
    showToast("⚠️ Guardado local corrupto");
    return false;
  }
}

// Indica si existe un guardado válido (y legible) en localStorage.
function hasSave() {
  const data = localStorage.getItem(SAVE_KEY);
  if (!data) return false;
  try { deobfuscateSave(data); return true; }
  catch (e) { return false; }
}

// Exportar partida a un archivo .idlesave (ilegible, ofuscado) mediante Blob/URL.
function downloadSave() {
  if (!game.started) { showToast("Inicia una partida primero"); return; }
  saveGame(true);
  const saveData = buildSaveData();
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const blob = new Blob([obfuscateSave(saveData)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `idlesave-${ts}.idlesave`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("💾 Partida guardada en archivo");
}

// Importar partida desde archivo: .json se parsea directo; .idlesave se
// desofusca. Aplica los datos, reactiva la interfaz y avisa si es inválido.
function importSave(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let save;
      if (file.name.endsWith(".json")) {
        save = JSON.parse(reader.result);
      } else {
        save = deobfuscateSave(reader.result);
      }
      applySaveData(save);
      game.started = true;
      game.paused = false;
      document.getElementById("startMenu").classList.add("hidden");
      document.getElementById("hud").classList.add("active");
      document.getElementById("sideButtons").classList.add("active");
      document.getElementById("floorBar").classList.add("active");
      document.getElementById("eventLog").classList.add("visible");
      updateFloorBar();
      showToast("📂 Partida cargada desde archivo");
    } catch (e) {
      console.error(e);
      showToast("⚠️ Archivo inválido o modificado");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

// Estima las ganancias acumuladas mientras el jugador estuvo ausente. Por cada
// piso con auto-minero: ciclos = segundos / intervalo; por ciclo se vende el
// mínimo entre material minado y las capacidades de elevador/tolva, multiplicado
// por el multiplicador de venta, y se descuenta al 50% (0.5) como bonus offline.
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
      // Por ciclo: limitado por las capacidades de elevador y tolva, a precio de venta.
      const perCycle = Math.min(miningAmount, elevatorCap, storageCap) * sellMult;
      // Bonus offline del 50% sobre lo que habría generado en línea.
      total += cycles * perCycle * 0.5;
    }
  }
  return Math.floor(total);
}

// (Definición duplicada) Comprueba solo la existencia de la clave en localStorage,
// sin validar legibilidad/integridad, a diferencia de la versión anterior.
function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

// ============================================================
// SISTEMA DE PRESTIGIO
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
  game.totalGems += gems;

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
  combo.count = 0;
  combo.multiplier = 1;
  bonusEvent.active = false;

  saveGame();
  showToast(`⭐ ¡Prestigio! +${gems} gemas`);
  closePanel('prestige');
}

// ============================================================
// PARTÍCULAS
// ============================================================
