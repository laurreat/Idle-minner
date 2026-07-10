// ============================================================
// PARTICULAS
// ============================================================
// Las particulas se almacenan por piso en f.particles. Cada particula es un
// objeto con: posicion (x, y), velocidad (vx, vy), vida (life de 1 a 0),
// ritmo de desvanecido (decay), tamano (size), color, angulo (rotation) y
// velocidad de giro (rotSpeed).

// Crea 'count' particulas en (x, y) dispersandolas aleatoriamente alrededor de
// ese punto y dandoles velocidad inicial hacia arriba. Se usa para efectos al
// minar (chispas/fragmentos de mineral) en el piso actual.
function spawnParticles(x, y, color, count) {
  const f = floors[game.currentFloor];
  for (let i = 0; i < count; i++) {
    f.particles.push({
      x: x + Math.random() * 40 - 20,      // Posicion X con dispersion +-20
      y: y + Math.random() * 20 - 10,      // Posicion Y con dispersion +-10
      vx: Math.random() * 4 - 2,           // Velocidad horizontal aleatoria
      vy: -Math.random() * 5 - 2,          // Velocidad vertical hacia arriba
      life: 1,                             // Vida inicial completa (1 -> 0)
      decay: 0.015 + Math.random() * 0.02, // Cuanta vida pierde por frame
      size: 2 + Math.random() * 5,         // Radio del circulo
      color: color,                        // Color de relleno
      rotation: Math.random() * Math.PI * 2, // Angulo inicial
      rotSpeed: (Math.random() - 0.5) * 0.2  // Velocidad de rotacion
    });
  }
}

// Actualiza la fisica de las particulas del piso actual: aplica la velocidad,
// suma gravedad (vy += 0.12) para que caigan, reduce su vida y gira. El filter
// descarta (elimina) las particulas cuya vida ya llego a 0.
function updateParticles() {
  const f = floors[game.currentFloor];
  f.particles = f.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;            // Gravedad: acelera la caida
    p.life -= p.decay;       // Envejecimiento
    p.rotation += p.rotSpeed;
    return p.life > 0;       // Mantiene solo las que siguen vivas
  });
}

// Dibuja cada particula del piso actual como un circulo relleno. La opacidad
// (globalAlpha) se liga a la vida para que se desvanezca, y se aplica traslacion
// y rotacion antes de trazar el arco. Restaura el contexto tras cada particula.
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
// Lista global de textos flotantes activos. Cada texto es un objeto con:
// posicion (x, y), contenido (text), color, vida (life de 1 a 0), velocidad
// vertical (vy), tamano de fuente (size) y escala de animacion (scale).
let floatingTexts = [];

// Crea un texto flotante en (x, y) que sube y se desvanece. Se usa para mostrar
// ganancias/valores emergentes. Empieza con scale 1.3 (efecto de "pop").
function spawnFloatingText(x, y, text, color, size) {
  floatingTexts.push({ x, y, text, color, life: 1, vy: -2, size: size || 16, scale: 1.3 });
}

// Actualiza los textos flotantes: los desplaza hacia arriba, reduce su vida y
// contrae la escala de 1.3 hacia 1 (efecto inicial). El filter elimina los que
// ya agotaron su vida.
function updateFloatingTexts() {
  floatingTexts = floatingTexts.filter(ft => {
    ft.y += ft.vy;                          // Sube
    ft.life -= 0.012;                       // Se desvanece
    ft.scale = Math.max(1, ft.scale - 0.02); // Reduce el "pop" hasta 1
    return ft.life > 0;
  });
}

// Dibuja cada texto flotante centrado en su posicion, con opacidad ligada a la
// vida (desvanecido) y tamano de fuente escalado por ft.scale. Usa sombra para
// destacarlo sobre el fondo.
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
