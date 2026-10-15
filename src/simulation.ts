import * as C from "./constants";
import {
  type DeepcoreState,
  type ReadState,
  cell,
  tile,
  put,
  copy,
  slots,
  loadKg,
  mineralTint,
  maxFuel,
  maxHull,
  depth,
  pos,
  grounded,
  effect,
  cue,
  note,
  save,
  clearSave,
} from "./model";
export function end(s: DeepcoreState, cause: C.DeathCause | null) {
  s.screen = cause ? "game-over" : "victory";
  if (cause) {
    s.anim = cause === "fuel-out" ? "fuel-out" : "hurt";
    s.animTime = 0;
    s.drilling = null;
  }
  s.menuIndex = 0;
  s.panel = null;
  s.coreTimer = null;
  s.coreGround = null;
  s.satchel.coreSample = false;
  s.summary = {
    deepestDepthMeters: s.deepestDepthMeters,
    creditsEarned: s.creditsEarned,
    elapsedSeconds: s.elapsedSeconds,
    mode: s.mode,
    componentsInstalled: s.installed,
    deathCause: cause,
  };
  if (!cause || s.mode === "hardcore") {
    clearSave();
    s.hasSave = false;
  }
  effect(s, cause ? "death-burst" : "launch-exhaust");
  if (cause) cue(s, C.CUES.death);
}
export function hurt(s: DeepcoreState, amount: number) {
  s.hull = Math.max(0, s.hull - amount);
  s.hurt = C.HURT_TIME;
  if (s.hull <= 0 && s.screen === "in-mine") end(s, "hull-destroyed");
}
export function gas(s: DeepcoreState, c: number, r: number) {
  effect(s, "gas-explosion", c * C.TILE + 40, r * C.TILE + 40);
  cue(s, C.CUES.gasExplosion);
  s.shake = 18;
  s.blastTime = 0.2;
  const dx = s.x + 28 - c * C.TILE - 40,
    dy = s.y + 36 - r * C.TILE - 40;
  if (Math.hypot(dx, dy) <= C.GAS_BLAST_TILES * C.TILE) {
    const f = (r - 1) / (s.coreRow - 1);
    hurt(
      s,
      C.GAS_DAMAGE_MIN +
        (C.GAS_DAMAGE_MAX - C.GAS_DAMAGE_MIN) * Math.max(0, (f - 0.25) / 0.75),
    );
    if (s.travel) {
      const d = Math.hypot(dx, dy) || 1;
      s.vx = (dx / d) * C.GAS_KNOCKBACK;
      s.vy = (dy / d) * C.GAS_KNOCKBACK;
    }
    notice(s, "gas");
  }
}
function notice(s: DeepcoreState, hazard: C.NoticeHazard) {
  if (!s.noticesFired[hazard]) {
    s.noticesFired[hazard] = true;
    s.notice = { hazard, age: 0 };
  }
}
export function transaction(
  s: DeepcoreState,
  action: string,
  subject: string | null = null,
) {
  if (action === "sell") {
    const value = C.MINERALS.reduce(
      (v, m) => v + (s.cargo[m.id] ?? 0) * m.value,
      0,
    );
    s.cargo = {};
    s.credits += value;
    s.creditsEarned += value;
    note(s, `Cargo sold · +${value} Credits`);
    cue(s, C.CUES.orePickup);
  } else if (
    ["buy-fuel", "fill-fuel", "buy-repair", "repair-full"].includes(action)
  ) {
    const fuel = action.includes("fuel"),
      price = fuel ? C.FUEL_PRICE : C.REPAIR_PRICE;
    const missing = fuel ? maxFuel(s) - s.fuel : maxHull(s) - s.hull;
    const increment =
      action === "buy-fuel"
        ? C.FUEL_BUY_INCREMENT
        : action === "buy-repair"
          ? C.REPAIR_BUY_INCREMENT
          : Infinity;
    const amount = Math.max(0, Math.min(missing, increment, s.credits / price));
    s.credits -= amount * price;
    if (fuel) s.fuel += amount;
    else s.hull += amount;
    note(
      s,
      amount
        ? `${fuel ? "Fuel" : "Hull"} replenished`
        : "Insufficient Credits or already full",
    );
    if (amount) cue(s, C.CUES.fabricate);
  } else if (action === "buy-upgrade") {
    const track = subject as C.TrackName;
    if (!C.TRACKS.includes(track)) throw Error("Unknown upgrade");
    const tier = s.tiers[track],
      price = C.UPGRADE_PRICES[tier - 1];
    if (tier >= C.MAX_TIER[track] || s.credits < price) {
      note(s, "Upgrade unavailable");
      return;
    }
    const f = maxFuel(s),
      h = maxHull(s);
    s.credits -= price;
    s.tiers[track]++;
    s.fuel += maxFuel(s) - f;
    s.hull += maxHull(s) - h;
    cue(s, C.CUES.fabricate);
    note(s, `${track.toUpperCase()} upgraded to tier ${tier + 1}`);
  } else if (action === "buy-item") {
    const item = C.ITEMS.find((i) => i.id === subject);
    if (!item) throw Error("Unknown supply");
    if (s.credits < item.price) {
      note(s, "Insufficient Credits");
      return;
    }
    s.credits -= item.price;
    s.items[item.id]++;
    cue(s, C.CUES.fabricate);
  } else if (action === "use-item") useItem(s, subject as C.ItemId);
  else if (action === "drop-ore") {
    if (!C.MINERALS.some((m) => m.id === subject)) throw Error("Unknown ore");
    const ore = subject as C.OreId;
    s.cargo[ore] = Math.max(0, (s.cargo[ore] ?? 0) - 1);
  } else if (action === "jettison") {
    if (!s.satchel.coreSample) return;
    s.satchel.coreSample = false;
    s.coreGround = pos(s);
    note(s, "Sample jettisoned. Move clear of the blast.");
  } else if (action === "fabricate") {
    const part = C.ROCKET_COMPONENTS[s.installed];
    if (!part) return;
    if (
      s.credits < part.credits ||
      (part.material === "core-sample"
        ? !s.satchel.coreSample
        : part.material
          ? !s.satchel[part.material]
          : false)
    ) {
      note(s, "Missing Credits or required material");
      return;
    }
    s.credits -= part.credits;
    if (part.material === "core-sample") {
      s.satchel.coreSample = false;
      s.coreTimer = null;
    } else if (part.material) s.satchel[part.material]--;
    s.installed++;
    cue(s, C.CUES.fabricate);
    note(s, `${part.name} installed`);
  } else if (action === "launch") {
    if (s.installed === C.ROCKET_COMPONENTS.length) {
      s.launchTime = 0;
      s.screen = "in-mine";
      s.menuIndex = 0;
      s.panel = null;
      cue(s, C.CUES.launch);
      effect(s, "launch-exhaust", buildLaunchX(), C.SURFACE_Y);
    }
  } else if (action === "save") save(s);
  else if (action === "dismiss-notice") s.notice = null;
}
const buildLaunchX = () => 100 + 5 * 310 + 120;
function useItem(s: DeepcoreState, item: C.ItemId) {
  if (!C.ITEM_IDS.includes(item)) throw Error("Unknown supply");
  if (!s.items[item]) {
    note(s, "No supply held");
    return;
  }
  if (
    (item === "nanobots" && s.hull >= maxHull(s)) ||
    (item === "emergency-fuel" && s.fuel >= maxFuel(s))
  ) {
    note(s, "Already full");
    return;
  }
  if (item === "dynamite" || item === "plastic-explosives") {
    const p = pos(s),
      radius =
        item === "dynamite" ? C.DYNAMITE_RADIUS : C.PLASTIC_EXPLOSIVES_RADIUS;
    let changed = false;
    for (
      let r = Math.max(1, p.row - radius);
      r <= Math.min(s.coreRow - 1, p.row + radius);
      r++
    )
      for (
        let c = Math.max(1, p.col - radius);
        c <= Math.min(30, p.col + radius);
        c++
      )
        if (
          ["rock", "ore", "gas", "lava", "stone"].includes(tile(s, c, r).kind)
        )
          changed = true;
    if (!changed) {
      note(s, "Nothing here can be blasted");
      return;
    }
  }
  if (
    item === "matter-transmitter" &&
    s.x === C.SPAWN_COL * C.TILE + 12 &&
    s.y === C.SURFACE_Y - C.MINER_H &&
    s.vx === 0 &&
    s.vy === 0
  ) {
    note(s, "Already at the camp");
    return;
  }
  s.items[item]--;
  cue(s, C.CUES.materialChime);
  if (item === "nanobots")
    s.hull = Math.min(maxHull(s), s.hull + C.NANOBOT_HULL);
  else if (item === "emergency-fuel")
    s.fuel = Math.min(maxFuel(s), s.fuel + C.EMERGENCY_FUEL);
  else if (item === "matter-transmitter" || item === "quantum-teleporter") {
    s.x = C.SPAWN_COL * C.TILE + 12;
    s.y = C.SURFACE_Y - C.MINER_H;
    s.vx = 0;
    s.vy = 0;
    if (item === "quantum-teleporter") {
      const height =
        s.nextTeleportHeight ??
        C.TELEPORT_HEIGHT_TILES_MIN +
          Math.random() *
            (C.TELEPORT_HEIGHT_TILES_MAX - C.TELEPORT_HEIGHT_TILES_MIN);
      s.y -= height * C.TILE;
      s.vy =
        s.nextTeleportSpeed ??
        C.TELEPORT_SPEED_MIN +
          Math.random() * (C.TELEPORT_SPEED_MAX - C.TELEPORT_SPEED_MIN);
      s.nextTeleportHeight = null;
      s.nextTeleportSpeed = null;
    }
    effect(s, "core-extract");
  } else {
    const { col, row } = pos(s),
      radius =
        item === "dynamite" ? C.DYNAMITE_RADIUS : C.PLASTIC_EXPLOSIVES_RADIUS;
    for (
      let r = Math.max(1, row - radius);
      r <= Math.min(s.coreRow - 1, row + radius);
      r++
    )
      for (
        let c = Math.max(1, col - radius);
        c <= Math.min(30, col + radius);
        c++
      ) {
        const t = tile(s, c, r);
        if (["bedrock", "core", "material"].includes(t.kind)) continue;
        put(s, c, r, cell("tunnel", t.band));
        if (t.kind === "gas") gas(s, c, r);
      }
    s.shake = 14;
    effect(s, "gas-explosion");
    cue(s, C.CUES.gasExplosion);
  }
}
export interface Held {
  left: boolean;
  right: boolean;
  down: boolean;
  up: boolean;
}
/** Fixed simulation step. All writes target a newly owned value, never the engine's input. */
export function step(s: DeepcoreState, input: Held, dt: number) {
  if (s.screen !== "in-mine") return;
  if (s.hull <= 0) {
    end(s, "hull-destroyed");
    return;
  }
  if (s.fuel <= 0 && s.y + C.MINER_H > C.SURFACE_Y) {
    end(s, "fuel-out");
    return;
  }
  s.blastTime = Math.max(0, s.blastTime - dt);
  s.elapsedSeconds += dt;
  s.hurt = Math.max(0, s.hurt - dt);
  s.shake = Math.max(0, s.shake - dt * 30);
  if (s.notice) {
    s.notice.age += dt;
    if (s.notice.age > C.NOTICE_DELAY + C.NOTICE_FADE) s.notice = null;
  }
  if (s.launchTime !== null) {
    s.launchTime += dt;
    if (Math.floor(s.launchTime * 12) !== Math.floor((s.launchTime - dt) * 12))
      effect(
        s,
        "launch-exhaust",
        buildLaunchX(),
        C.SURFACE_Y - s.launchTime * s.launchTime * 85,
      );
    if (s.launchTime > 3) end(s, null);
    return;
  }
  const oldAnim = s.anim;
  const frozen = s.panel === "inventory";
  const wasTravel = s.travel,
    wasDrill = s.drill;
  if (frozen) {
    s.travel = false;
    s.drill = false;
  }
  const { col, row } = pos(s),
    j = C.JETPACK_TIERS[s.tiers.jetpack - 1],
    load = loadKg(s) / j.liftLimitKg;
  const g = grounded(s);
  const thrust = input.up && s.fuel > 0;
  const lateral = Number(input.right) - Number(input.left);
  if (lateral) s.facing = lateral > 0 ? "east" : "west";
  if (!frozen && s.y + C.MINER_H > C.SURFACE_Y)
    s.fuel -= C.LIFE_SUPPORT_BURN * dt;
  if (!frozen && thrust)
    s.fuel -=
      (C.THRUST_BURN_MAX -
        (C.THRUST_BURN_MAX - C.THRUST_BURN_MIN) *
          Math.min(1, Math.max(0, -s.vy) / C.CRUISE_SPEED)) *
      C.THRUST_BURN_SIZE_MULT[s.worldSize] *
      dt;
  if (!frozen && !g && lateral && s.fuel > 0) s.fuel -= C.AIR_BURN * dt;
  s.fuel = Math.max(0, s.fuel);
  let target: {
    col: number;
    row: number;
    dir: "down" | "left" | "right";
  } | null = null;
  if (g && !thrust && s.drill && s.fuel > 0) {
    if (input.down)
      target = {
        col,
        row: Math.round((s.y + C.MINER_H) / C.TILE),
        dir: "down",
      };
    else if (lateral) {
      const c =
        lateral > 0
          ? Math.floor((s.x + C.MINER_W + 1) / C.TILE)
          : Math.floor((s.x - 1) / C.TILE);
      if (tile(s, c, row).kind !== "tunnel")
        target = {
          col: c,
          row: Math.max(1, row),
          dir: lateral > 0 ? "right" : "left",
        };
    }
  }
  // A down cut remains supported by its target while the body sinks through its face.
  if (
    s.drilling?.dir === "down" &&
    input.down &&
    !thrust &&
    s.drill &&
    s.fuel > 0
  ) {
    const t = tile(s, s.drilling.col, s.drilling.row);
    if (t.health !== null) target = { ...s.drilling };
  }
  if (target) {
    const t = tile(s, target.col, target.row);
    if (t.kind === "core" && target.dir === "down") {
      if (s.coreTimer === null) {
        s.satchel.coreSample = true;
        s.coreTimer = C.CORE_TIMER;
        effect(s, "core-extract");
        cue(s, C.CUES.materialChime);
      }
      target = null;
    } else if (t.health === null) target = null;
  }
  if (target) {
    if (
      !s.drilling ||
      s.drilling.col !== target.col ||
      s.drilling.row !== target.row
    )
      s.hitTime = 0;
    s.drilling = target;
    s.hitTime += dt;
    while (
      s.hitTime + 1e-9 >= C.DRILL_HIT_INTERVAL &&
      s.fuel >= C.DRILL_HIT_FUEL
    ) {
      s.hitTime -= C.DRILL_HIT_INTERVAL;
      s.fuel -= C.DRILL_HIT_FUEL;
      const t = tile(s, target.col, target.row);
      const health = (t.health ?? 0) - C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1];
      if (health > 0) {
        put(s, target.col, target.row, { ...t, health });
      } else {
        put(s, target.col, target.row, cell("tunnel", t.band));
        if (t.ore) {
          if (slots(s) < C.CARGO_TIERS[s.tiers.cargo - 1]) {
            s.cargo[t.ore] = (s.cargo[t.ore] ?? 0) + 1;
            cue(s, C.CUES.orePickup);
            effect(
              s,
              "ore-sparkle",
              target.col * C.TILE + 40,
              target.row * C.TILE + 40,
              mineralTint[t.ore],
            );
          } else note(s, "Cargo full — mineral lost");
        }
        if (t.material) {
          s.satchel[t.material]++;
          cue(s, C.CUES.materialChime);
          effect(s, "material-shimmer");
        }
        if (t.kind === "gas") gas(s, target.col, target.row);
        if (t.kind === "lava") {
          hurt(
            s,
            (t.band === "deepstone"
              ? C.LAVA_DRILL_DEEPSTONE
              : C.LAVA_DRILL_CORESHELL) *
              (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]),
          );
          notice(s, "lava");
          cue(s, C.CUES.lavaSizzle);
        }
        if (
          target.dir === "down" &&
          s.travel &&
          tile(s, target.col, target.row + 1).kind !== "tunnel" &&
          tile(s, target.col, target.row + 1).kind !== "lava"
        )
          s.y = (target.row + 1) * C.TILE - C.MINER_H;
        s.drilling = null;
        break;
      }
    }
    if (s.drilling?.dir === "down" && s.travel) {
      const t = tile(s, target.col, target.row),
        below = tile(s, target.col, target.row + 1);
      if (below.kind !== "tunnel" && below.kind !== "lava")
        s.y =
          target.row * C.TILE -
          C.MINER_H +
          Math.min(
            1,
            1 -
              (t.health ?? 0) / (t.maxHealth ?? 1) +
              ((C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1] / (t.maxHealth ?? 1)) *
                s.hitTime) /
                C.DRILL_HIT_INTERVAL,
          ) *
            C.TILE;
    }
    if (
      Math.floor(s.elapsedSeconds * 18) !==
      Math.floor((s.elapsedSeconds - dt) * 18)
    )
      effect(
        s,
        "drill-debris",
        target.col * C.TILE + 40,
        target.row * C.TILE + 15,
      );
  } else {
    if (
      s.drilling?.dir === "down" &&
      s.travel &&
      tile(s, s.drilling.col, s.drilling.row).health !== null
    )
      s.y = s.drilling.row * C.TILE - C.MINER_H;
    s.drilling = null;
    s.hitTime = 0;
  }
  if (s.travel) {
    if (s.blastTime <= 0) s.vx = lateral * C.WALK_SPEED;
    if (thrust)
      s.vy = Math.max(
        -j.emptyClimb * (1 - (1 - C.CLIMB_CAP_FLOOR) * Math.min(1, load)),
        s.vy - j.emptyAccel * Math.max(0, 1 - load) * dt,
      );
    else
      s.vy = Math.min(
        C.FALL_TERMINAL_EMPTY +
          (C.FALL_TERMINAL_LOADED - C.FALL_TERMINAL_EMPTY) * Math.min(1, load),
        s.vy + C.GRAVITY * dt,
      );
    const blocked = (x: number, y: number) => {
      for (
        let r = Math.floor((y + 0.1) / C.TILE);
        r <= Math.floor((y + C.MINER_H - 0.1) / C.TILE);
        r++
      )
        for (
          let c = Math.floor((x + 0.1) / C.TILE);
          c <= Math.floor((x + C.MINER_W - 0.1) / C.TILE);
          c++
        ) {
          if (
            s.drilling?.dir === "down" &&
            c === s.drilling.col &&
            r === s.drilling.row
          )
            continue;
          if (tile(s, c, r).kind !== "tunnel") return true;
        }
      return false;
    };
    const nx = s.x + s.vx * dt;
    if (!blocked(nx, s.y)) s.x = nx;
    else {
      if (s.vx > 0)
        s.x = Math.floor((s.x + C.MINER_W) / C.TILE) * C.TILE - C.MINER_W;
      else if (s.vx < 0) s.x = Math.ceil(s.x / C.TILE) * C.TILE;
      s.vx = 0;
    }
    if (s.drilling?.dir === "down") s.vy = 0;
    else {
      const ny = s.y + s.vy * dt;
      if (!blocked(s.x, ny)) s.y = ny;
      else {
        if (s.vy > 0) {
          s.y =
            Math.floor((s.y + C.MINER_H + 0.01) / C.TILE) * C.TILE - C.MINER_H;
          if (s.vy > C.IMPACT_SAFE_SPEED) {
            hurt(s, (s.vy - C.IMPACT_SAFE_SPEED) * C.IMPACT_DAMAGE_RATE);
            effect(s, "impact-dust");
            cue(s, C.CUES.impact);
            s.shake = 7;
          }
        } else s.y = Math.ceil(s.y / C.TILE) * C.TILE;
        s.vy = 0;
      }
    }
  }
  s.anim = s.drilling
    ? s.drilling.dir === "down"
      ? "drill-down"
      : "drill-side"
    : s.hurt > 0
      ? "hurt"
      : s.fuel <= 0
        ? "fuel-out"
        : thrust
          ? "jetpack"
          : !grounded(s)
            ? "fall"
            : lateral && s.travel
              ? "walk"
              : "idle";
  s.animTime = s.anim === oldAnim ? s.animTime + dt : 0;
  if (
    thrust &&
    Math.floor(s.elapsedSeconds * 15) !==
      Math.floor((s.elapsedSeconds - dt) * 15)
  )
    effect(s, "jetpack-exhaust", s.x + 12, s.y + 65);
  // Contact probes include every face of the collision box.
  let lava = false;
  for (const [x, y] of [
    [s.x - 1, s.y + 36],
    [s.x + C.MINER_W + 1, s.y + 36],
    [s.x + 28, s.y + C.MINER_H + 1],
  ]) {
    const c = Math.floor(x / C.TILE),
      r = Math.floor(y / C.TILE);
    if (
      tile(s, c, r).kind === "lava" &&
      !(s.drilling?.col === c && s.drilling.row === r)
    )
      lava = true;
  }
  if (lava && !frozen) {
    hurt(
      s,
      C.LAVA_CONTACT_DPS * (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]) * dt,
    );
    notice(s, "lava");
    if (
      Math.floor(s.elapsedSeconds * 5) !==
      Math.floor((s.elapsedSeconds - dt) * 5)
    ) {
      effect(s, "lava-embers");
      cue(s, C.CUES.lavaSizzle);
    }
  }
  if (s.coreTimer !== null) {
    s.coreTimer -= dt;
    if (s.coreTimer <= 0) {
      const ground = s.coreGround;
      effect(
        s,
        "core-detonation",
        ground ? ground.col * C.TILE + 40 : s.x,
        ground ? ground.row * C.TILE + 40 : s.y,
      );
      s.shake = 30;
      const dies =
        s.satchel.coreSample ||
        (!!ground &&
          Math.hypot(
            s.x + 28 - (ground.col * C.TILE + 40),
            s.y + 36 - (ground.row * C.TILE + 40),
          ) <=
            C.CORE_BLAST_TILES * C.TILE);
      s.coreTimer = null;
      s.coreGround = null;
      s.satchel.coreSample = false;
      if (dies) end(s, "core-detonation");
    }
  }
  if (s.screen === "in-mine") {
    if (s.hull <= 0) end(s, "hull-destroyed");
    else if (s.fuel <= 0 && s.y + C.MINER_H > C.SURFACE_Y) end(s, "fuel-out");
  }
  s.travel = wasTravel;
  s.drill = wasDrill;
  s.deepestDepthMeters = Math.max(s.deepestDepthMeters, depth(s));
  const targetLead =
    Math.abs(s.vy) <= C.CAM_STILL_SPEED ? 0 : Math.sign(s.vy) * C.CAM_LEAD_MAX;
  const rate =
    (C.CAM_LEAD_MAX / C.CAM_LEAD_RAMP) *
    (Math.abs(targetLead) < Math.abs(s.lead) || targetLead * s.lead < 0
      ? C.CAM_UNWIND_MULT
      : 1);
  s.lead +=
    Math.sign(targetLead - s.lead) *
    Math.min(Math.abs(targetLead - s.lead), rate * dt);
  camera(s);
  if (
    Math.floor(s.elapsedSeconds / C.GAS_SEEP_PERIOD) !==
    Math.floor((s.elapsedSeconds - dt) / C.GAS_SEEP_PERIOD)
  ) {
    for (
      let r = Math.max(1, Math.floor(s.camY / C.TILE));
      r <= Math.min(s.coreRow, Math.ceil((s.camY + C.VIEW_H) / C.TILE));
      r++
    )
      for (
        let c = Math.floor(s.camX / C.TILE);
        c <= Math.min(31, Math.ceil((s.camX + C.VIEW_W) / C.TILE));
        c++
      )
        if (tile(s, c, r).kind === "gas")
          effect(s, "gas-seep", c * C.TILE + 40, r * C.TILE + 35);
  }
}
export function camera(s: DeepcoreState) {
  s.camX = Math.max(
    0,
    Math.min(C.WORLD_W - C.VIEW_W, s.x + C.MINER_W / 2 - C.VIEW_W / 2),
  );
  s.camY = Math.min(
    (s.coreRow + 1) * C.TILE - C.VIEW_H,
    s.y + C.MINER_H / 2 - C.VIEW_H / 2 + s.lead,
  );
}
export function advance(
  state: ReadState,
  input: Held,
  dt: number,
): DeepcoreState {
  const s = copy(state);
  s.accumulator += dt;
  const fixed = 1 / 120;
  while (s.accumulator + 1e-10 >= fixed) {
    step(s, input, fixed);
    s.accumulator -= fixed;
  }
  return s;
}
