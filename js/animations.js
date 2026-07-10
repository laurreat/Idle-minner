function spawnParticles(x, y, color, count) {
  const f = floors[game.currentFloor];
  for (let i = 0; i < count; i++) {
    f.particles.push({
      x: x + Math.random() * 40 - 20,
      y: y + Math.random() * 20 - 10,
      vx: Math.random() * 4 - 2,
      vy: -Math.random() * 5 - 2,
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      size: 2 + Math.random() * 5,
      color: color,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2
    });
  }
}

function updateParticles() {
  const f = floors[game.currentFloor];
  f.particles = f.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= p.decay;
    p.rotation += p.rotSpeed;
    return p.life > 0;
  });
}

function drawParticles() {
  const f = floors[game.currentFloor];
  f.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// ============================================================
// TEXTO FLOTANTE
// ============================================================
let floatingTexts = [];

function spawnFloatingText(x, y, text, color, size) {
  floatingTexts.push({ x, y, text, color, life: 1, vy: -2, size: size || 16, scale: 1.3 });
}

function updateFloatingTexts() {
  floatingTexts = floatingTexts.filter(ft => {
    ft.y += ft.vy;
    ft.life -= 0.012;
    ft.scale = Math.max(1, ft.scale - 0.02);
    return ft.life > 0;
  });
}

function drawFloatingTexts() {
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${Math.floor(ft.size * ft.scale)}px 'VT323', monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// ============================================================
// LÓGICA DE MOVIMIENTO DE PISOS
// ============================================================
