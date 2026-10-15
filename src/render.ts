import * as C from "./constants";
import {
  type ReadState,
  tile,
  buildings,
  maxFuel,
  maxHull,
  slots,
  loadKg,
  depth,
  scanner,
} from "./model";
import { controls, menuItems, menuRect, inventoryInfo } from "./ui";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
export const BACKGROUND = "#0b1721";
const gold = "#edc27a",
  mint = "#91d5c5",
  white = "#e2e9df",
  muted = "#829aa2";
function text(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = white,
  font = "monospace",
) {
  ctx.fillStyle = color;
  ctx.font =
    font === "display" ? `800 ${size}px sans-serif` : `${size}px ${font}`;
  ctx.fillText(t, x, y);
}
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color = "#112631",
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#34515a";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function supplyGlyph(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 2;
  const n = C.ITEM_IDS.indexOf(id as C.ItemId);
  if (n < 2) {
    for (let k = 0; k < n + 2; k++) ctx.fillRect(k * 5, 5, 3, 17);
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.quadraticCurveTo(8, -3, 15, 1);
    ctx.stroke();
  } else if (n < 4) {
    ctx.beginPath();
    ctx.arc(11, 12, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, 2);
    ctx.lineTo(16, 12);
    ctx.lineTo(11, 22);
    ctx.lineTo(6, 12);
    ctx.closePath();
    ctx.fill();
  } else if (n === 4) {
    ctx.fillRect(8, 2, 6, 20);
    ctx.fillRect(1, 9, 20, 6);
  } else {
    ctx.fillRect(3, 5, 17, 18);
    ctx.fillStyle = "#1b323d";
    ctx.fillRect(7, 9, 9, 5);
    ctx.fillStyle = gold;
    ctx.fillRect(8, 1, 7, 5);
  }
  ctx.restore();
}
function image(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const img = s.images[key];
  if (img) ctx.drawImage(img, x, y, w, h);
}
export function drawWorld(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  title = false,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, C.HUD_H, C.VIEW_W, C.VIEW_H);
  ctx.clip();
  const camX = title ? 960 : s.camX,
    camY = title ? 15 * C.TILE : s.camY;
  const jitter = s.shake;
  ctx.translate(
    -camX + Math.sin(s.elapsedSeconds * 107) * jitter,
    -camY + C.HUD_H + Math.cos(s.elapsedSeconds * 83) * jitter,
  );
  if (camY < C.SURFACE_Y) {
    ctx.fillStyle = "#0d222f";
    ctx.fillRect(camX, camY, C.VIEW_W, C.SURFACE_Y - camY);
    image(s, ctx, "surface/sky", camX * 0.7, -440, 1280, 520);
    for (let c = 0; c < 32; c++)
      image(s, ctx, "surface/ground", c * C.TILE, C.SURFACE_Y - 3, C.TILE, 24);
    for (const b of buildings) {
      image(s, ctx, "surface/" + b.id, b.x, b.y, b.w, b.h);
      text(
        ctx,
        b.id.replace(/-/g, " ").toUpperCase(),
        b.x + 4,
        b.y - 12,
        12,
        mint,
      );
      if (b.id === "launch-pad")
        image(
          s,
          ctx,
          `rocket/stage${s.installed}`,
          b.x + 50,
          b.y + 16 - (s.launchTime ?? 0) ** 2 * 85,
          160,
          160,
        );
    }
    image(
      s,
      ctx,
      "surface/cave-mouth",
      C.CAVE_MOUTH_COL * C.TILE,
      C.SURFACE_Y - 35,
      80,
      80,
    );
    text(
      ctx,
      "MINE ACCESS ↓",
      C.CAVE_MOUTH_COL * C.TILE - 25,
      C.SURFACE_Y - 55,
      13,
      gold,
    );
  }
  const startR = Math.max(1, Math.floor(camY / C.TILE)),
    endR = Math.min(s.coreRow, Math.ceil((camY + C.VIEW_H) / C.TILE));
  for (let r = startR; r <= endR; r++)
    for (
      let c = Math.max(0, Math.floor(camX / C.TILE));
      c <= Math.min(31, Math.ceil((camX + C.VIEW_W) / C.TILE));
      c++
    ) {
      let t = tile(s, c, r);
      if (title) {
        const tunnel =
          c === 22 ||
          (r === 18 && c > 19 && c < 27) ||
          (r === 16 && c > 21 && c < 29);
        t = {
          ...t,
          band: "rockbed",
          kind: tunnel ? "tunnel" : (c * 7 + r * 13) % 11 < 3 ? "ore" : "rock",
          ore: (c + r) % 2 ? "cuprite" : "cobaltine",
        };
      }
      const x = c * C.TILE,
        y = r * C.TILE,
        b = t.band ?? "coreshell",
        variant = Math.abs(c * 17 + r * 31) % C.TILE_VARIANTS;
      image(s, ctx, `tiles/${b}-${variant}`, x, y, C.TILE, C.TILE);
      if (t.kind === "tunnel" || t.kind === "lava") {
        const previewOpen = (cc: number, rr: number) =>
          cc === 22 ||
          (rr === 18 && cc > 19 && cc < 27) ||
          (rr === 16 && cc > 21 && cc < 29);
        const same = (dc: number, dr: number) =>
          title
            ? previewOpen(c + dc, r + dr)
            : tile(s, c + dc, r + dr).kind === t.kind;
        const l = same(-1, 0) ? 0 : 7,
          rt = same(1, 0) ? 0 : 7,
          up = same(0, -1) ? 0 : 7,
          down = same(0, 1) ? 0 : 7;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + l, y + up, C.TILE - l - rt, C.TILE - up - down, [
          l && up ? 12 : 0,
          rt && up ? 12 : 0,
          rt && down ? 12 : 0,
          l && down ? 12 : 0,
        ]);
        ctx.clip();
        image(
          s,
          ctx,
          t.kind === "lava"
            ? `hazards/lava/frame0${Math.floor((title ? s.simTime : s.elapsedSeconds) * 5) % 3}`
            : "tiles/tunnel",
          x,
          y,
          C.TILE,
          C.TILE,
        );
        ctx.restore();
        for (const [dc, dr] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          if (same(dc, 0) && same(0, dr) && !same(dc, dr)) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(
              x + (dc > 0 ? 80 : 0),
              y + (dr > 0 ? 80 : 0),
              9,
              0,
              Math.PI * 2,
            );
            ctx.clip();
            image(s, ctx, `tiles/${b}-${variant}`, x, y, 80, 80);
            ctx.restore();
          }
        }
      } else if (t.kind === "bedrock")
        image(s, ctx, "tiles/bedrock", x, y, C.TILE, C.TILE);
      else if (t.kind === "stone")
        image(s, ctx, `tiles/stone-${variant % 2}`, x, y, C.TILE, C.TILE);
      else if (t.kind === "core")
        image(s, ctx, "materials/core", x, y, C.TILE, C.TILE);
      else if (t.kind === "ore" && t.ore)
        image(s, ctx, "ore/" + t.ore, x, y, C.TILE, C.TILE);
      else if (t.material)
        image(s, ctx, "materials/" + t.material, x, y, C.TILE, C.TILE);
      if (t.health !== null && t.maxHealth && t.health < t.maxHealth)
        image(
          s,
          ctx,
          `tiles/crack/frame0${Math.min(3, Math.floor((1 - t.health / t.maxHealth) * C.CRACK_FRAMES))}`,
          x,
          y,
          C.TILE,
          C.TILE,
        );
      ctx.strokeStyle = "#101a202b";
      ctx.strokeRect(x, y, C.TILE, C.TILE);
    }
  if (s.coreGround) {
    image(
      s,
      ctx,
      "materials/core-sample",
      s.coreGround.col * C.TILE,
      s.coreGround.row * C.TILE,
      80,
      80,
    );
    text(
      ctx,
      `${Math.ceil(s.coreTimer ?? 0)}s`,
      s.coreGround.col * C.TILE,
      s.coreGround.row * C.TILE,
      22,
      gold,
    );
  }
  if (s.launchTime === null) {
    const x = title ? 22 * C.TILE + 10 : s.x - 12,
      y = title ? 17 * C.TILE + 8 : s.y - 8,
      anim = title ? "drill-down" : s.anim;
    const count = {
      idle: 2,
      walk: 4,
      "drill-down": 3,
      "drill-side": 3,
      jetpack: 3,
      fall: 2,
      hurt: 2,
      "fuel-out": 2,
    }[anim];
    ctx.save();
    ctx.translate(x + 40, y);
    if (s.facing === "west" && !title) ctx.scale(-1, 1);
    image(
      s,
      ctx,
      `miner/${anim}/frame0${anim === "hurt" ? Math.min(count - 1, Math.floor(s.animTime * C.ANIM_FPS)) : Math.floor((title ? s.simTime : s.animTime) * C.ANIM_FPS) % count}`,
      -40,
      0,
      80,
      80,
    );
    ctx.restore();
  }
  for (const fx of s.fx) {
    const source = s.effectsData[fx.name];
    if (!source) continue;
    const system = fx.tint
      ? {
          ...source,
          emitters: source.emitters.map((e) => ({
            ...e,
            particle: {
              ...e.particle,
              colorGradient: [
                { color: fx.tint ?? gold, at: 0 },
                { color: "#435463", at: 1 },
              ],
            },
          })),
        }
      : source;
    ctx.save();
    ctx.translate(fx.x - 128, fx.y - 128); // The produced field is 256 square; preserve the engine's canvas and transform.
    const proxy = new Proxy(ctx, {
      get(target, key) {
        if (key === "canvas") return { width: 256, height: 256 };
        const v = Reflect.get(target, key, target) as unknown;
        return typeof v === "function" ? v.bind(target) : v;
      },
      set(target, key, value) {
        return Reflect.set(target, key, value, target);
      },
    });
    ctx.globalAlpha = 0;
    const player = new ParticleCanvasPlayer(
      system as import("@clockwyrks/particle-runtime").ParticleSystem,
      proxy,
      { seed: fx.seed, pixelRadius: 3, clear: false },
    );
    ctx.globalAlpha = 1;
    let remaining = fx.age * 1000;
    while (remaining > 0) {
      const step = Math.min(remaining, 1000 / 30);
      player.simulator.step(step);
      remaining -= step;
    }
    player.update(0);
    ctx.restore();
  }
  ctx.restore();
  // Soft visor vignette leaves produced textures visible.
  if (!title) {
    const light = ctx.createRadialGradient(640, 370, 150, 640, 370, 780);
    light.addColorStop(0, "#06101800");
    light.addColorStop(1, "#030b1466");
    ctx.fillStyle = light;
    ctx.fillRect(0, C.HUD_H, C.VIEW_W, C.VIEW_H);
  }
}
function hud(s: ReadState, ctx: CanvasRenderingContext2D) {
  panel(ctx, 0, 0, 1280, C.HUD_H, "#101f29");
  const gauge = (
    x: number,
    label: string,
    value: number,
    max: number,
    key: string,
    color: string,
  ) => {
    image(s, ctx, "icons/" + key, x, 15, 24, 24);
    text(ctx, label, x + 33, 20, 10, muted);
    text(
      ctx,
      `${Math.ceil(value)} / ${max}`,
      x + 33,
      38,
      13,
      value / max < 0.2 ? "#ff9c77" : white,
    );
    ctx.fillStyle = "#253c46";
    ctx.fillRect(x + 115, 19, 70, 15);
    ctx.fillStyle = color;
    ctx.fillRect(x + 115, 19, 70 * Math.min(1, value / max), 15);
  };
  gauge(18, "FUEL", s.fuel, maxFuel(s), "fuel", gold);
  gauge(220, "HULL", s.hull, maxHull(s), "hull", mint);
  image(s, ctx, "icons/cargo", 427, 15, 24, 24);
  text(ctx, "CARGO", 460, 20, 10, muted);
  text(
    ctx,
    `${slots(s)}/${C.CARGO_TIERS[s.tiers.cargo - 1]} · ${loadKg(s)}kg`,
    460,
    38,
    13,
  );
  image(s, ctx, "icons/credits", 605, 15, 24, 24);
  text(ctx, "CREDITS", 638, 20, 10, muted);
  text(ctx, s.credits.toFixed(0), 638, 38, 14, gold);
  image(s, ctx, "icons/depth", 745, 15, 24, 24);
  text(ctx, "DEPTH", 778, 20, 10, muted);
  text(ctx, `${Math.floor(depth(s))}m`, 778, 38, 14);
  image(s, ctx, "icons/resonite", 875, 16, 24, 24);
  text(ctx, String(s.satchel.resonite), 902, 33, 13, mint);
  image(s, ctx, "icons/cryenite", 933, 16, 24, 24);
  text(ctx, String(s.satchel.cryenite), 961, 33, 13, mint);
  for (const c of controls(s).filter((c) => c.rect.y < 56)) {
    panel(ctx, c.rect.x, c.rect.y, c.rect.w, c.rect.h, "#1b323d");
    text(ctx, c.label, c.rect.x + 6, 32, 10, mint);
  }
}
export function render(s: ReadState, ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = false;
  if (
    s.screen === "in-mine" ||
    s.screen === "paused" ||
    s.screen === "victory" ||
    s.screen === "game-over"
  ) {
    drawWorld(s, ctx);
    hud(s, ctx);
  } else drawWorld(s, ctx, true);
  if (s.screen === "in-mine") {
    const band =
      C.BANDS[
        Math.min(
          3,
          Math.floor(4 * Math.max(0, (s.y / 80 - 1) / (s.coreRow - 1))),
        )
      ];
    panel(ctx, 24, 76, 216, 48, "#10232be8");
    text(
      ctx,
      "STRATUM / " + String(C.BANDS.indexOf(band) + 1).padStart(2, "0"),
      38,
      94,
      10,
      muted,
    );
    text(ctx, band.toUpperCase(), 38, 113, 15, mint);
    const lock = scanner(s);
    if (lock.locked)
      text(
        ctx,
        `⌖ ${lock.target?.toUpperCase()}  ${lock.distanceTiles?.toFixed(1)} tiles ${lock.dirY > 0 ? "↓" : "↑"}`,
        430,
        92,
        16,
        mint,
      );
    if (lock.locked) {
      ctx.save();
      ctx.translate(790, 86);
      ctx.rotate(Math.atan2(lock.dirY, lock.dirX));
      ctx.strokeStyle = mint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.lineTo(8, -6);
      ctx.moveTo(15, 0);
      ctx.lineTo(8, 6);
      ctx.stroke();
      ctx.restore();
    }
    if (s.coreTimer !== null) {
      panel(ctx, 455, 111, 370, 59, "#421f2e");
      text(
        ctx,
        `CORE UNSTABLE   ${s.coreTimer.toFixed(1)}s`,
        476,
        137,
        20,
        gold,
      );
      text(ctx, "J · JETTISON       RETURN TO LAUNCH PAD", 477, 157, 11);
    }
    if (loadKg(s) >= C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg)
      text(ctx, C.OVERLOAD + " — I TO DROP CARGO", 450, 190, 20, "#ff9f78");
    if (s.noteTime > 0) {
      panel(ctx, 310, 646, 660, 44, "#142d37ed");
      text(ctx, s.note, 331, 674, 15, gold);
    }
    if (!s.panel) {
      text(
        ctx,
        "A D  MOVE / DRILL     S  BORE DOWN     W / SPACE  THRUST     I  CARGO",
        27,
        704,
        12,
        muted,
      );
      for (const b of buildings)
        if (
          Math.abs(s.x + 28 - (b.x + b.w / 2)) < b.w / 2 + 25 &&
          s.y < 80 &&
          s.y > -100
        ) {
          panel(ctx, 465, 580, 350, 46, "#152c37ef");
          text(
            ctx,
            `E · ${b.id.replace(/-/g, " ").toUpperCase()}`,
            485,
            609,
            16,
            gold,
          );
        }
    }
    if (s.notice && s.notice.age >= C.NOTICE_DELAY) {
      ctx.save();
      ctx.globalAlpha = Math.min(
        1,
        C.NOTICE_DELAY + C.NOTICE_FADE - s.notice.age,
      );
      panel(ctx, 850, 550, 400, 125, "#263b43");
      text(
        ctx,
        s.notice.hazard === "gas" ? "PRESSURE POCKET" : "MOLTEN SEAM",
        872,
        579,
        18,
        gold,
      );
      text(
        ctx,
        s.notice.hazard === "gas"
          ? "Watch for pale gas seeping from rock."
          : "Lava drains hull. Upgrade the radiator.",
        872,
        610,
        13,
      );
      text(ctx, "Click to dismiss", 872, 650, 12, muted);
      ctx.restore();
    }
    if (s.panel) {
      ctx.fillStyle = "#040f18bb";
      ctx.fillRect(0, 56, 1280, 664);
      panel(ctx, 200, 100, 880, 555, "#102630f5");
      text(ctx, s.panel.replace(/-/g, " ").toUpperCase(), 240, 146, 29, white);
      text(
        ctx,
        s.panel === "inventory"
          ? inventoryInfo(s)
          : `${s.credits.toFixed(0)} CREDITS   /   ${s.panel === "launch-pad" ? s.installed + " OF 5 COMPONENTS" : "SURFACE SERVICES"}`,
        240,
        173,
        12,
        mint,
      );
      text(ctx, "ESC / I  CLOSE", 890, 140, 12, muted);
      if (s.panel === "inventory")
        text(
          ctx,
          `SATCHEL   Resonite ${s.satchel.resonite}   Cryenite ${s.satchel.cryenite}   Sample ${s.satchel.coreSample ? "LIVE" : "—"}`,
          240,
          632,
          12,
          mint,
        );
      for (const [i, c] of controls(s)
        .filter((c) => c.rect.y > 56 && c.action !== "dismiss-notice")
        .entries()) {
        panel(
          ctx,
          c.rect.x,
          c.rect.y,
          c.rect.w,
          c.rect.h,
          i === s.panelIndex ? "#294953" : "#182f39",
        );
        text(
          ctx,
          c.label,
          c.rect.x +
            (c.action === "buy-item" || c.action === "use-item" ? 49 : 15),
          c.rect.y + 28,
          c.rect.w < 500 ? 12 : 15,
          c.enabled ? white : "#6b828b",
        );
        if ((c.action === "buy-item" || c.action === "use-item") && c.subject)
          supplyGlyph(ctx, c.subject, c.rect.x + 13, c.rect.y + 9);
        ctx.textAlign = "right";
        text(
          ctx,
          c.detail,
          c.rect.x + c.rect.w - 15,
          c.rect.y + 28,
          c.rect.w < 500 ? 10 : 12,
          c.enabled ? gold : "#6b828b",
        );
        ctx.textAlign = "left";
      }
      if (s.panel === "launch-pad") {
        for (const [i, p] of C.ROCKET_COMPONENTS.entries())
          text(
            ctx,
            `${i < s.installed ? "✓" : "○"}  ${p.name}   ${p.credits} CR${p.material ? " + " + p.material : ""}`,
            250,
            310 + i * 45,
            16,
            i < s.installed ? mint : muted,
          );
      }
      if (s.panel === "ore-market") {
        let i = 0;
        for (const m of C.MINERALS)
          if (s.cargo[m.id]) {
            image(s, ctx, "ore/" + m.id, 244, 260 + i * 25, 24, 24);
            text(
              ctx,
              `${m.name} × ${s.cargo[m.id]}     ${m.value} CR each`,
              280,
              278 + i * 25,
              14,
            );
            i++;
          }
      }
    }
    return;
  }
  // Editorial title composition: typography left, live mine cross-section right.
  ctx.fillStyle = "#081823eF";
  ctx.fillRect(0, 56, 570, 664);
  const fade = ctx.createLinearGradient(570, 0, 850, 0);
  fade.addColorStop(0, "#081823ef");
  fade.addColorStop(1, "#08182300");
  ctx.fillStyle = fade;
  ctx.fillRect(570, 56, 280, 664);
  text(ctx, "D E E P C O R E   /   EXPEDITION CONTROL", 92, 110, 12, mint);
  ctx.fillStyle = gold;
  ctx.fillRect(92, 136, 45, 3);
  const title =
    s.screen === "title"
      ? C.TITLE_TEXT
      : s.screen === "mode-select"
        ? "CHOOSE YOUR"
        : s.screen === "size-select"
          ? "HOW DEEP?"
          : s.screen === "how-to-play"
            ? "THE WAY OUT"
            : s.screen === "paused"
              ? "ON HOLD"
              : s.screen === "victory"
                ? "LIFTOFF."
                : "SIGNAL LOST";
  text(ctx, title, 86, 233, s.screen === "title" ? 78 : 52, white, "display");
  if (s.screen === "mode-select")
    text(ctx, "STAKES.", 88, 292, 52, gold, "display");
  const lines =
    s.screen === "title"
      ? [
          "A dead world. A loaded cargo bay.",
          "One way home — through the Core.",
        ]
      : s.screen === "mode-select"
        ? [
            "STANDARD · Restore the last save after death.",
            "HARDCORE · Death deletes your save.",
          ]
        : s.screen === "size-select"
          ? [
              "Quick · 1,250m   Standard · 2,500m",
              "Marathon · 5,000m. A longer descent.",
            ]
          : s.screen === "paused"
            ? ["The mine can wait. Your way home is above."]
            : s.screen === "how-to-play"
              ? [
                  "Dig. Sell. Upgrade. Build an escape rocket.",
                  "The deepest riches weigh the most.",
                ]
              : s.summary
                ? [
                    `${Math.floor(s.summary.deepestDepthMeters)}m reached · ${s.summary.creditsEarned} CR earned`,
                    `${Math.floor(s.summary.elapsedSeconds / 60)}m ${Math.floor(s.summary.elapsedSeconds % 60)}s · ${s.summary.componentsInstalled}/5 rocket parts`,
                    s.summary.deathCause ??
                      "The planet falls away beneath you.",
                  ]
                : [];
  lines.forEach((line, i) =>
    text(
      ctx,
      line,
      92,
      (s.screen === "mode-select" ? 330 : 287) + i * 25,
      14,
      i === 0 ? mint : muted,
    ),
  );
  const items = menuItems(s);
  for (const [i, item] of items.entries()) {
    const r = menuRect(i);
    panel(ctx, r.x, r.y, r.w, r.h, i === s.menuIndex ? "#d8bc83" : "#15303b");
    text(
      ctx,
      `${i === s.menuIndex ? "›" : " "}  ${item}`,
      r.x + 20,
      r.y + 33,
      16,
      i === s.menuIndex ? "#112632" : white,
    );
    ctx.textAlign = "right";
    text(
      ctx,
      String(i + 1).padStart(2, "0"),
      r.x + r.w - 18,
      r.y + 31,
      12,
      i === s.menuIndex ? "#41534e" : muted,
    );
    ctx.textAlign = "left";
  }
  if (s.screen === "how-to-play") {
    panel(ctx, 590, 180, 645, 435, "#102630f5");
    const help = [
      [
        "01 / CUT YOUR OWN ROUTE",
        "A / D walks and cuts walls. S drills down. Never up.",
      ],
      [
        "02 / THE CLIMB COSTS",
        "W / SPACE fires the jetpack. Save fuel for the return.",
      ],
      [
        "03 / LIGHTEN THE LOAD",
        "Cargo has slots AND weight. I opens inventory to drop ore.",
      ],
      [
        "04 / INVEST IN AN EXIT",
        "E opens services. Sell ore, refuel, repair, buy upgrades.",
      ],
      [
        "05 / READ THE ROCK",
        "Gas seeps. Lava burns. Hull and radiator help you survive.",
      ],
      [
        "06 / FIND WHAT THE ROCKET NEEDS",
        "Buy a scanner. Find Resonite, Cryenite, and a Core Sample.",
      ],
      [
        "07 / MAKE IT HOME",
        "The Sample lasts 90s. Install five parts. Launch to escape.",
      ],
      [
        "08 / BANK YOUR PROGRESS",
        "Use the Save Pad. Standard restores; Hardcore death deletes.",
      ],
    ];
    help.forEach(([head, line], i) => {
      text(ctx, head, 614, 211 + i * 49, 12, gold);
      text(ctx, line, 614, 230 + i * 49, 12, white);
    });
  }
  text(ctx, "DEPTH IS CHEAP. HEIGHT IS EXPENSIVE.", 92, 665, 11, gold);
  text(ctx, "↑ ↓  SELECT     ENTER  CONFIRM     M  SOUND", 92, 693, 10, muted);
  panel(ctx, 956, 88, 278, 68, "#10252ddc");
  text(ctx, "THE RETURN IS THE GAMBLE", 974, 114, 12, gold);
  text(ctx, "ORE → UPGRADES → ESCAPE", 974, 139, 13, mint);
  text(ctx, "01 / SUBSURFACE OPERATIONS", 866, 674, 12, white);
}
