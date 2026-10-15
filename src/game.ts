/// <reference types="vite/client" />
import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  type DeepcoreState,
  type ReadState,
  initial,
  copy,
  start,
  resume,
  buildings,
  maxFuel,
} from "./model";
import { debug, type DeepcoreDebugApi, snapshot } from "./debug";
import { advance, transaction, camera } from "./simulation";
import { render, BACKGROUND } from "./render";
import { menuItems, menuRect, controls, contains } from "./ui";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
export { BACKGROUND };
export type { DeepcoreState, DeepcoreDebugApi };
const files = import.meta.glob("../assets/**/*.{png,wav,json}", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
}) as Record<string, string>;
function assetPath(url: string) {
  return import.meta.env.PROD
    ? url.slice(url.lastIndexOf("/") + 1)
    : url.replace(/^(\.\/|\/)?assets\//, "");
}
function menu(s: DeepcoreState, index: number): DeepcoreState {
  const item = menuItems(s)[index];
  s.menuIndex = 0;
  switch (s.screen) {
    case "title":
      if (item === "CONTINUE") return resume(s);
      s.screen = item === "HOW TO PLAY" ? "how-to-play" : "mode-select";
      break;
    case "mode-select":
      if (item === "BACK") s.screen = "title";
      else {
        s.mode = index === 0 ? "standard" : "hardcore";
        s.screen = "size-select";
      }
      break;
    case "size-select":
      if (item === "BACK") s.screen = "mode-select";
      else {
        s.worldSize = C.WORLD_SIZES[index];
        return start(s);
      }
      break;
    case "how-to-play":
      s.screen = "title";
      break;
    case "paused":
      if (index === 0) s.screen = "in-mine";
      else if (index === 1) return start(s);
      else s.screen = "title";
      break;
    case "game-over":
    case "victory":
      if (index === 1) s.screen = "title";
      else if (item === "CONTINUE FROM SAVE") return resume(s);
      else return start(s);
      break;
  }
  return s;
}
function back(s: DeepcoreState) {
  if (
    !["paused", "size-select", "mode-select", "how-to-play"].includes(s.screen)
  )
    return;
  s.menuIndex = 0;
  switch (s.screen) {
    case "paused":
      s.screen = "in-mine";
      break;
    case "size-select":
      s.screen = "mode-select";
      break;
    case "mode-select":
    case "how-to-play":
      s.screen = "title";
      break;
  }
}
function act(
  s: DeepcoreState,
  action: string,
  subject: string | null,
  api: UpdateApi,
) {
  if (action === "mute") {
    api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
  } else if (action === "inventory") {
    s.panel = s.panel === "inventory" ? null : "inventory";
    s.panelIndex = 0;
  } else if (action === "pause") {
    if (s.panel) s.panel = null;
    else {
      s.screen = "paused";
      s.menuIndex = 0;
    }
  } else transaction(s, action, subject);
}
export const game: Game<DeepcoreState, DeepcoreDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTION_NAMES)
      api.input.register(action, { keys: [...C.ACTIONS[action]] });
    const images: Record<string, ImageBitmap> = {},
      effectsData: Record<string, ParticleSystem> = {};
    await Promise.all(
      Object.entries(files).map(async ([path, url]) => {
        const relative = path.replace("../assets/", ""),
          key = relative.replace(/\.(png|wav|json)$/, "");
        if (relative.endsWith(".png"))
          images[key] = await api.assets.loadImage(assetPath(url));
        else if (relative.endsWith(".wav"))
          await api.audio.load(key.replace("audio/", ""), assetPath(url));
        else
          effectsData[key.replace("fx/", "")] = JSON.parse(
            await (await api.assets.load(assetPath(url))).text(),
          ) as ParticleSystem;
      }),
    );
    for (const key of [
      "screen",
      "panel",
      "mode",
      "worldSize",
      "credits",
      "depthMeters",
      "coreTimer",
    ] as const)
      api.diagnostics.register(key, (s) => String(snapshot(s)[key] ?? "none"));
    api.diagnostics.register(
      "position",
      (s) => `${s.x.toFixed(1)}, ${s.y.toFixed(1)}`,
    );
    api.diagnostics.register(
      "velocity",
      (s) => `${s.vx.toFixed(1)}, ${s.vy.toFixed(1)}`,
    );
    api.diagnostics.register("animation", (s) => s.anim);
    api.diagnostics.register("facing", (s) => s.facing);
    api.diagnostics.register("grounded", (s) => snapshot(s).miner.grounded);
    api.diagnostics.register(
      "fuel",
      (s) => `${s.fuel.toFixed(1)} / ${snapshot(s).miner.maxFuel}`,
    );
    api.diagnostics.register(
      "hull",
      (s) => `${s.hull.toFixed(1)} / ${snapshot(s).miner.maxHull}`,
    );
    api.diagnostics.register("drilling", (s) => {
      const d = snapshot(s).miner.drilling;
      return d
        ? `${d.col},${d.row} ${d.dir} ${(d.progress * 100).toFixed(0)}%`
        : "none";
    });
    api.diagnostics.register("cargo", (s) => {
      const c = snapshot(s).cargo;
      return `${c.slotsUsed}/${c.slotCap} · ${c.loadKg}/${c.liftLimitKg}kg`;
    });
    api.diagnostics.register("overloaded", (s) => snapshot(s).miner.overloaded);
    api.diagnostics.register(
      "satchel",
      (s) =>
        `R ${s.satchel.resonite} C ${s.satchel.cryenite} Sample ${s.satchel.coreSample}`,
    );
    for (const track of C.TRACKS)
      api.diagnostics.register(track + " tier", (s) => s.tiers[track]);
    api.diagnostics.register("scanner", (s) => {
      const v = snapshot(s).scanner;
      return v.locked
        ? `${v.target} ${v.distanceTiles?.toFixed(1)} tiles`
        : "unlocked";
    });
    const s = initial(images, effectsData);
    camera(s);
    return [s, debug];
  },
  update(state: ReadState, api, dt) {
    let s = copy(state);
    s.simTime += dt;
    s.noteTime = Math.max(0, s.noteTime - dt);
    s.fx = s.fx
      .map((f) => ({ ...f, age: f.age + (s.screen === "paused" ? 0 : dt) }))
      .filter((f) => f.age < 1.5);
    s.muted = api.audio.muted();
    if (s.screen !== "in-mine" && s.screen !== "paused")
      s.shake = Math.max(0, s.shake - dt * 30);
    if (
      s.screen === "in-mine" &&
      (s.hull <= 0 || (s.fuel <= 0 && s.y + C.MINER_H > C.SURFACE_Y))
    )
      s = advance(
        s,
        { left: false, right: false, down: false, up: false },
        1 / 120,
      );
    const pressed = Object.fromEntries(
      C.ACTION_NAMES.map((a) => [a, api.input.pressed(a)]),
    ) as Record<C.ActionName, boolean>;
    if (pressed.mute) act(s, "mute", null, api);
    const pointer = api.input.pointer();
    const regions =
      s.screen === "in-mine"
        ? controls(s)
            .filter((c) => c.enabled)
            .map((c) => ({
              id: c.action + ":" + (c.subject ?? ""),
              rect: c.rect,
              action: c.action,
              subject: c.subject,
            }))
        : menuItems(s).map((_, i) => ({
            id: "menu:" + i,
            rect: menuRect(i),
            action: "menu",
            subject: String(i),
          }));
    for (const sample of api.input.pointerSamples()) {
      if (!sample.primary) continue;
      const region = regions.find((r) => contains(r.rect, sample.x, sample.y));
      if (region?.action === "menu") s.menuIndex = Number(region.subject);
      if (sample.type === "down") {
        s.pointerStart = region?.id ?? null;
        if (!region && s.screen === "in-mine" && !s.panel) {
          const wx = sample.x + s.camX,
            wy = sample.y + s.camY - C.HUD_H;
          const b = buildings.find(
            (b) => wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h,
          );
          if (b) {
            if (b.id === "save-pad") transaction(s, "save");
            else {
              s.panel = b.id;
              s.panelIndex = 0;
            }
            s.pointerStart = "building";
          }
        }
        if (region?.action === "dismiss-notice") {
          transaction(s, "dismiss-notice");
          s.pointerStart = null;
        }
      }
      if (sample.type === "up") {
        if (region && s.pointerStart === region.id) {
          if (region.action === "menu") s = menu(s, Number(region.subject));
          else act(s, region.action, region.subject, api);
        }
        s.pointerStart = null;
      }
    }
    if (pointer.down) {
      const region = regions.find((r) =>
        contains(r.rect, pointer.x, pointer.y),
      );
      if (region?.action === "menu") s.menuIndex = Number(region.subject);
    }
    if (state.screen !== "in-mine") {
      if (pressed.down)
        s.menuIndex = (s.menuIndex + 1) % Math.max(1, menuItems(s).length);
      if (pressed.up)
        s.menuIndex =
          (s.menuIndex + menuItems(s).length - 1) %
          Math.max(1, menuItems(s).length);
      if (pressed.activate) s = menu(s, s.menuIndex);
      if (pressed.pause) back(s);
    } else {
      if (pressed.pause) act(s, "pause", null, api);
      if (pressed.inventory) act(s, "inventory", null, api);
      if (pressed.jettison) transaction(s, "jettison");
      C.ITEM_IDS.forEach((id, i) => {
        if (pressed[`supply${i + 1}` as C.ActionName])
          transaction(s, "use-item", id);
      });
      if (s.panel) {
        const rows = controls(s).filter(
          (c) => c.rect.y > 56 && c.action !== "dismiss-notice",
        );
        if (pressed.down)
          s.panelIndex = (s.panelIndex + 1) % Math.max(1, rows.length);
        if (pressed.up)
          s.panelIndex =
            (s.panelIndex + rows.length - 1) % Math.max(1, rows.length);
        if (pressed.activate && rows[s.panelIndex]?.enabled) {
          const c = rows[s.panelIndex];
          act(s, c.action, c.subject, api);
        }
      } else if (pressed.activate) {
        const b = buildings.find(
          (b) =>
            s.x + C.MINER_W / 2 >= b.x - 20 &&
            s.x + C.MINER_W / 2 <= b.x + b.w + 20 &&
            s.y < 80 &&
            s.y > -100,
        );
        if (b) {
          if (b.id === "save-pad") transaction(s, "save");
          else {
            s.panel = b.id;
            s.panelIndex = 0;
          }
        }
      }
      const held = {
        left: !s.panel && api.input.value("left") > 0,
        right: !s.panel && api.input.value("right") > 0,
        down: !s.panel && api.input.value("down") > 0,
        up: !s.panel && api.input.value("up") > 0,
      };
      s = advance(s, held, dt);
    }
    api.audio.loop(C.CUES.music);
    for (const [name, on] of [
      [C.CUES.drill, s.screen === "in-mine" && s.drilling !== null],
      [C.CUES.thrust, s.screen === "in-mine" && s.anim === "jetpack"],
    ] as const) {
      if (on) api.audio.loop(name);
      else api.audio.stop(name);
    }
    if (
      s.screen === "in-mine" &&
      Math.floor(s.simTime) !== Math.floor(state.simTime)
    ) {
      if (s.fuel / maxFuel(s) < C.LOW_FUEL_FRACTION)
        api.audio.play(C.CUES.alarmFuel);
    }
    if (s.screen === "in-mine" && s.coreTimer !== null) {
      const interval = Math.max(0.15, Math.min(1, s.coreTimer / 30));
      if (
        Math.floor(s.simTime / interval) !==
        Math.floor(state.simTime / interval)
      )
        api.audio.play(C.CUES.alarmCore);
    }
    for (const cue of s.cues) api.audio.play(cue);
    s.cues = [];
    return s;
  },
  render(s, api) {
    render(s, api.ctx);
  },
};
