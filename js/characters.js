// Dibuja el fondo de pantalla completa del piso actual.
// Usa un sprite (imagen) de fondo escalado con "cover" (rellena sin deformar);
// si no está cargado, cae a un color plano definido en la config del piso.
function drawFullScreenBackground() {
  const config = floors[game.currentFloor].config;
  // Escala para cubrir todo el canvas (cover): toma el mayor factor para no dejar huecos
  if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
    const iw = backgroundImage.naturalWidth;
    const ih = backgroundImage.naturalHeight;
    const scale = Math.max(canvas.width / iw, canvas.height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    // Centra la imagen recortada (letterbox) en el canvas
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;
    ctx.drawImage(backgroundImage, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = config.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Dibuja los elementos de caja del piso: la tolva del minero y etiquetas
// (material acumulado, carga del minero y carga del almacén).
// Mezcla sprites (tolva) con primitivas de canvas (rectángulos de etiquetas y texto).
function drawBoxes(floorIdx) {
  const f = floors[floorIdx];
  const config = f.config;

  let tolvaSprite;
  // Selecciona el sprite de la tolva según el valor del oro acumulado
  const oro = f.minerBox.material * config.oreValue;
  if (oro <= 900) tolvaSprite = sprites.tolva_miner_0;
  else if (oro <= 2100) tolvaSprite = sprites.tolva_miner_1;
  else if (oro <= 5000) tolvaSprite = sprites.tolva_miner_2;
  else tolvaSprite = sprites.tolva_miner_3;

  // Dibuja la tolva con sprite si está cargado; si no, usa un rectángulo marrón de respaldo
  if (tolvaSprite && tolvaSprite.complete) {
    ctx.drawImage(tolvaSprite, f.minerBox.x, f.minerBox.y, f.minerBox.width, f.minerBox.height);
  } else {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(f.minerBox.x, f.minerBox.y, f.minerBox.width, f.minerBox.height);
  }

  // Etiqueta de la tolva con brillo (rectángulo redondeado + borde semitransparente)
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(ctx, f.minerBox.x - 10, f.minerBox.y - 32, 105, 26, 8);
  ctx.fill();
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

  // Indicador flotante de la carga que lleva el minero (+material)
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

  // Indicador flotante de lo que transporta el almacén (💰 carrying)
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

// Dibuja al minero del piso: elige sprite según estado (minando, caminando o idle),
// lo escala con CHAR_SCALE y aplica una animación de "respiración" vertical.
// Sprite con respaldo de rectángulo; además dibuja barra de progreso al esperar.
function drawMiner(floorIdx) {
  const f = floors[floorIdx];
  let spriteToDraw;

  // Selecciona el sprite según el estado/dirección del minero
  if (f.minerState.isWaiting) {
    // Extrae material en la roca: muestra el sprite de minado
    spriteToDraw = sprites.miner_mine;
  } else if (f.miner.isMining) {
    // Caminando hacia la roca para minar
    spriteToDraw = sprites.miner_walk;
  } else if (f.miner.x > 70) {
    // Volviendo a la tolva tras entregar
    spriteToDraw = sprites.miner_walk_reverse;
  } else {
    spriteToDraw = sprites.miner_idle;
  }

  const scale = CHAR_SCALE;
  // Centra el sprite escalado sobre el punto (x,y) original del minero
  const drawX = f.miner.x - (f.miner.width * (scale - 1)) / 2;
  const drawY = f.miner.y - (f.miner.height * (scale - 1)) / 2;

  // Animación de respiración: oscila ±2px verticalmente con una onda senoidal
  const breathe = Math.sin(Date.now() / 500) * 2;

  // Dibuja el minero con sprite si está cargado; si no, rectángulo dorado de respaldo
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

// Dibuja el elevador del piso: elige sprite según su estado (bajando, subiendo o idle),
// lo escala con CHAR_SCALE, muestra indicador de carga y barra de "Cargando..." al esperar.
// Sprite con respaldo de rectángulo.
function drawElevator(floorIdx) {
  const f = floors[floorIdx];
  const scale = CHAR_SCALE;

  let spriteToDraw;
  // Selecciona el fotograma del elevador según su dirección/movimiento
  switch (f.elevator.state) {
    case "down": spriteToDraw = sprites.miner_elevador_1; break;
    case "up": spriteToDraw = sprites.miner_elevador_2; break;
    default: spriteToDraw = sprites.miner_elevador_0;
  }

  // Centra el sprite escalado sobre el punto original y dibuja; respaldo azul si no carga
  if (spriteToDraw && spriteToDraw.complete) {
    ctx.drawImage(spriteToDraw,
      f.elevator.x - (f.elevator.width * (scale - 1)) / 2,
      f.elevator.y - (f.elevator.height * (scale - 1)) / 2,
      f.elevator.width * scale, f.elevator.height * scale);
  } else {
    ctx.fillStyle = "#2196F3";
    ctx.fillRect(f.elevator.x, f.elevator.y, f.elevator.width * scale, f.elevator.height * scale);
  }

  // Indicador flotante de lo que transporta el elevador (📦 carrying)
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
    // Centra la barra sobre el elevador y la coloca encima
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

// Dibuja el almacén/tolva del piso: usa el sprite actual (con respaldo naranja),
// escalado con CHAR_SCALE, y barra de progreso al recoger/dejar carga.
function drawStorage(floorIdx) {
  const f = floors[floorIdx];
  // Sprite por defecto si aún no se ha asignado ninguno
  if (!f.storage.currentSprite) f.storage.currentSprite = sprites.miner_tolva;
  const scale = CHAR_SCALE;

  // Centra el sprite escalado sobre el punto original; respaldo naranja si no carga
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
    // Centra la barra sobre el almacén y la coloca encima
    const barX = f.storage.x + (f.storage.width * scale) / 2 - barWidth / 2;
    const barY = f.storage.y - 16;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    // Color de la barra: dorado al volver lleno, azul al recoger
    ctx.fillStyle = f.storage.state === "returning_full" ? "#FFD700" : "#60a5fa";
    roundRect(ctx, barX, barY, barWidth, barHeight, 3);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px 'VT323', monospace";
    ctx.textAlign = "center";
    // Texto cambia según si lleva carga (recogiendo) o está vacío (dejando)
    ctx.fillText(f.storage.carrying > 0 ? "Recogiendo..." : "Dejando...", f.storage.x + (f.storage.width * scale) / 2, barY - 6);
  }
}

// Dibuja el indicador inferior del piso actual (nombre y valor del mineral).
// Puramente primitivas de canvas: rectángulo redondeado + texto con sombra.
function drawFloorIndicator() {
  const config = FLOOR_CONFIGS[game.currentFloor];
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, W / 2 - 140, H - 48, 280, 38, 12);
  ctx.fill();
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

// Dibuja el indicador de combo (solo si combo.count >= 3): texto con brillo
// y barra de progreso hacia el siguiente umbral. Primitivas de canvas + texto.
function drawComboIndicator() {
  if (combo.count < 3) return;

  const color = getComboColor() || "#60a5fa";
  const x = W / 2;
  const y = 60;

  ctx.fillStyle = color;
  ctx.font = "bold 24px 'VT323', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(`🔥 COMBO x${combo.count}`, x, y + 5);
  ctx.shadowBlur = 0;

  // Barra de progreso hacia el siguiente umbral de combo
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

// Dibuja el indicador del evento bonus activo: nombre+icono, descripción,
// barra de duración restante y tiempos. Primitivas de canvas + texto (sin sprites).
function drawBonusEventIndicator() {
  if (!bonusEvent.active) return;

  const type = bonusEvent.type;
  const x = W / 2;
  const y = 96;
  // Segundos restantes y progreso de duración normalizado a 0..1
  const timeLeft = Math.ceil(bonusEvent.timer / 1000);
  const progress = Math.max(0, Math.min(1, bonusEvent.timer / bonusEvent.duration));

  const boxW = 280, boxH = 78;
  // Esquina superior izquierda de la caja centrada en (x,y)
  const bx = x - boxW / 2, by = y - 38;

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

  // Barra de progreso de duración (rellena según "progress")
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

// Dibuja la ruta de un rectángulo redondeado (solo la ruta, sin relleno/trazado).
// Usa curvas cuadráticas en las 4 esquinas. Hay que llamar a ctx.fill()/ctx.stroke() después.
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
