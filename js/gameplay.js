function getFloorSpeedMult() {
  return globalUpgrades.speedBoost.getSpeedMult() * getSpeedBonus();
}

function moveMiner(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];
  const speedMult = getFloorSpeedMult();

  if (f.miner.isMining && f.miner.x < 728) {
    f.miner.x += 2.5 * speedMult;
  } else if (f.miner.x >= 720 && !f.minerState.isWaiting) {
    f.minerState.isWaiting = true;
    f.minerState.miningTimeout = setTimeout(() => {
      const amount = fu.miner.getMiningAmount();
      f.miner.material = amount;
      game.totalMined += amount;
      game.score += amount * FLOOR_CONFIGS[floorIdx].oreValue;

      if (Math.random() < globalUpgrades.luck.getGemChance() * getGemChanceBonus()) {
        f.gemsFound++;
        game.gems++;
        spawnParticles(f.miner.x, f.miner.y, "#a78bfa", 12);
        spawnFloatingText(f.miner.x, f.miner.y - 30, "+1 💎", "#a78bfa", 28);
        triggerScreenShake(3, 200);
      }

      spawnParticles(f.miner.x, f.miner.y, FLOOR_CONFIGS[floorIdx].oreColor, 8);
      f.miner.isMining = false;
      f.minerState.isWaiting = false;
    }, fu.miner.getMiningTime());
  } else if (!f.miner.isMining && f.miner.x > 282) {
    f.miner.x -= 2.5 * speedMult;
    if (f.miner.x <= 282) {
      f.miner.x = 282;
      if (f.miner.material > 0) {
        f.minerBox.material += f.miner.material;
        spawnParticles(f.minerBox.x + 40, f.minerBox.y + 40, FLOOR_CONFIGS[floorIdx].oreColor, 10);
        f.miner.material = 0;
      }
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
        if (f.elevator.carrying > 0) {
          const materialToCollect = Math.min(f.elevator.carrying, fu.storage.getCapacity());
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
      f.storage.currentSprite = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_tolva_reverse_1 : sprites.miner_tolva_reverse_2;
    } else {
      if (f.storage.carrying > 0) {
        const sellMult = fu.sellMultiplier.getMultiplier();
        const bonusMult = getBonusMultiplier();
        const earned = f.storage.carrying * sellMult * bonusMult;
        game.cash += earned;
        game.totalEarned += earned;
        game.score += earned;

        const text = bonusMult > 1 ? `+$${formatNum(earned)} 🔥` : `+$${formatNum(earned)}`;
        spawnFloatingText(f.storage.x, f.storage.y - 40, text, bonusMult > 1 ? "#FF4500" : "#FFD700", bonusMult > 1 ? 20 : 22);
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

function updateAutoMiner(floorIdx) {
  const f = floors[floorIdx];
  const fu = floorUpgrades[floorIdx];

  if (fu.autoMiner.isActive() && !f.miner.isMining && !f.minerState.isWaiting && f.miner.x <= 282) {
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
