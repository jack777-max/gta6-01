// Everything the player sees: the city from the pre-rendered ground canvas,
// cars and people drawn as clean shapes with afternoon shadows, and the HUD —
// cash and health, wanted stars, a live minimap, the mission objective, the
// phone dialogue box — plus the title, pause, busted, wasted and
// mission-complete screens.

import { BEACH_X, FIELD, FONT, PALETTE, WATER_X, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let minimapBase = null;

  function fitView() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    return { w, h, scale, ox: (w - FIELD.width * scale) / 2, oy: (h - FIELD.height * scale) / 2 };
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(30,25,20,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 6, 27, 14, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(car.angle);
    // Body.
    ctx.fillStyle = car.wrecked ? '#5a5a5a' : car.color;
    roundRect(ctx, -23, -11, 46, 22, 7);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#eef1f5';
      roundRect(ctx, -8, -11, 17, 22, 3);
      ctx.fill();
      ctx.fillStyle = '#18222e';
      roundRect(ctx, -23, -11, 7, 22, 5);
      ctx.fill();
      roundRect(ctx, 12, -11, 11, 22, 5);
      ctx.fill();
    }
    // Cabin and glass.
    ctx.fillStyle = 'rgba(20,26,38,0.92)';
    roundRect(ctx, -7, -8.5, 15, 17, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.5)';
    roundRect(ctx, 6, -8, 4, 16, 2);
    ctx.fill();
    // Lights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(21, -8, 3, 5);
    ctx.fillRect(21, 3, 3, 5);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(-24, -8, 3, 5);
    ctx.fillRect(-24, 3, 3, 5);
    if (car.police) {
      const phase = Math.sin(time * 11 + car.lightPhase) > 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#3a86ff';
      roundRect(ctx, -4, -6, 9, 12, 3);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = phase ? '#ff3b30' : '#3a86ff';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(20,20,20,0.45)';
      roundRect(ctx, -23, -11, 46, 22, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(30,25,20,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 11, 7, 0, 0, TAU);
    ctx.fill();
    if (opts.down) ctx.rotate(Math.PI / 2);
    else ctx.rotate(angle);
    const step = opts.moving ? Math.sin(opts.time * 13) * 4 : 0;
    ctx.fillStyle = '#2d3142';
    ctx.fillRect(-3 + step * 0.4, -8, 5, 7);
    ctx.fillRect(-3 - step * 0.4, 1, 5, 7);
    ctx.fillStyle = shirt;
    roundRect(ctx, -6, -7.5, 13, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#e8b08a';
    ctx.beginPath();
    ctx.arc(1, 0, 5.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,20,16,0.85)';
    ctx.beginPath();
    ctx.arc(-0.5, 0, 5.2, Math.PI * 0.7, Math.PI * 1.7);
    ctx.fill();
    if (opts.gun) {
      ctx.fillStyle = '#14161c';
      ctx.fillRect(6, -1.6, 10, 3.2);
    }
    ctx.restore();
  }

  function drawWorld(world, camX, camY, time) {
    const g = world.city.ground;
    const gs = world.city.groundScale;
    ctx.drawImage(
      g,
      camX * gs, camY * gs, FIELD.width * gs, FIELD.height * gs,
      0, 0, FIELD.width, FIELD.height,
    );
    ctx.save();
    ctx.translate(-camX, -camY);

    // Cash pickups.
    for (const pk of world.pickups) {
      const bob = Math.sin(time * 5 + pk.x) * 2;
      ctx.fillStyle = '#2f9e44';
      roundRect(ctx, pk.x - 9, pk.y - 6 + bob, 18, 12, 3);
      ctx.fill();
      ctx.fillStyle = '#d3f9d8';
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 3 + bob);
    }
    // Tracers.
    for (const t of world.tracers) {
      ctx.strokeStyle = 'rgba(255,224,138,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    // Cars, then people, then the player.
    for (const car of world.cars) drawCar(car, time);
    for (const cop of world.police) drawCar(cop, time);
    for (const ped of world.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.color, { down: ped.down > 0, moving: ped.down <= 0, time: time + ped.x });
    }
    const p = world.player;
    if (!p.car) {
      drawPerson(p.x, p.y, p.angle, '#ff5d7e', { moving: p.moving, time, gun: p.hasGun });
    } else {
      // A soft ring marks the player's car among the traffic.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.car.x, p.car.y, 31, 20, p.car.angle, 0, TAU);
      ctx.stroke();
    }
    // Particles.
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBeacon(x, y, time, label) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    const grad = ctx.createLinearGradient(0, y - 250, 0, y);
    grad.addColorStop(0, 'rgba(255,197,61,0)');
    grad.addColorStop(1, 'rgba(255,197,61,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 13, y - 250, 26, 250);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 26 * pulse, 13 * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(x, y - 268 - Math.sin(time * 4) * 5);
    ctx.lineTo(x - 11, y - 288 - Math.sin(time * 4) * 5);
    ctx.lineTo(x + 11, y - 288 - Math.sin(time * 4) * 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    void label;
  }

  let cam = { x: 0, y: 0 };

  function drawMinimap(world, view) {
    const mw = 198;
    const mh = 148;
    const x0 = FIELD.width - mw - 14;
    const y0 = 14;
    if (!minimapBase) {
      minimapBase = document.createElement('canvas');
      minimapBase.width = mw;
      minimapBase.height = mh;
      const mctx = minimapBase.getContext('2d');
      mctx.fillStyle = '#157d99';
      mctx.fillRect(0, 0, mw, mh);
      mctx.drawImage(world.city.ground, 0, 0, mw, mh);
    }
    ctx.save();
    roundRect(ctx, x0 - 3, y0 - 3, mw + 6, mh + 6, 8);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, x0, y0, mw, mh, 6);
    ctx.clip();
    ctx.drawImage(minimapBase, x0, y0);
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    const blip = (x, y, color, size) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + x * sx, y0 + y * sy, size, 0, TAU);
      ctx.fill();
    };
    for (const cop of world.police) blip(cop.x, cop.y, '#3a86ff', 3);
    if (view.objective && view.objective.x !== undefined) {
      const pulse = 2.6 + Math.sin(view.time * 5) * 0.9;
      blip(view.objective.x, view.objective.y, PALETTE.gold, pulse + 1.6);
    }
    // Player arrow.
    const p = world.playerPos;
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(world.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('MARISOL BAY', x0 + 6, y0 + mh - 7);
    return { x0, y0, mw, mh };
  }

  function drawStars(world, x, y, time) {
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    const cooling = world.heatTimer > 16 && world.wanted > 0;
    for (let i = 0; i < 5; i += 1) {
      const active = i < world.wanted;
      const blink = cooling && Math.sin(time * 6) > 0;
      ctx.fillStyle = active ? (blink ? '#8d99ae' : '#ffc53d') : 'rgba(255,255,255,0.22)';
      ctx.fillText('★', x + i * 24, y);
    }
  }

  function drawHUD(world, view) {
    const p = world.player;
    // Cash + health, top-left.
    ctx.save();
    roundRect(ctx, 14, 14, 218, 62, 9);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 25px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 26, 52, 150, 10, 5);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#51cf66' : '#ff3b30';
    roundRect(ctx, 26, 52, 150 * Math.max(0, p.health / 100), 10, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(p.hasGun ? '🔫 pistol' : '👊 fists', 184, 61);
    ctx.restore();

    const mm = drawMinimap(world, view);
    drawStars(world, mm.x0 + 88, mm.y0 + mm.mh + 26, view.time);

    // Bust meter.
    if (p.bust > 0.02) {
      const w = 260;
      ctx.save();
      roundRect(ctx, FIELD.width / 2 - w / 2, 96, w, 26, 8);
      ctx.fillStyle = PALETTE.panel;
      ctx.fill();
      ctx.fillStyle = '#ff3b30';
      roundRect(ctx, FIELD.width / 2 - w / 2 + 4, 100, (w - 8) * Math.min(1, p.bust), 18, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED', FIELD.width / 2, 113);
      ctx.restore();
    }

    // Speed + car name.
    if (p.car) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 30px ${FONT}`;
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)}`, FIELD.width - 56, FIELD.height - 30);
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('km/h', FIELD.width - 14, FIELD.height - 30);
      ctx.fillText(`${p.car.model.name} · 📻 Solano FM`, FIELD.width - 14, FIELD.height - 56);
      ctx.restore();
    }

    // Objective banner.
    if (view.objective) {
      const o = view.objective;
      ctx.save();
      ctx.textAlign = 'center';
      const label = o.label + (o.dist !== undefined ? `  ·  ${Math.round(o.dist)} m` : '');
      ctx.font = `bold 19px ${FONT}`;
      const w = ctx.measureText(label).width + 44;
      roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height - 64, w, 40, 10);
      ctx.fillStyle = PALETTE.panel;
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('◆', FIELD.width / 2 - w / 2 + 24, FIELD.height - 36);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(label, FIELD.width / 2 + 12, FIELD.height - 36);
      if (o.timer !== null && o.timer !== undefined) {
        const frac = Math.max(0, o.timer / o.timerMax);
        ctx.fillStyle = o.timer < 15 ? '#ff3b30' : PALETTE.teal;
        roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height - 20, w * frac, 5, 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.text;
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillText(`${Math.ceil(o.timer)}s`, FIELD.width / 2 + w / 2 + 22, FIELD.height - 36);
      }
      if (o.sub) {
        ctx.font = `14px ${FONT}`;
        ctx.fillStyle = PALETTE.muted;
        ctx.fillText(o.sub, FIELD.width / 2, FIELD.height - 76);
      }
      ctx.restore();
    }

    // Dialogue phone box.
    if (view.dialogue) {
      ctx.save();
      const w = 470;
      const x = 14;
      const y = FIELD.height - 196;
      roundRect(ctx, x, y, w, 118, 12);
      ctx.fillStyle = 'rgba(10,12,24,0.88)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.teal;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`📱 ${view.dialogue.who}`, x + 16, y + 26);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `16px ${FONT}`;
      const lines = wrapText(ctx, view.dialogue.text, w - 32);
      lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, x + 16, y + 52 + i * 21));
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('Enter ▸', x + w - 14, y + 106);
      ctx.restore();
    }

    // Centre banner (mission passed, wanted up, and the like).
    if (view.banner) {
      const b = view.banner;
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.t * 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = b.color || PALETTE.gold;
      ctx.font = `bold 44px ${FONT}`;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.fillText(b.title, FIELD.width / 2, 190);
      if (b.sub) {
        ctx.font = `bold 20px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.fillText(b.sub, FIELD.width / 2, 224);
      }
      ctx.restore();
    }
  }

  function drawOverlayBase(world, view, tint) {
    drawWorld(world, cam.x, cam.y, view.time);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(world, view) {
    drawOverlayBase(world, view, 'rgba(20,16,40,0.42)');
    ctx.save();
    ctx.textAlign = 'center';
    const grad = ctx.createLinearGradient(0, 120, 0, 230);
    grad.addColorStop(0, '#ffe259');
    grad.addColorStop(0.55, '#ffa751');
    grad.addColorStop(1, '#ff5d7e');
    ctx.fillStyle = grad;
    ctx.font = `900 92px ${FONT}`;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.fillText('MARISOL', FIELD.width / 2, 196);
    ctx.fillText('NIGHTS', FIELD.width / 2, 288);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('An open-world crime story in Marisol Bay — steal cars, run jobs, outrun the MBPD.', FIELD.width / 2, 330);
    const items = view.menu || ['New Game'];
    ctx.font = `bold 25px ${FONT}`;
    items.forEach((item, i) => {
      const y = 408 + i * 46;
      if (i === view.menuIndex) {
        ctx.fillStyle = 'rgba(255,197,61,0.9)';
        roundRect(ctx, FIELD.width / 2 - 150, y - 30, 300, 40, 9);
        ctx.fill();
        ctx.fillStyle = '#232946';
      } else {
        ctx.fillStyle = PALETTE.text;
      }
      ctx.fillText(item, FIELD.width / 2, y);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText('WASD drive & walk · F enter car · J / click fight & shoot · Shift run · P pause', FIELD.width / 2, FIELD.height - 26);
    ctx.restore();
  }

  function drawHelp(world, view) {
    drawOverlayBase(world, view, 'rgba(10,10,22,0.72)');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('How to play', FIELD.width / 2, 130);
    ctx.font = `18px ${FONT}`;
    const lines = [
      'Walk and drive with WASD or the arrow keys. Hold Shift to run on foot.',
      'Press F (or E) beside any car to take it — parked, or rip a driver out of traffic.',
      'J or the mouse button: punch, or shoot once Delia leaves you a pistol. Aim with the mouse.',
      'Crimes raise your wanted stars. Police ram you and fill the BUSTED meter if you slow down.',
      'Lose them: break line of sight and stay clean until the stars cool away.',
      'Follow the gold beacon to your objective. Cash buys nothing but pride — and bail.',
      'Your game saves itself after every job. Continue from the title screen.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 196 + i * 38));
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText('Enter — back', FIELD.width / 2, 520);
    ctx.restore();
  }

  function drawEndScreen(world, view, title, color, lines) {
    drawOverlayBase(world, view, 'rgba(8,8,18,0.62)');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = `900 84px ${FONT}`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 16;
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 320 + i * 32));
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText('Enter — keep playing', FIELD.width / 2, 520);
    ctx.restore();
  }

  return {
    draw(view) {
      const { w, h, scale, ox, oy } = fitView();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d1020';
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      ctx.beginPath();
      ctx.rect(0, 0, FIELD.width, FIELD.height);
      ctx.clip();

      const world = view.world;
      const anchor = world.playerPos;
      // Camera: follow the player, look ahead a little at speed, stay in the world.
      const look = world.player.car ? Math.min(90, Math.abs(world.player.car.speed) * 0.3) : 0;
      const tx = anchor.x + (world.player.car ? Math.cos(world.player.car.angle) * look : 0) - FIELD.width / 2;
      const ty = anchor.y + (world.player.car ? Math.sin(world.player.car.angle) * look : 0) - FIELD.height / 2;
      cam.x += (Math.max(0, Math.min(WORLD.width - FIELD.width, tx)) - cam.x) * (view.snapCamera ? 1 : 0.18);
      cam.y += (Math.max(0, Math.min(WORLD.height - FIELD.height, ty)) - cam.y) * (view.snapCamera ? 1 : 0.18);
      if (view.camAt) { cam.x = view.camAt.x; cam.y = view.camAt.y; }

      switch (view.screen) {
        case SCREEN_TITLE:
          drawTitle(world, view);
          break;
        case SCREEN_HELP:
          drawHelp(world, view);
          break;
        case SCREEN_BUSTED:
          drawEndScreen(world, view, 'BUSTED', '#3a86ff', view.endLines || []);
          break;
        case SCREEN_WASTED:
          drawEndScreen(world, view, 'WASTED', '#ff3b30', view.endLines || []);
          break;
        case SCREEN_COMPLETE:
          drawEndScreen(world, view, 'STORY COMPLETE', PALETTE.gold, view.endLines || []);
          break;
        case SCREEN_PAUSED:
          drawWorld(world, cam.x, cam.y, view.time);
          if (view.objective && view.objective.x !== undefined) drawBeacon(view.objective.x, view.objective.y, view.time);
          drawHUD(world, view);
          ctx.fillStyle = 'rgba(10,10,22,0.55)';
          ctx.fillRect(0, 0, FIELD.width, FIELD.height);
          ctx.fillStyle = PALETTE.text;
          ctx.font = `bold 40px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2);
          break;
        default:
          drawWorld(world, cam.x, cam.y, view.time);
          if (view.objective && view.objective.x !== undefined) drawBeacon(view.objective.x, view.objective.y, view.time);
          drawHUD(world, view);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    /** Convert a mouse position in page pixels to world coordinates. */
    toWorld(view, mx, my) {
      const { scale, ox, oy } = fitView();
      return { x: (mx - ox) / scale + cam.x, y: (my - oy) / scale + cam.y };
    },
  };
}
