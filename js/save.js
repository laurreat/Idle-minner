const SAVE_KEY = "idleMiner_deepEarth_v3";
const SAVE_SALT = "IDLEMINER_v3::";
const SAVE_XOR = "caveMinerSecureKey2024";

function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function xorString(str, key) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

// Convierte el objeto de guardado en una cadena ilegible (ofuscada)
function obfuscateSave(obj) {
  const json = JSON.stringify(obj);
  const checksum = simpleHash(json);
  const payload = SAVE_SALT + checksum + "|" + json;
  const xored = xorString(payload, SAVE_XOR);
  return btoa(unescape(encodeURIComponent(xored)));
}

// Revierte la ofuscación y valida la integridad (detecta modificaciones)
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
    if (simpleHash(json) !== checksum) throw new Error("tampered");
    return JSON.parse(json);
  } catch (e) {
    // Formato heredado (JSON plano de versiones anteriores)
    return JSON.parse(str);
  }
}

function buildSaveData() {
  return {
    game: game,
    unlockedFloors: unlockedFloors,
    unlockedAchievements: [...unlockedAchievements],
    floors: floors.map(f => ({
      miner: f.miner,
      elevator: { x: f.elevator.x, y: f.elevator.y, carrying: f.elevator.carrying, isMoving: false, direction: 1, state: "idle", maxCapacity: f.elevator.maxCapacity },
      storage: { x: f.storage.x, carrying: f.storage.carrying, isCollecting: false, state: "idle", currentSprite: null, initialX: 600, maxCapacity: f.storage.maxCapacity, collectionTime: f.storage.collectionTime },
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
      speedBoost: { level: globalUpgrades.speedBoost.level }
    }
  };
}

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
  }

  const offlineTime = (Date.now() - game.lastSave) / 1000;
  if (offlineTime > 30) {
    const offlineEarnings = calculateOfflineEarnings(offlineTime);
    if (offlineEarnings > 0) {
      game.cash += offlineEarnings;
      game.totalEarned += offlineEarnings;
      setTimeout(() => showToast(`­ƒÆñ Ganaste $${formatNum(offlineEarnings)} mientras no estabas (${formatTime(offlineTime)})`), 1000);
    }
  }
}

// Guardado automático en localStorage (ofuscado y con integridad)
function saveGame(silent) {
  const saveData = buildSaveData();
  game.lastSave = Date.now();
  saveData.game.lastSave = game.lastSave;
  try {
    localStorage.setItem(SAVE_KEY, obfuscateSave(saveData));
    if (!silent) showToast("­ƒÆ¥ Partida guardada");
  } catch (e) {
    console.error("Save failed:", e);
  }
}

function loadGame() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return false;
    const save = deobfuscateSave(data);
    applySaveData(save);
    return true;
  } catch (e) {
    console.error("Load failed:", e);
    showToast("ÔÜá´©Å Guardado local corrupto");
    return false;
  }
}

function hasSave() {
  const data = localStorage.getItem(SAVE_KEY);
  if (!data) return false;
  try { deobfuscateSave(data); return true; }
  catch (e) { return false; }
}

// Exportar partida a un archivo .idlesave (ilegible) o .json (legible)
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
  showToast("­ƒôÑ Partida guardada en archivo");
}

// Importar partida desde archivo (.idlesave o .json)
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
      updateFloorBar();
      showToast("­ƒôé Partida cargada desde archivo");
    } catch (e) {
      console.error(e);
      showToast("ÔÜá´©Å Archivo invalido o modificado");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
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
      total += cycles * perCycle * 0.5;
    }
  }
  return Math.floor(total);
}

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
  showToast(`Ô¡É ┬íPrestigio! +${gems} gemas`);
  closePanel('prestige');
}

// ============================================================
// PARTÍCULAS
// ============================================================
