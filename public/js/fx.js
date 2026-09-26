/* ==========================================================================
   Multiverse FX Engine (powered by p5.js)
   Lightweight, high-performance ambient & tabletop procedural animations
   ========================================================================== */

(() => {
  if (typeof window === "undefined") return;

  const FX = {
    bgInstance: null,
    tableInstance: null,
    diceInstance: null,
    particles: [],
    mouseTrail: [],
  };

  function getThemeColors() {
    const skin = (window.MTG && window.MTG.getSkin) ? window.MTG.getSkin(window.MTG_SECOND) : "classic";
    switch (skin) {
      case "fairy":
        return {
          primary: [74, 222, 128],
          secondary: [110, 231, 183],
          accent: [34, 197, 94],
          glow: "rgba(74, 222, 128, 0.4)",
          type: "spores",
        };
      case "kitty":
        return {
          primary: [255, 117, 160],
          secondary: [244, 114, 182],
          accent: [251, 113, 133],
          glow: "rgba(255, 117, 160, 0.4)",
          type: "hearts",
        };
      case "princess":
        return {
          primary: [226, 217, 243],
          secondary: [167, 139, 250],
          accent: [255, 255, 255],
          glow: "rgba(226, 217, 243, 0.4)",
          type: "snow",
        };
      case "metal":
        return {
          primary: [239, 68, 68],
          secondary: [220, 38, 38],
          accent: [251, 146, 60],
          glow: "rgba(239, 68, 68, 0.4)",
          type: "embers",
        };
      case "cyber":
        return {
          primary: [0, 240, 255],
          secondary: [2, 132, 199],
          accent: [56, 189, 248],
          glow: "rgba(0, 240, 255, 0.4)",
          type: "digital",
        };
      case "edgelord":
        return {
          primary: [163, 230, 53],
          secondary: [101, 163, 13],
          accent: [225, 29, 72],
          glow: "rgba(163, 230, 53, 0.4)",
          type: "necro",
        };
      case "classic":
      default:
        return {
          primary: [215, 180, 92],
          secondary: [243, 221, 154],
          accent: [126, 217, 160],
          glow: "rgba(215, 180, 92, 0.4)",
          type: "stardust",
        };
    }
  }

  /* ------------------------------------------------------------------ */
  /* 1. Sitewide Ambient Background Particle Tapestry                   */
  /* ------------------------------------------------------------------ */
  function initBackgroundFX() {
    if (FX.bgInstance || typeof p5 === "undefined") return;

    let container = document.getElementById("bg-fx-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bg-fx-container";
      container.style.position = "fixed";
      container.style.inset = "0";
      container.style.pointerEvents = "none";
      container.style.zIndex = "0";
      container.style.opacity = "0.75";
      container.style.overflow = "hidden";
      document.body.prepend(container);
    }

    const sketch = (p) => {
      const PARTICLE_COUNT = 45;
      const particles = [];
      const mouseParticles = [];

      p.setup = () => {
        const c = p.createCanvas(p.windowWidth, p.windowHeight);
        c.parent(container);
        p.frameRate(30);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            size: p.random(2, 5.5),
            vx: p.random(-0.35, 0.35),
            vy: p.random(-0.5, -0.1),
            alpha: p.random(60, 200),
            pulse: p.random(p.TWO_PI),
            pulseSpeed: p.random(0.02, 0.05),
          });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        p.clear();
        const colors = getThemeColors();

        // 1. Ambient Background Particles
        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.pulse += pt.pulseSpeed;

          // Wrap edges smoothly
          if (pt.y < -10) {
            pt.y = p.height + 10;
            pt.x = p.random(p.width);
          }
          if (pt.x < -10) pt.x = p.width + 10;
          if (pt.x > p.width + 10) pt.x = -10;

          const currentAlpha = pt.alpha + p.sin(pt.pulse) * 45;
          const sz = pt.size + p.sin(pt.pulse * 1.5) * 1.2;

          p.noStroke();
          if (colors.type === "hearts") {
            p.fill(colors.primary[0], colors.primary[1], colors.primary[2], currentAlpha * 0.7);
            drawMiniHeart(p, pt.x, pt.y, sz * 1.6);
          } else if (colors.type === "snow") {
            p.fill(255, 255, 255, currentAlpha);
            p.circle(pt.x, pt.y, sz);
            // Crystal sparkle flare
            if (i % 4 === 0) {
              p.stroke(colors.secondary[0], colors.secondary[1], colors.secondary[2], currentAlpha * 0.4);
              p.strokeWeight(1);
              p.line(pt.x - sz * 1.8, pt.y, pt.x + sz * 1.8, pt.y);
              p.line(pt.x, pt.y - sz * 1.8, pt.x, pt.y + sz * 1.8);
              p.noStroke();
            }
          } else if (colors.type === "digital") {
            // Cyan grid motes
            p.fill(colors.primary[0], colors.primary[1], colors.primary[2], currentAlpha);
            p.rect(pt.x, pt.y, sz * 1.2, sz * 1.2, 1);
          } else if (colors.type === "embers") {
            // Rising fiery embers
            p.fill(
              i % 2 === 0 ? colors.primary[0] : colors.accent[0],
              i % 2 === 0 ? colors.primary[1] : colors.accent[1],
              i % 2 === 0 ? colors.primary[2] : colors.accent[2],
              currentAlpha
            );
            p.circle(pt.x, pt.y, sz);
          } else {
            // Golden & Sylvan stardust
            p.fill(colors.primary[0], colors.primary[1], colors.primary[2], currentAlpha);
            p.circle(pt.x, pt.y, sz);
          }
        }

        // 2. Mouse Interactive Trail Particles
        for (let i = mouseParticles.length - 1; i >= 0; i--) {
          const mp = mouseParticles[i];
          mp.x += mp.vx;
          mp.y += mp.vy;
          mp.life -= 0.04;
          mp.size *= 0.96;

          if (mp.life <= 0) {
            mouseParticles.splice(i, 1);
            continue;
          }

          p.noStroke();
          p.fill(colors.secondary[0], colors.secondary[1], colors.secondary[2], mp.life * 180);
          p.circle(mp.x, mp.y, mp.size);
        }
      };

      p.mouseMoved = () => {
        if (mouseParticles.length < 30 && p.random() > 0.4) {
          mouseParticles.push({
            x: p.mouseX,
            y: p.mouseY,
            vx: p.random(-1, 1),
            vy: p.random(-1, 1),
            size: p.random(4, 9),
            life: 1.0,
          });
        }
      };
    };

    FX.bgInstance = new p5(sketch);
  }

  /* ------------------------------------------------------------------ */
  /* Top-Level Mouse Trails Layer (Visible Everywhere Including Table)  */
  /* ------------------------------------------------------------------ */
  let trailInstance = null;
  const globalMouseParticles = [];

  function initCursorTrailFX() {
    if (trailInstance || typeof p5 === "undefined") return;

    let container = document.getElementById("cursor-trail-layer");
    if (!container) {
      container = document.createElement("div");
      container.id = "cursor-trail-layer";
      container.style.position = "fixed";
      container.style.inset = "0";
      container.style.pointerEvents = "none";
      container.style.zIndex = "9998";
      container.style.overflow = "hidden";
      document.body.appendChild(container);
    }

    let lastX = 0, lastY = 0;
    window.addEventListener(
      "pointermove",
      (e) => {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        const dist = Math.hypot(dx, dy);
        if (dist > 2.5 && globalMouseParticles.length < 50) {
          const colors = getThemeColors();
          const count = dist > 18 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            globalMouseParticles.push({
              x: e.clientX + (Math.random() - 0.5) * 5,
              y: e.clientY + (Math.random() - 0.5) * 5,
              vx: (Math.random() - 0.5) * 1.4,
              vy: (Math.random() - 0.5) * 1.4 - 0.25,
              size: 4 + Math.random() * 5.5,
              life: 1.0,
              decay: 0.038 + Math.random() * 0.02,
              type: colors.type,
              primary: colors.primary,
              secondary: colors.secondary,
              accent: colors.accent,
            });
          }
        }
      },
      { passive: true }
    );

    const sketch = (p) => {
      p.setup = () => {
        const c = p.createCanvas(p.windowWidth, p.windowHeight);
        c.parent(container);
        p.frameRate(40);
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        p.clear();
        for (let i = globalMouseParticles.length - 1; i >= 0; i--) {
          const mp = globalMouseParticles[i];
          mp.x += mp.vx;
          mp.y += mp.vy;
          mp.life -= mp.decay;
          mp.size *= 0.965;

          if (mp.life <= 0 || mp.size <= 0.6) {
            globalMouseParticles.splice(i, 1);
            continue;
          }

          p.noStroke();
          const alpha = Math.max(0, mp.life * 230);
          if (mp.type === "hearts") {
            p.fill(mp.secondary[0], mp.secondary[1], mp.secondary[2], alpha);
            drawMiniHeart(p, mp.x, mp.y, mp.size * 1.8);
          } else if (mp.type === "snow") {
            p.fill(255, 255, 255, alpha);
            p.circle(mp.x, mp.y, mp.size);
            p.stroke(mp.secondary[0], mp.secondary[1], mp.secondary[2], alpha * 0.55);
            p.strokeWeight(1);
            p.line(mp.x - mp.size * 1.5, mp.y, mp.x + mp.size * 1.5, mp.y);
            p.line(mp.x, mp.y - mp.size * 1.5, mp.x, mp.y + mp.size * 1.5);
          } else if (mp.type === "digital") {
            p.fill(mp.primary[0], mp.primary[1], mp.primary[2], alpha);
            p.rect(mp.x - mp.size * 0.5, mp.y - mp.size * 0.5, mp.size * 1.2, mp.size * 1.2, 1);
          } else if (mp.type === "embers") {
            p.fill(mp.accent[0], mp.accent[1], mp.accent[2], alpha);
            p.circle(mp.x, mp.y, mp.size);
          } else {
            p.fill(mp.secondary[0], mp.secondary[1], mp.secondary[2], alpha);
            p.circle(mp.x, mp.y, mp.size);
          }
        }
      };
    };

    trailInstance = new p5(sketch);
  }

  function drawMiniHeart(p, x, y, size) {
    p.push();
    p.translate(x, y);
    p.beginShape();
    p.vertex(0, -size / 4);
    p.bezierVertex(-size / 2, -size * 0.7, -size, -size * 0.1, 0, size * 0.6);
    p.bezierVertex(size, -size * 0.1, size / 2, -size * 0.7, 0, -size / 4);
    p.endShape(p.CLOSE);
    p.pop();
  }

  /* ------------------------------------------------------------------ */
  /* 2. Tabletop Interactive FX Overlay                                 */
  /* ------------------------------------------------------------------ */
  let tableOverlayInstance = null;
  const tableBursts = [];

  function attachTableOverlay(playmatEl) {
    if (!playmatEl || typeof p5 === "undefined") return;
    detachTableOverlay();

    const overlayDiv = document.createElement("div");
    overlayDiv.id = "table-fx-layer";
    overlayDiv.style.position = "absolute";
    overlayDiv.style.inset = "0";
    overlayDiv.style.pointerEvents = "none";
    overlayDiv.style.zIndex = "4";
    playmatEl.appendChild(overlayDiv);

    const sketch = (p) => {
      p.setup = () => {
        const rect = playmatEl.getBoundingClientRect();
        const c = p.createCanvas(rect.width || 800, rect.height || 600);
        c.parent(overlayDiv);
        if (c.elt) c.elt.style.pointerEvents = "none";
        p.frameRate(35);
      };

      p.windowResized = () => {
        const rect = playmatEl.getBoundingClientRect();
        p.resizeCanvas(rect.width || 800, rect.height || 600);
      };

      p.draw = () => {
        p.clear();
        for (let i = tableBursts.length - 1; i >= 0; i--) {
          const b = tableBursts[i];
          b.update(p);
          b.draw(p);
          if (b.dead) {
            tableBursts.splice(i, 1);
          }
        }
      };
    };

    tableOverlayInstance = new p5(sketch);
  }

  function detachTableOverlay() {
    if (tableOverlayInstance) {
      tableOverlayInstance.remove();
      tableOverlayInstance = null;
    }
    const el = document.getElementById("table-fx-layer");
    if (el) el.remove();
    tableBursts.length = 0;
  }

  /* FX Burst Types for Tabletop */
  class RippleBurst {
    constructor(x, y, r, g, b) {
      this.x = x;
      this.y = y;
      this.radius = 5;
      this.maxRadius = 75;
      this.alpha = 240;
      this.r = r || 215;
      this.g = g || 180;
      this.b = b || 92;
      this.dead = false;
    }
    update() {
      this.radius += 3.8;
      this.alpha -= 10;
      if (this.alpha <= 0 || this.radius >= this.maxRadius) this.dead = true;
    }
    draw(p) {
      p.noFill();
      p.stroke(this.r, this.g, this.b, this.alpha);
      p.strokeWeight(2.5);
      p.circle(this.x, this.y, this.radius * 2);
    }
  }

  class VictoryGoldShower {
    constructor(w, h, count = 55) {
      this.coins = [];
      this.dead = false;
      for (let i = 0; i < count; i++) {
        this.coins.push({
          x: Math.random() * w,
          y: -Math.random() * 200 - 20,
          vy: 4 + Math.random() * 6,
          vx: (Math.random() - 0.5) * 3,
          size: 14 + Math.random() * 10,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.25,
          color: Math.random() > 0.3 ? [250, 204, 21] : [245, 158, 11],
          bounces: 0,
        });
      }
    }
    update(p) {
      let aliveCount = 0;
      for (const c of this.coins) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.28; // gravity
        c.rot += c.vrot;

        if (c.y >= p.height - 30 && c.bounces < 2) {
          c.y = p.height - 30;
          c.vy = -c.vy * 0.45;
          c.vx *= 0.7;
          c.bounces++;
        }
        if (c.y < p.height + 50) aliveCount++;
      }
      if (aliveCount === 0) this.dead = true;
    }
    draw(p) {
      p.push();
      for (const c of this.coins) {
        if (c.y > p.height + 40) continue;
        p.push();
        p.translate(c.x, c.y);
        p.rotate(c.rot);
        p.noStroke();
        p.fill(c.color[0], c.color[1], c.color[2]);
        p.ellipse(0, 0, c.size, c.size * Math.abs(Math.sin(c.rot)));
        p.fill(255, 255, 255, 160);
        p.circle(-c.size * 0.2, -c.size * 0.15, c.size * 0.25);
        p.pop();
      }
      p.pop();
    }
  }

  function triggerTableRipple(x, y, color) {
    const rgb = color || [215, 180, 92];
    tableBursts.push(new RippleBurst(x, y, rgb[0], rgb[1], rgb[2]));
  }

  function triggerVictoryShower() {
    const playmatEl = document.querySelector(".playmat");
    if (!playmatEl) return;
    const rect = playmatEl.getBoundingClientRect();
    tableBursts.push(new VictoryGoldShower(rect.width, rect.height, 65));
  }

  /* ------------------------------------------------------------------ */
  /* 3. D&D Polyhedral 3D-Feel Dice Roller Animation Canvas             */
  /* ------------------------------------------------------------------ */
  function rollDnDDice(containerEl, diceType, finalResult, onComplete) {
    if (!containerEl || typeof p5 === "undefined") {
      onComplete && onComplete();
      return;
    }

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "dice-roll-canvas-wrap";
    canvasWrap.style.width = "100%";
    canvasWrap.style.height = "210px";
    canvasWrap.style.position = "relative";
    containerEl.innerHTML = "";
    containerEl.appendChild(canvasWrap);

    let diceInst = null;
    const sketch = (p) => {
      let x, y, vx, vy, rot, vrot;
      let settled = false;
      let timer = 0;
      const colors = getThemeColors();

      p.setup = () => {
        const c = p.createCanvas(canvasWrap.offsetWidth || 340, 210);
        c.parent(canvasWrap);
        p.frameRate(40);

        x = p.width * 0.2 + p.random(30);
        y = -40;
        vx = p.random(4.5, 7.5);
        vy = p.random(6, 9);
        rot = p.random(p.TWO_PI);
        vrot = p.random(0.18, 0.35);
      };

      p.draw = () => {
        p.clear();
        timer++;

        if (!settled) {
          x += vx;
          y += vy;
          vy += 0.8; // gravity
          rot += vrot;

          // Bounce on bottom floor
          if (y >= p.height - 48) {
            y = p.height - 48;
            vy = -vy * 0.55;
            vx *= 0.82;
            vrot *= 0.75;
            if (Math.abs(vy) < 1.2 && Math.abs(vx) < 0.8) {
              settled = true;
              onComplete && onComplete();
            }
          }
          // Bounce on walls
          if (x <= 40) {
            x = 40;
            vx = -vx * 0.7;
          }
          if (x >= p.width - 40) {
            x = p.width - 40;
            vx = -vx * 0.7;
          }

          if (timer > 50 && !settled) {
            settled = true;
            onComplete && onComplete();
          }
        }

        // Draw shadow
        p.noStroke();
        p.fill(0, 0, 0, 70);
        p.ellipse(x, p.height - 18, 48 * (1 - (p.height - 48 - y) * 0.003), 16);

        // Draw 3D Shaded Die
        p.push();
        p.translate(x, y);
        p.rotate(settled ? 0 : rot);

        const primary = colors.primary;
        const accent = colors.accent;
        const sides = parseInt(diceType.replace(/[^0-9]/g, ""), 10) || 20;

        // Draw polyhedral shape
        p.stroke(255, 255, 255, 140);
        p.strokeWeight(2);
        p.fill(primary[0], primary[1], primary[2]);

        if (sides === 4) {
          // Tetrahedron
          p.triangle(0, -32, -30, 26, 30, 26);
        } else if (sides === 6) {
          // Cube
          p.rect(-28, -28, 56, 56, 8);
        } else if (sides === 8) {
          // Octahedron
          p.beginShape();
          p.vertex(0, -34);
          p.vertex(28, 0);
          p.vertex(0, 34);
          p.vertex(-28, 0);
          p.endShape(p.CLOSE);
        } else if (sides === 10 || sides === 100) {
          // Kite decahedron
          p.beginShape();
          p.vertex(0, -35);
          p.vertex(26, -10);
          p.vertex(18, 30);
          p.vertex(-18, 30);
          p.vertex(-26, -10);
          p.endShape(p.CLOSE);
        } else if (sides === 12) {
          // Dodecagon
          drawRegularPolygon(p, 0, 0, 32, 5);
        } else {
          // D20 Icosahedron
          drawRegularPolygon(p, 0, 0, 34, 6);
        }

        // Facet inner shading highlight
        p.noStroke();
        p.fill(255, 255, 255, 50);
        p.triangle(0, -26, -20, 15, 20, 15);

        // Number on Die
        p.fill(255, 255, 255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(sides === 100 ? 18 : 22);
        p.textStyle(p.BOLD);
        p.text(settled ? finalResult : (p.floor(p.random(1, sides + 1))), 0, 1);

        p.pop();

        // Settled Aura / Crit explosion
        if (settled) {
          p.noFill();
          const isCrit = (sides === 20 && finalResult === 20);
          const isFumble = (sides === 20 && finalResult === 1);
          p.stroke(
            isCrit ? 250 : isFumble ? 239 : primary[0],
            isCrit ? 204 : isFumble ? 68 : primary[1],
            isCrit ? 21 : isFumble ? 68 : primary[2],
            180 + p.sin(timer * 0.2) * 60
          );
          p.strokeWeight(3);
          p.circle(x, y, 82 + p.sin(timer * 0.15) * 6);
        }
      };
    };

    function drawRegularPolygon(p, cx, cy, radius, npoints) {
      const angle = p.TWO_PI / npoints;
      p.beginShape();
      for (let a = -p.HALF_PI; a < p.TWO_PI - p.HALF_PI; a += angle) {
        const sx = cx + p.cos(a) * radius;
        const sy = cy + p.sin(a) * radius;
        p.vertex(sx, sy);
      }
      p.endShape(p.CLOSE);
    }

    diceInst = new p5(sketch);
  }

  function initAllFX() {
    initBackgroundFX();
    initCursorTrailFX();
  }

  // Auto initialize background and cursor trail FX when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllFX);
  } else {
    setTimeout(initAllFX, 60);
  }

  window.MTG_FX = {
    initBackgroundFX,
    initCursorTrailFX,
    attachTableOverlay,
    detachTableOverlay,
    triggerTableRipple,
    triggerVictoryShower,
    rollDnDDice,
  };
})();
