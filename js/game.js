// ============================================================
// BUCLE PRINCIPAL DEL JUEGO
// ============================================================
// Ejecuta en cada frame el ciclo de actualizacion (logica) y dibujado (render).
// Se agenda a si mismo mediante requestAnimationFrame para correr ~60 FPS.
function gameLoop() {
  // Calcula el delta de tiempo (dt) transcurrido desde el frame anterior,
  // usado para que las actualizaciones sean independientes del framerate.
  const now = Date.now();
  const dt = now - lastTime;
  lastTime = now;

  // Reinicia la transformacion del canvas a identidad antes de dibujar el fondo
  // en pixeles fisicos reales de la pantalla.
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Solo actualiza y dibuja el mundo si la partida esta activa y no en pausa.
  if (game.started && !game.paused) {
    // --- FASE DE ACTUALIZACION (logica del juego) ---
    updateCombo();              // Refresca el temporizador/estado del combo
    updateBonusEvents(dt);      // Avanza los eventos de bonus temporales
    updateScreenShake(dt);      // Reduce progresivamente la vibracion de pantalla
    updateAmbientParticles();   // Mueve las particulas ambientales del fondo

    moveMiner(game.currentFloor);       // Movimiento/animacion del minero
    moveElevator(game.currentFloor);    // Movimiento del ascensor
    moveStorage(game.currentFloor);     // Movimiento del almacen
    updateAutoMiner(game.currentFloor); // Logica del minero automatico
    updateParticles();          // Fisica y vida de las particulas de efecto
    updateFloatingTexts();      // Movimiento y desvanecido de textos flotantes
    checkAchievements();        // Comprueba si se desbloqueo algun logro

    // --- FASE DE DIBUJADO (render) ---
    // Fondo a pantalla completa (espacio fisico, sin escalado logico)
    drawFullScreenBackground();

    // Mundo en coordenadas logicas 1000x750 centrado (letterbox):
    // viewScale escala el mundo logico al tamano de pantalla y viewOffX/viewOffY
    // lo centran dejando bandas negras (letterbox). El offset del screen shake
    // se suma para desplazar toda la escena y simular la vibracion.
    const shake = getShakeOffset();
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX + shake.x * viewScale, viewOffY + shake.y * viewScale);

    // El orden de dibujado define la profundidad (lo primero queda al fondo):
    drawAmbientParticles();             // Particulas ambientales (capa de fondo)
    drawBoxes(game.currentFloor);       // Cajas/minerales del piso
    drawMiner(game.currentFloor);       // Minero
    drawElevator(game.currentFloor);    // Ascensor
    drawStorage(game.currentFloor);     // Almacen
    drawParticles();                    // Particulas de efecto (por encima)
    drawFloatingTexts();                // Textos flotantes de ganancias
    drawFloorIndicator();               // Indicador del piso actual
    drawComboIndicator();               // Indicador del combo
    // El evento de bonus ahora se muestra como barra HTML (no en canvas)
    // drawBonusEventIndicator();
    drawDepthIndicator();               // Indicador de profundidad (HUD superpuesto)

    updateHUD();                        // Actualiza el HUD en HTML (fuera del canvas)
  } else {
    // Fuera de partida (menu, pausa) solo se dibuja el fondo a pantalla completa
    drawFullScreenBackground();
  }

  // Agenda el siguiente frame, manteniendo el bucle en marcha.
  requestAnimationFrame(gameLoop);
}

// Dibuja en la esquina inferior izquierda la profundidad (en metros) del piso
// actual, tomada de su configuracion. Usa sombra para legibilidad sobre el fondo.
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
// Click en el canvas: delega en handleCanvasClick para minar/interactuar.
canvas.addEventListener("click", handleCanvasClick);

// Autoguardado silencioso cada 30 segundos mientras haya partida activa.
setInterval(() => {
  if (game.started) saveGame(true);
}, 30000);

// Estadisticas en tiempo real: refresca el panel cada 500ms mientras esta abierto.
setInterval(() => {
  const panel = document.getElementById("panel-stats");
  if (panel && panel.classList.contains("active")) renderStats();
}, 500);

// Antes de cerrar/recargar la pestana, guarda la partida para no perder progreso.
window.addEventListener("beforeunload", () => {
  if (game.started) saveGame(true);
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
// Secuencia de arranque, en orden: aplicar tema visual, crear todos los pisos,
// preparar sus mejoras, ajustar el canvas al tamano actual, mostrar el menu
// principal, ejecutar la pantalla de carga y finalmente lanzar el bucle del juego.
initTheme();
initAllFloors();
initFloorUpgrades();
resizeCanvas();
showMainMenu();
runLoadingScreen();
gameLoop();

// Reajusta el canvas cuando cambia el tamano de la ventana o la orientacion
// del dispositivo (movil), recalculando la escala y el centrado (letterbox).
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
