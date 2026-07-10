function drawFullScreenBackground() {
  const config = floors[game.currentFloor].config;
  if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
    const iw = backgroundImage.naturalWidth;
    const ih = backgroundImage.naturalHeight;
    const scale = Math.max(canvas.width / iw, canvas.height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;
    ctx.drawImage(backgroundImage, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = config.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawBoxes(floorIdx) {
  const f = floors[floorIdx];
  const config = f.config;

  let tolvaSprite;
  const oro = f.minerBox.material * config.oreValue;
  if (oro <= 900) tolvaSprite = sprites.tolva_miner_0;
  else if (oro <= 2100) tolvaSprite = sprites.tolva_miner_1;
  else if (oro <= 5000) tolvaSprite = sprites.tolva_miner_2;
  else tolvaSprite = sprites.tolva_miner_3;

  if (tolvaSprite && tolvaSprite.complete) {
    ctx.drawImage(tolvaSprite, f.minerBox.x, f.minerBox.y, f.minerBox.width, f.minerBox.height);
  } else {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(f.minerBox.x, f.minerBox.y, f.minerBox.width, f.minerBox.height);
  }

  // Etiqueta de la tolva con brillo
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(ctx, f.minerBox.x - 10, f.minerBox.y - 32, 105, 26, 8);
  ctx.fill();
  ctx.strokeStyle = config.oreColor;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  roundRect(ctx, f.minerBox.x - 10, f.minerBox.y - 32, 105, 26, 8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = config.oreColor;
  ctx.font = "bold 18px 'VT323', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(`⛏️ ${f.minerBox.material}`, f.minerBox.x + 42, f.minerBox.y - 14);
  ctx.shadowBlur = 0;

  // Indicador de carga del minero
  if (f.miner.material > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    roundRect(ctx, f.miner.x + 30, f.miner.y - 30, 70, 22, 6);
    ctx.fill();
    ctx.fillStyle = config.oreColor;
    ctx.font = "bold 15px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(`+${f.miner.material}`, f.miner.x + 65, f.miner.y - 15);
    ctx.shadowBlur = 0;
  }

  if (f.storage.carrying > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    roundRect(ctx, f.storage.x - 20, f.storage.y - 34, 85, 26, 8);
    ctx.fill();
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 16px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(`💰 ${f.storage.carrying}`, f.storage.x + 22, f.storage.y - 16);
    ctx.shadowBlur = 0;
  }
}

function drawMiner(floorIdx) {
  const f = floors[floorIdx];
  let spriteToDraw;

  if (f.miner.isMining) {
    spriteToDraw = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_walk_1 : sprites.miner_walk_2;
  } else if (f.miner.x > 282) {
    spriteToDraw = Math.floor(Date.now() / 200) % 2 === 0 ? sprites.miner_walk_reverse_1 : sprites.miner_walk_reverse_2;
  } else {
    spriteToDraw = sprites.miner_idle;
  }

  const scale = CHAR_SCALE;
  const drawX = f.miner.x - (f.miner.width * (scale - 1)) / 2;
  const drawY = f.miner.y - (f.miner.height * (scale - 1)) / 2;

  const breathe = Math.sin(Date.now() / 500) * 2;

  if (spriteToDraw && spriteToDraw.complete) {
    ctx.drawImage(spriteToDraw, drawX, drawY + breathe, f.miner.width * scale, f.miner.height * scale);
  } else {
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(drawX, drawY + breathe, f.miner.width * scale, f.miner.height * scale);
  }

  // Barra de progreso solo mientras mina (quieto), no mientras camina
  if (f.minerState.isWaiting) {
    const barWidth = 80;
    const barHeight = 6;
    const barX = drawX + (f.miner.width * scale) / 2 - barWidth / 2;
    const barY = drawY - 16;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    ctx.fillStyle = "#10b981";
    roundRect(ctx, barX, barY, barWidth, barHeight, 3);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Minando...", drawX + (f.miner.width * scale) / 2, barY - 6); // ya en español
  }
}

function drawElevator(floorIdx) {
  const f = floors[floorIdx];
  const scale = CHAR_SCALE;

  let spriteToDraw;
  switch (f.elevator.state) {
    case "down": spriteToDraw = sprites.miner_elevador_1; break;
    case "up": spriteToDraw = sprites.miner_elevador_2; break;
    default: spriteToDraw = sprites.miner_elevador_0;
  }

  if (spriteToDraw && spriteToDraw.complete) {
    ctx.drawImage(spriteToDraw,
      f.elevator.x - (f.elevator.width * (scale - 1)) / 2,
      f.elevator.y - (f.elevator.height * (scale - 1)) / 2,
      f.elevator.width * scale, f.elevator.height * scale);
  } else {
    ctx.fillStyle = "#2196F3";
    ctx.fillRect(f.elevator.x, f.elevator.y, f.elevator.width * scale, f.elevator.height * scale);
  }

  // Indicador de carga
  if (f.elevator.carrying > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    roundRect(ctx, f.elevator.x - 10, f.elevator.y - 28, 70, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 15px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(`📦 ${f.elevator.carrying}`, f.elevator.x + 25, f.elevator.y - 13);
    ctx.shadowBlur = 0;
  }

  // Barra de progreso solo mientras carga (quieto), no mientras se mueve
  if (f.elevatorState.isWaiting && f.elevator.state === "down") {
    const barWidth = 80;
    const barHeight = 6;
    const barX = f.elevator.x + (f.elevator.width * scale) / 2 - barWidth / 2;
    const barY = f.elevator.y - 16;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    ctx.fillStyle = "#60a5fa";
    roundRect(ctx, barX, barY, barWidth, barHeight, 3);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Cargando...", f.elevator.x + (f.elevator.width * scale) / 2, barY - 6); // ya en español
  }
}

function drawStorage(floorIdx) {
  const f = floors[floorIdx];
  if (!f.storage.currentSprite) f.storage.currentSprite = sprites.miner_tolva_1;
  const scale = CHAR_SCALE;

  if (f.storage.currentSprite && f.storage.currentSprite.complete) {
    ctx.drawImage(f.storage.currentSprite,
      f.storage.x - (f.storage.width * (scale - 1)) / 2,
      f.storage.y - (f.storage.height * (scale - 1)) / 2,
      f.storage.width * scale, f.storage.height * scale);
  } else {
    ctx.fillStyle = "#FF9800";
    ctx.fillRect(f.storage.x, f.storage.y, f.storage.width * scale, f.storage.height * scale);
  }

  // Barra de progreso solo mientras recoge/entrega (quieto), no mientras camina
  if (f.storageState.isWaiting) {
    const barWidth = 80;
    const barHeight = 6;
    const barX = f.storage.x + (f.storage.width * scale) / 2 - barWidth / 2;
    const barY = f.storage.y - 16;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    ctx.fillStyle = f.storage.state === "returning_full" ? "#FFD700" : "#60a5fa";
    roundRect(ctx, barX, barY, barWidth, barHeight, 3);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.fillText(f.storage.carrying > 0 ? "Recogiendo..." : "Dejando...", f.storage.x + (f.storage.width * scale) / 2, barY - 6);
  }
}

function drawFloorIndicator() {
  const config = FLOOR_CONFIGS[game.currentFloor];
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, W / 2 - 140, H - 48, 280, 38, 12);
  ctx.fill();
  ctx.strokeStyle = config.oreColor;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 140, H - 48, 280, 38, 12);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = config.oreColor;
  ctx.font = "bold 18px 'VT323', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(`${config.name} | Valor: ${config.oreValue}x`, W / 2, H - 23);
  ctx.shadowBlur = 0;
}

function drawComboIndicator() {
  if (combo.count < 3) return;

  const color = getComboColor() || "#60a5fa";
  const x = W / 2;
  const y = 60;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, x - 80, y - 20, 160, 36, 10);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  roundRect(ctx, x - 80, y - 20, 160, 36, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  ctx.font = "bold 24px 'VT323', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(`🔥 COMBO x${combo.count}`, x, y + 5);
  ctx.shadowBlur = 0;

  // Barra de progreso hacia el siguiente umbral
  let nextThreshold = combo.thresholds.find(t => t > combo.count);
  if (nextThreshold) {
    const prevThreshold = combo.thresholds[combo.thresholds.indexOf(nextThreshold) - 1] || 0;
    const progress = (combo.count - prevThreshold) / (nextThreshold - prevThreshold);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, x - 70, y + 18, 140, 6, 3);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x - 70, y + 18, 140 * progress, 6, 3);
    ctx.fill();
  }
}

function drawBonusEventIndicator() {
  if (!bonusEvent.active) return;

  const type = bonusEvent.type;
  const x = W / 2;
  const y = 96;
  const timeLeft = Math.ceil(bonusEvent.timer / 1000);
  const progress = Math.max(0, Math.min(1, bonusEvent.timer / bonusEvent.duration));

  const boxW = 280, boxH = 78;
  const bx = x - boxW / 2, by = y - 38;

  // Fondo pulsante
  const pulse = Math.sin(Date.now() / 200) * 0.1 + 0.9;
  ctx.fillStyle = `rgba(0,0,0,${0.72 * pulse})`;
  roundRect(ctx, bx, by, boxW, boxH, 14);
  ctx.fill();
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  roundRect(ctx, bx, by, boxW, boxH, 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Nombre + icono
  ctx.fillStyle = type.color;
  ctx.font = "bold 26px 'VT323', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = type.color;
  ctx.shadowBlur = 12;
  ctx.fillText(`${type.icon} ${type.name}`, x, y - 6);
  ctx.shadowBlur = 0;

  // Descripción del efecto
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "16px 'VT323', monospace";
  ctx.fillText(type.desc, x, y + 14);

  // Barra de progreso de duración
  const barW = boxW - 40, barH = 7, barX = bx + 20, barY = y + 24;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();
  ctx.fillStyle = type.color;
  roundRect(ctx, barX, barY, barW * progress, barH, 4);
  ctx.fill();

  // Tiempo restante + contador de eventos totales
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "14px 'VT323', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${timeLeft}s`, barX, barY - 4);
  ctx.textAlign = "right";
  ctx.fillText(`Eventos: ${bonusEvent.totalTriggered}`, barX + barW, barY - 4); // ya en español
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
// ACTUALIZACIONES DE UI
// ============================================================
