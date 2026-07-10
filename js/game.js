function gameLoop() {
  const now = Date.now();
  const dt = now - lastTime;
  lastTime = now;

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (game.started && !game.paused) {
    updateCombo();
    updateBonusEvents(dt);
    updateScreenShake(dt);
    updateAmbientParticles();

    moveMiner(game.currentFloor);
    moveElevator(game.currentFloor);
    moveStorage(game.currentFloor);
    updateAutoMiner(game.currentFloor);
    updateParticles();
    updateFloatingTexts();
    checkAchievements();

    // Fondo a pantalla completa (espacio fisico)
    drawFullScreenBackground();

    // Mundo en coordenadas logicas 1000x750 centrado (letterbox)
    const shake = getShakeOffset();
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX + shake.x * viewScale, viewOffY + shake.y * viewScale);

    drawAmbientParticles();
    drawBoxes(game.currentFloor);
    drawMiner(game.currentFloor);
    drawElevator(game.currentFloor);
    drawStorage(game.currentFloor);
    drawParticles();
    drawFloatingTexts();
    drawFloorIndicator();
    drawComboIndicator();
    drawBonusEventIndicator();
    drawDepthIndicator();

    updateHUD();
  } else {
    // Tambien dibuja el fondo a pantalla completa fuera de partida
    drawFullScreenBackground();
  }

  requestAnimationFrame(gameLoop);
}

function drawDepthIndicator() {
  const config = floors[game.currentFloor].config;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 16px 'VT323', monospace";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 4;
  ctx.fillText(`Profundidad: ${config.depth}m`, 14, H - 14);
  ctx.shadowBlur = 0;
}

// ============================================================
// ESCUCHADORES DE EVENTOS
// ============================================================
canvas.addEventListener("click", handleCanvasClick);

setInterval(() => {
  if (game.started) saveGame(true);
}, 30000);

// Estadisticas en tiempo real: refresca el panel mientras esta abierto
setInterval(() => {
  const panel = document.getElementById("panel-stats");
  if (panel && panel.classList.contains("active")) renderStats();
}, 500);

window.addEventListener("beforeunload", () => {
  if (game.started) saveGame(true);
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
initTheme();
initAllFloors();
initFloorUpgrades();
resizeCanvas();
showMainMenu();
runLoadingScreen();
gameLoop();

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
