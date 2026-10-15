import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock, type Game } from "@clockwyrks/simple-2d";
import {
  initial,
  copy,
  generate,
  cell,
  put,
  slots,
  maxFuel,
  loadKg,
} from "./model";
import { debug } from "./debug";
import { advance, transaction, step } from "./simulation";
import { game } from "./game";
import * as C from "./constants";
const rest = { left: false, right: false, down: false, up: false };
function mine() {
  const s = initial();
  s.screen = "in-mine";
  s.grid = generate(s.coreRow);
  return s;
}
describe("expedition simulation", () => {
  it("generates all sizes with borders, unique materials, and a safe route to the Core", () => {
    for (const size of C.WORLD_SIZES) {
      const rows = C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[size],
        g = generate(rows);
      expect(g.length).toBe((rows + 1) * 32);
      for (const m of C.MATERIALS)
        expect(g.filter((t) => t.material === m)).toHaveLength(1);
      expect(g[rows * 32 + 16].kind).toBe("core");
      for (let r = 1; r < rows; r++) {
        expect(g[r * 32].kind).toBe("bedrock");
        expect(["stone", "lava"]).not.toContain(g[r * 32 + 16].kind);
      }
      expect(g[32 + 26].kind).toBe("tunnel");
    }
  });
  it("drills at the specified cadence, banks ore, persists damage, and leaves the input unchanged", () => {
    let s = mine();
    put(s, 4, 1, cell("ore", "topsoil", "ferron"));
    const original = copy(s);
    s = advance(s, { ...rest, down: true }, 0.25);
    expect(debug.tileAt(s, 4, 1).health).toBe(2);
    expect(original.grid[36].health).toBe(4);
    s = advance(s, { ...rest, down: true }, 0.25);
    expect(debug.tileAt(s, 4, 1).kind).toBe("tunnel");
    expect(slots(s)).toBe(1);
    expect(s.fuel).toBeCloseTo(99, 0);
  });
  it("integrates rates consistently across frame partitions", () => {
    const s = debug.clearMine(mine());
    let a = copy(s),
      b = copy(s);
    for (let i = 0; i < 120; i++) a = advance(a, rest, 1 / 120);
    for (let i = 0; i < 30; i++) b = advance(b, rest, 1 / 30);
    expect(a.y).toBeCloseTo(b.y, 7);
    expect(a.fuel).toBeCloseTo(b.fuel, 7);
    expect(a.lead).toBeCloseTo(b.lead, 7);
  });
  it("cannot lift an overloaded cargo bay and can discard weight anywhere", () => {
    let s = mine();
    s = debug.setCargo(s, "aurite", 4);
    expect(loadKg(s)).toBe(464);
    s = advance(s, { ...rest, up: true }, 1);
    expect(s.y).toBe(8);
    s = debug.dropOre(s, "aurite");
    s = debug.dropOre(s, "aurite");
    s = advance(s, { ...rest, up: true }, 1);
    expect(s.y).toBeLessThan(8);
  });
  it("applies upgrades as capacity additions rather than free refills", () => {
    const s = mine();
    s.fuel = 30;
    s.credits = 300;
    transaction(s, "buy-upgrade", "fuel");
    expect(maxFuel(s)).toBe(175);
    expect(s.fuel).toBe(105);
    expect(s.credits).toBe(0);
  });
  it("sells by mineral value, prices refills, and never spends more than the balance", () => {
    const s = mine();
    s.cargo = { ferron: 2, marlite: 1 };
    transaction(s, "sell");
    expect(s.credits).toBe(102);
    expect(s.creditsEarned).toBe(102);
    s.fuel = 0;
    transaction(s, "fill-fuel");
    expect(s.fuel).toBe(100);
    expect(s.credits).toBe(2);
    s.hull = 0;
    transaction(s, "repair-full");
    expect(s.hull).toBe(1);
    expect(s.credits).toBe(0);
  });
  it("explosives destroy ore and stone but protect exotic nodes", () => {
    const s = mine();
    s.y = 80;
    put(s, 4, 1, cell("tunnel", "topsoil"));
    put(s, 5, 1, cell("stone", "topsoil"));
    put(s, 3, 1, cell("material", "rockbed", null, "resonite"));
    s.items.dynamite = 1;
    transaction(s, "use-item", "dynamite");
    expect(s.grid[37].kind).toBe("tunnel");
    expect(s.grid[35].kind).toBe("material");
    expect(slots(s)).toBe(0);
    expect(s.items.dynamite).toBe(0);
  });
  it("consumes posed teleport outcomes and preserves other holdings", () => {
    let s = mine();
    s = debug.setItemCount(s, "quantum-teleporter", 1);
    s = debug.setNextTeleportHeight(s, 6);
    s = debug.setNextTeleportSpeed(s, 420);
    s = debug.useItem(s, "quantum-teleporter");
    expect(s.y).toBe(C.SURFACE_Y - C.MINER_H - 480);
    expect(s.vy).toBe(420);
    expect(s.nextTeleportHeight).toBeNull();
    expect(s.nextTeleportSpeed).toBeNull();
  });
  it("jettisoned Samples detonate by distance; carried Samples kill", () => {
    let s = mine();
    s = debug.setCoreCarried(s, true);
    s = debug.setCoreTimer(s, 0.1);
    s = debug.jettison(s);
    s = debug.setMinerPosition(s, 2000, 8);
    s = advance(s, rest, 0.2);
    expect(s.screen).toBe("in-mine");
    expect(s.coreTimer).toBeNull();
    s = debug.setCoreCarried(s, true);
    s = debug.setCoreTimer(s, 0.1);
    s = advance(s, rest, 0.2);
    expect(s.screen).toBe("game-over");
    expect(s.summary?.deathCause).toBe("core-detonation");
  });
  it("fabricates in sequence, consumes the ignition Sample, and launches to victory", () => {
    let s = mine();
    s.credits = 30000;
    s.satchel.resonite = 1;
    s.satchel.cryenite = 1;
    s = debug.setCoreCarried(s, true);
    for (let i = 0; i < 5; i++) s = debug.fabricate(s);
    expect(s.installed).toBe(5);
    expect(s.coreTimer).toBeNull();
    expect(s.credits).toBe(4500);
    s = debug.launch(s);
    s = advance(s, rest, 3.1);
    expect(s.screen).toBe("victory");
  });
  it("gates travel independently from fuel consumption and drilling", () => {
    let s = mine();
    s = debug.setMinerTravel(s, false);
    s = advance(s, { ...rest, down: true }, 0.5);
    expect(s.y).toBe(8);
    expect(s.grid[36].kind).toBe("tunnel");
    expect(s.fuel).toBeLessThan(100);
  });
  it("validates debug domains and reconciles without stepping time", () => {
    const s = mine();
    expect(() => debug.setTier(s, "fuel", 8)).toThrow();
    expect(() => debug.setCoreTimer(s, 2)).toThrow();
    const n = debug.setFuel(s, 1000);
    expect(debug.reconcile(n)).toEqual(n);
    expect(debug.snapshot(n).miner.fuel).toBe(1000);
  });
  it("hard landings damage hull; fuel-out below the surface ends immediately", () => {
    const s = mine();
    s.vy = 950;
    step(s, rest, 1 / 120);
    expect(s.hull).toBeLessThan(100);
    s.y = 88;
    s.fuel = 0;
    step(s, rest, 1 / 120);
    expect(s.screen).toBe("game-over");
    expect(s.summary?.deathCause).toBe("fuel-out");
  });
  it("resizing preserves original bands and partial tile health", () => {
    let s = mine();
    s = debug.setOreTile(s, 5, 150, "voltite");
    s = debug.setTileHealth(s, 5, 150, 2);
    const t = debug.tileAt(s, 5, 150);
    s = debug.setWorldSize(s, "quick");
    expect(debug.tileAt(s, 5, 150)).toEqual(t);
    expect(s.coreRow).toBe(250);
  });
});
describe("Simple 2D integration", () => {
  it("runs immutable updates over a canvas with engine input and a counted clock", async () => {
    const target = new EventTarget();
    const canvas = createCanvas(1280, 720);
    const harness: Game<
      typeof initial extends (...args: never[]) => infer T ? T : never,
      typeof debug
    > = {
      ...game,
      initialize(api) {
        for (const action of C.ACTION_NAMES)
          api.input.register(action, { keys: [...C.ACTIONS[action]] });
        for (const cue of Object.values(C.CUES))
          api.audio.define(cue, { freq: 100, durationMs: 10 });
        return [mine(), debug];
      },
      render() {
        /* This integration test exercises the simulation independently of decoded browser assets. */
      },
    };
    const engine = createEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      width: 1280,
      height: 720,
      game: harness,
      clock: new ConstantClock(1000 / 60),
      surface: {
        cssWidth: () => 1280,
        cssHeight: () => 720,
        dpr: () => 1,
        events: () => target,
      },
    });
    await engine.initialize();
    const before = engine.state;
    const key = new Event("keydown");
    Object.defineProperty(key, "code", { value: "KeyS" });
    target.dispatchEvent(key);
    await engine.advance(30);
    expect(engine.frame().count).toBe(30);
    expect(debug.tileAt(engine.state, 4, 1).kind).toBe("tunnel");
    expect(before.grid[36].kind).toBe("rock");
    engine.destroy();
  });
});

describe("complete engine game", () => {
  it("loads the produced art, handles menus and panels, and pauses the Core clock", async () => {
    const { loadImage } = await import("@napi-rs/canvas");
    const particleText = import.meta.glob("../assets/fx/*.json", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;
    const target = new EventTarget(),
      canvas = createCanvas(1280, 720);
    const full: Game<ReturnType<typeof initial>, typeof debug> = {
      ...game,
      initialize(api) {
        return game.initialize({
          ...api,
          assets: {
            ...api.assets,
            loadImage: async (path) =>
              (await loadImage(
                "assets/" + path.split("?")[0],
              )) as unknown as ImageBitmap,
            load: async (path) =>
              new Blob([particleText["../assets/" + path.split("?")[0]]]),
          },
          audio: {
            ...api.audio,
            load: async (cue) => {
              api.audio.define(cue, { freq: 100, durationMs: 10 });
            },
          },
        });
      },
    };
    const engine = createEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      width: 1280,
      height: 720,
      game: full,
      clock: new ConstantClock(1000 / 60),
      surface: {
        cssWidth: () => 1280,
        cssHeight: () => 720,
        dpr: () => 1,
        events: () => target,
      },
    });
    await engine.initialize();
    expect(Object.keys(engine.state.images).length).toBeGreaterThan(70);
    expect(Object.keys(engine.state.effectsData)).toHaveLength(12);
    const key = async (code: string) => {
      const down = new Event("keydown");
      Object.defineProperty(down, "code", { value: code });
      target.dispatchEvent(down);
      await engine.advance(1);
      const up = new Event("keyup");
      Object.defineProperty(up, "code", { value: code });
      target.dispatchEvent(up);
      await engine.advance(1);
    };
    await key("Enter");
    expect(engine.state.screen).toBe("mode-select");
    await key("Enter");
    expect(engine.state.screen).toBe("size-select");
    await key("Enter");
    expect(engine.state.screen).toBe("in-mine");
    await key("KeyI");
    expect(engine.state.panel).toBe("inventory");
    engine.apply((s) => debug.setCoreCarried(s, true));
    const before = engine.state.coreTimer ?? 0,
      y = engine.state.y;
    await engine.advance(12);
    expect(engine.state.y).toBe(y);
    expect(engine.state.coreTimer).toBeCloseTo(before - 0.2, 6);
    await key("Escape");
    expect(engine.state.panel).toBeNull();
    await key("Escape");
    expect(engine.state.screen).toBe("paused");
    const timer = engine.state.coreTimer,
      simTime = engine.state.simTime;
    await engine.advance(12);
    expect(engine.state.coreTimer).toBe(timer);
    expect(engine.state.simTime).toBeGreaterThan(simTime);
    expect(engine.diagnostics().every((d) => d.error === undefined)).toBe(true);
    expect(engine.diagnostics().length).toBeGreaterThan(20);
    engine.destroy();
  });
  it("saves the expedition transactionally and refuses an unstable Sample", () => {
    const store = new Map<string, string>();
    const prior = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });
    try {
      let s = mine();
      s.credits = 400;
      s = debug.save(s);
      expect(s.hasSave).toBe(true);
      expect(store.size).toBe(1);
      s = debug.setCoreCarried(s, true);
      s.credits = 900;
      s = debug.save(s);
      expect(s.note).toContain("refused");
      const saved = JSON.parse([...store.values()][0]) as { credits: number };
      expect(saved.credits).toBe(400);
      s = debug.setCoreCarried(s, false);
      s = debug.clearSave(s);
      expect(s.hasSave).toBe(false);
      expect(store.size).toBe(0);
    } finally {
      if (prior) Object.defineProperty(globalThis, "localStorage", prior);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
});
