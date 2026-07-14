// Multiplicador de velocidad del piso: combina el boost global de velocidad
// con el bonus temporal de velocidad obtenido por eventos/combo.
function getFloorSpeedMult() {
  return globalUpgrades.speedBoost.getSpeedMult() * getSpeedBonus();
}

// Bucle de automatización del minero de un piso:
// 1) Si está minando y no llegó al filón (x < 728), avanza hacia la pared.
// 2) Al llegar al filón (x >= 720) espera un tiempo de minado y extrae material:
//    - Suma el material minado al total global y al puntaje según el valor del mineral.
//    - Con cierta probabilidad (chance de gema * bonus) encuentra una gema (💎).
//    - Suelta partículas y detiene el minado.
// 3) Si ya no mina y está lejos de su punto original (x > 110), retrocede; al llegar (x <= 110)
//    deposita el material minado en la caja del minero (minerBox) para el elevador.
function moveMiner(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.miner.isMining && f.miner.x < 728) {
    // Avanza 2.5 px por frame escalado por la velocidad del piso.
    f.miner.x += 2.5 * speedMult;
  } else if (f.miner.isMining && f.miner.x >= 720 && !f.minerState.isWaiting) {
    f.minerState.isWaiting = true;
    f.minerState.miningTimeout = setTimeout(() => {
      let amount = fu.miner.getMiningAmount();
      // Golpe crítico global: duplica el material extraído con cierta probabilidad.
      const isCrit = Math.random() < globalUpgrades.critChance.getChance();
      if (isCrit) {
        amount *= 2;
        spawnFloatingText(f.miner.x, f.miner.y - 55, "¡CRÍTICO! x2", "#FF4500", 24);
      }
      f.miner.material = amount;
      game.totalMined += amount;
      // El puntaje se premia según la cantidad extraída y el valor del mineral del piso.
      game.score += amount * FLOOR_CONFIGS[floorIdx].oreValue;

      // Probabilidad de gema: chance base de suerte * bonus de evento/combo.
      if (Math.random() < globalUpgrades.luck.getGemChance() * getGemChanceBonus()) {
        f.gemsFound++;
        game.gems++;
        game.totalGems++;
        spawnParticles(f.miner.x, f.miner.y, "#a78bfa", 12);
        spawnFloatingText(f.miner.x, f.miner.y - 30, "+1 💎", "#a78bfa", 28);
        triggerScreenShake(3, 200);
      }

      spawnParticles(f.miner.x, f.miner.y, FLOOR_CONFIGS[floorIdx].oreColor, 8);
      f.miner.isMining = false;
      f.minerState.isWaiting = false;
      // Espera el tiempo de minado configurado por mejoras del minero (reducido por el taladro global).
    }, fu.miner.getMiningTime() * globalUpgrades.drill.getTimeMult());
  } else if (!f.miner.isMining && f.miner.x > 110) {
    // Regresa a su punto original a 2.5 px/frame (escalado por velocidad).
    f.miner.x -= 2.5 * speedMult;
    if (f.miner.x <= 110) {
      f.miner.x = 110;
      if (f.miner.material > 0) {
        f.minerBox.material += f.miner.material;
        spawnParticles(f.minerBox.x + 40, f.minerBox.y + 40, FLOOR_CONFIGS[floorIdx].oreColor, 10);
        f.miner.material = 0;
      }
    }
  }
}

// Bucle de automatización del elevador de un piso:
// - Baja (direction 1) hasta la caja del minero, recoge material hasta su capacidad
//   y espera un tiempo proporcional a lo recogido (waitTime = material * ms por unidad).
// - Sube (direction -1) de vuelta a su punto original (y <= 420) y queda idle,
//   dejando el material cargado (carrying) para que el almacenamiento lo recoja.
function moveElevator(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.elevator.isMoving) {
    if (f.elevator.direction === 1) {
      f.elevator.state = "down";
      // El sprite está centrado en (x,y), así que su borde inferior queda en
      // y + height*(scale+1)/2. Se detiene justo al alcanzar el borde inferior de la
      // tolva (minerBox), sin pasarse por el nuevo tamaño del elevador.
      const elevatorStopY = f.minerBox.y + f.minerBox.height - f.elevator.height * (CHAR_SCALE + 1) / 2 + 5;
      if (f.elevator.y < elevatorStopY && !f.elevatorState.isWaiting) {
        f.elevator.y += fu.elevator.getSpeed() * speedMult;
      } else if (f.elevator.y >= elevatorStopY && !f.elevatorState.isWaiting) {
        // Acumula el material de la tolva sin superar su capacidad (lo que ya lleva + lo nuevo).
        const capacity = fu.elevator.getCapacity();
        const materialToTake = Math.min(f.minerBox.material, capacity - f.elevator.carrying);
        // Tiempo de espera: por cada unidad de capacidad tarda 1000 ms (1 s) lleno.
        const waitTime = materialToTake * (1000 / capacity);
        f.elevatorState.isWaiting = true;
        f.elevatorState.elevatorTimeout = setTimeout(() => {
          f.minerBox.material -= materialToTake;
          f.elevator.carrying += materialToTake;
          f.elevator.direction = -1;
          f.elevator.state = "up";
          f.elevatorState.isWaiting = false;
        }, waitTime);
      }
    } else {
      f.elevator.y -= fu.elevator.getSpeed() * speedMult;
      if (f.elevator.y <= 390) {
        f.elevator.isMoving = false;
        f.elevator.direction = 1;
        f.elevator.state = "idle";
      }
    }
  }
}

// Bucle de automatización del almacenamiento (tolva) de un piso:
// - Va (moving) hacia el elevador, recoge el material cargado hasta su capacidad
//   y espera un tiempo de recolección (waitTime escalado por capacidad).
// - Si recogió material vuelve (returning_full), vende el material al llegar:
//   cash/totalEarned/score = material * multiplicador de venta * multiplicador de bonus.
//   El bonus > 1 resalta el texto con 🔥.
// - Si el elevador estaba vacío vuelve vacío (returning_empty) sin vender.
function moveStorage(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.storage.isCollecting) {
    if (f.storage.state === "idle") {
      f.storage.state = "moving";
    }
    if (f.storage.state === "moving") {
      if (f.storage.x > 50) {
        f.storage.x -= 2.5 * speedMult;
        f.storage.currentSprite = sprites.miner_tolva;
      } else if (!f.storageState.isWaiting) {
        if (f.elevator.carrying > 0) {
          // Toma el mínimo entre el material del elevador y su capacidad máxima.
          const materialToCollect = Math.min(f.elevator.carrying, fu.storage.getCapacity());
          // Espera proporcional al material: tiempo de recolección repartido por capacidad.
          const waitTime = materialToCollect * fu.storage.getCollectionTime() / fu.storage.getCapacity();
          f.storageState.isWaiting = true;
          f.storageState.storageTimeout = setTimeout(() => {
            f.storage.carrying = materialToCollect;
            f.elevator.carrying -= materialToCollect;
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
      f.storage.currentSprite = sprites.miner_tolva_reverse_Full;
    } else {
      if (f.storage.carrying > 0) {
        // Multiplicador de venta del piso * bonus global (combo/evento).
        const sellMult = fu.sellMultiplier.getMultiplier();
        const bonusMult = getBonusMultiplier();
        // Ganancia = material vendido * multiplicador de venta * bonus * fortuna global.
        const earned = f.storage.carrying * sellMult * bonusMult * globalUpgrades.goldBoost.getMult();
        game.cash += earned;
        game.totalEarned += earned;
        game.score += earned;

        const text = bonusMult > 1 ? `+$${formatNum(earned)} 🔥` : `+$${formatNum(earned)}`;
        spawnFloatingText(f.storage.x, f.storage.y - 40, text, bonusMult > 1 ? "#FF4500" : "#FFD700", bonusMult > 1 ? 20 : 22);
        f.storage.carrying = 0;
      }
      f.storage.state = "idle";
      f.storage.isCollecting = false;
      f.storage.currentSprite = sprites.miner_tolva;
    }
  }

  if (f.storage.state === "returning_empty") {
    if (f.storage.x < f.storage.initialX) {
      f.storage.x += 2.5 * speedMult;
      f.storage.currentSprite = sprites.miner_tolva_reverse_Nothing;
    } else {
      f.storage.state = "idle";
      f.storage.isCollecting = false;
      f.storage.currentSprite = sprites.miner_tolva;
    }
  }
}

// Controla el minado automático del piso: si el auto-minero está activo y el
// minero está en reposo en su punto original (x <= 110), acumula un temporizador
// (+16 ms por frame ≈ 60 FPS). Al alcanzar el intervalo de mejora, reinicia el
// temporizador y dispara el minado (isMining = true), reiniciando el ciclo.
function updateAutoMiner(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];

  if (fu.autoMiner.isActive() && !f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= 110) {
    // Incrementa ~16 ms por frame (asumiendo 60 FPS).
    f.autoMiner.timer += 16;
    if (f.autoMiner.timer >= fu.autoMiner.getInterval()) {
      f.autoMiner.timer = 0;
      f.miner.isMining = true;
    }
  }
}

// ============================================================
// DIBUJADO
// ============================================================
// Fondo a pantalla completa (cubre todo el lienzo fisico, sin letterbox)
