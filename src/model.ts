import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
export interface Cell {
  kind: C.TileKind;
  band: C.BandName | null;
  ore: C.OreId | null;
  material: C.MaterialId | null;
  health: number | null;
  maxHealth: number | null;
}
export interface Effect {
  tint: string | null;
  name: string;
  x: number;
  y: number;
  age: number;
  seed: number;
}
export interface DeepcoreState {
  images: Record<string, ImageBitmap>;
  effectsData: Record<string, ParticleSystem>;
  screen: C.ScreenName;
  panel: C.PanelId | null;
  mode: C.Mode;
  worldSize: C.WorldSize;
  coreRow: number;
  menuIndex: number;
  muted: boolean;
  simTime: number;
  elapsedSeconds: number;
  hasSave: boolean;
  credits: number;
  creditsEarned: number;
  deepestDepthMeters: number;
  coreTimer: number | null;
  coreGround: { col: number; row: number } | null;
  camX: number;
  camY: number;
  lead: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: C.Facing;
  anim: C.MinerState;
  animTime: number;
  travel: boolean;
  drill: boolean;
  fuel: number;
  hull: number;
  drilling: { col: number; row: number; dir: "down" | "left" | "right" } | null;
  hitTime: number;
  hurt: number;
  cargo: Partial<Record<C.OreId, number>>;
  satchel: { resonite: number; cryenite: number; coreSample: boolean };
  tiers: Record<C.TrackName, number>;
  items: Record<C.ItemId, number>;
  nextTeleportHeight: number | null;
  nextTeleportSpeed: number | null;
  installed: number;
  notice: { hazard: C.NoticeHazard; age: number } | null;
  noticesFired: { gas: boolean; lava: boolean };
  summary: {
    deepestDepthMeters: number;
    creditsEarned: number;
    elapsedSeconds: number;
    mode: C.Mode;
    componentsInstalled: number;
    deathCause: C.DeathCause | null;
  } | null;
  grid: Cell[];
  fx: Effect[];
  cues: C.CueName[];
  shake: number;
  note: string;
  noteTime: number;
  pointerStart: string | null;
  panelIndex: number;
  accumulator: number;
  launchTime: number | null;
  blastTime: number;
}
export type ReadState = DeepReadonly<DeepcoreState>;
export const buildings = C.BUILDINGS.map((id, i) => ({
  id,
  x: 100 + i * 310,
  y: C.SURFACE_Y - 176,
  w: 240,
  h: 176,
}));
export function cell(
  kind: C.TileKind,
  band: C.BandName | null = null,
  ore: C.OreId | null = null,
  material: C.MaterialId | null = null,
): Cell {
  const health =
    ["rock", "ore", "material", "gas", "lava"].includes(kind) && band
      ? C.BAND_HEALTH[band]
      : null;
  return { kind, band, ore, material, health, maxHealth: health };
}
export function bandAt(row: number, coreRow: number): C.BandName {
  return C.BANDS[Math.min(3, Math.floor((4 * (row - 1)) / (coreRow - 1)))];
}
export function tile(s: ReadState, col: number, row: number): Cell {
  if (row <= 0 && col >= 0 && col < C.WORLD_COLS) return cell("tunnel");
  return (s.grid[row * C.WORLD_COLS + col] as Cell) ?? cell("bedrock");
}
export function put(s: DeepcoreState, c: number, r: number, t: Cell): void {
  s.grid[r * C.WORLD_COLS + c] = t;
}
export function emptyGrid(rows: number): Cell[] {
  return Array.from({ length: (rows + 1) * C.WORLD_COLS }, (_, i) => {
    const r = Math.floor(i / C.WORLD_COLS),
      c = i % C.WORLD_COLS;
    return cell(
      r === 0
        ? "tunnel"
        : r === rows
          ? c === C.CORE_COL
            ? "core"
            : "bedrock"
          : c === 0 || c === 31
            ? "bedrock"
            : "tunnel",
      r > 0 && r < rows ? bandAt(r, rows) : null,
    );
  });
}
export function generate(rows: number): Cell[] {
  const g = emptyGrid(rows);
  const mineral = (r: number): C.OreId => {
    const f = (r - 1) / (rows - 1),
      weights = C.MINERALS.map(
        (m) => m.pick * Math.max(0, 1 - Math.abs(f - m.peak) / m.spread),
      );
    let n = Math.random() * weights.reduce((a, b) => a + b, 0);
    return (
      C.MINERALS[weights.findIndex((w) => (n -= w) < 0)]?.id ?? C.ORE_IDS[0]
    );
  };
  for (let r = 1; r < rows; r++)
    for (let c = 1; c <= 30; c++) g[r * 32 + c] = cell("rock", bandAt(r, rows));
  for (const [bi, b] of C.BANDS.entries()) {
    const candidates: number[] = [];
    for (let r = 1; r < rows; r++)
      if (bandAt(r, rows) === b)
        for (let c = 1; c <= 30; c++) candidates.push(r * 32 + c);
    const middle = candidates[Math.floor(candidates.length / 2)] / 32;
    const f = (middle - 1) / (rows - 1);
    const assign = (kind: C.TileKind, count: number, cluster = false) => {
      let done = 0,
        attempts = 0;
      while (done < count && attempts++ < count * 300 + 1000) {
        const idx = candidates[Math.floor(Math.random() * candidates.length)],
          r = Math.floor(idx / 32),
          c = idx % 32;
        if (c === C.CORE_COL || g[idx].kind !== "rock") continue;
        const f = (r - 1) / (rows - 1);
        const weight =
          kind === "stone"
            ? (C.STONE_DENSITY_MIN +
                ((C.STONE_DENSITY_MAX - C.STONE_DENSITY_MIN) * (f - 0.25)) /
                  0.75) /
              C.STONE_DENSITY_MAX
            : kind === "gas"
              ? (C.GAS_DENSITY_MIN +
                  ((C.GAS_DENSITY_MAX - C.GAS_DENSITY_MIN) * (f - 0.25)) /
                    0.75) /
                C.GAS_DENSITY_MAX
              : kind === "lava"
                ? (C.LAVA_DENSITY_MIN +
                    ((C.LAVA_DENSITY_MAX - C.LAVA_DENSITY_MIN) * (f - 0.5)) /
                      0.5) /
                  C.LAVA_DENSITY_MAX
                : 1;
        if (Math.random() > weight) continue;
        const size = cluster ? 2 + Math.floor(Math.random() * 4) : 1;
        for (let j = 0; j < size && done < count; j++) {
          const cc = c + j,
            ii = r * 32 + cc;
          if (cc > 30 || cc === C.CORE_COL || g[ii].kind !== "rock") continue;
          g[ii] = cell(kind, b, kind === "ore" ? mineral(r) : null);
          done++;
        }
      }
    };
    if (bi > 0) {
      assign(
        "stone",
        Math.round(
          candidates.length *
            (C.STONE_DENSITY_MIN +
              ((C.STONE_DENSITY_MAX - C.STONE_DENSITY_MIN) * (f - 0.25)) /
                0.75),
        ),
      );
      assign(
        "gas",
        Math.round(
          candidates.length *
            (C.GAS_DENSITY_MIN +
              ((C.GAS_DENSITY_MAX - C.GAS_DENSITY_MIN) * (f - 0.25)) / 0.75),
        ),
      );
    }
    if (bi >= 2)
      assign(
        "lava",
        Math.round(
          candidates.length *
            (C.LAVA_DENSITY_MIN +
              ((C.LAVA_DENSITY_MAX - C.LAVA_DENSITY_MIN) * (f - 0.5)) / 0.5),
        ),
        true,
      );
    // Ore shares a total budget across ordinary veins and rare faceted gemstones.
    let left = Math.round(candidates.length * C.ORE_DENSITY);
    while (left > 0) {
      const idx = candidates[Math.floor(Math.random() * candidates.length)],
        r = Math.floor(idx / 32),
        c = idx % 32;
      if (r < C.ORE_MIN_ROW || g[idx].kind !== "rock") continue;
      const ore = mineral(r);
      for (let j = 0; j < 2 + Math.floor(Math.random() * 3) && left > 0; j++) {
        const cc = c + j,
          ii = r * 32 + cc;
        if (cc > 30 || g[ii].kind !== "rock") continue;
        g[ii] = cell("ore", b, ore);
        left--;
      }
    }
  }
  for (const m of C.MATERIALS) {
    const bi = C.BANDS.indexOf(C.MATERIAL_BAND[m]),
      r = Math.floor(((bi + 0.2 + Math.random() * 0.6) * (rows - 1)) / 4) + 1,
      c = 2 + Math.floor(Math.random() * 28);
    g[r * 32 + c] = cell("material", bandAt(r, rows), null, m);
    for (let x = Math.min(c, C.CORE_COL); x <= Math.max(c, C.CORE_COL); x++) {
      const t = g[r * 32 + x];
      if (t.kind === "lava" || t.kind === "stone")
        g[r * 32 + x] = cell("rock", t.band);
    }
  }
  // The guaranteed route is diggable rock, never an already-open express shaft.
  g[32 + C.CAVE_MOUTH_COL] = cell("tunnel", "topsoil");
  return g;
}
export function initial(
  images: Record<string, ImageBitmap> = {},
  effectsData: Record<string, ParticleSystem> = {},
): DeepcoreState {
  return {
    images,
    effectsData,
    screen: "title",
    panel: null,
    mode: "standard",
    worldSize: "standard",
    coreRow: C.STANDARD_ROWS,
    menuIndex: 0,
    muted: false,
    simTime: 0,
    elapsedSeconds: 0,
    hasSave: readSave() !== null,
    credits: 0,
    creditsEarned: 0,
    deepestDepthMeters: 0,
    coreTimer: null,
    coreGround: null,
    camX: 0,
    camY: C.SURFACE_Y - C.MINER_H / 2 - C.VIEW_H / 2,
    lead: 0,
    x: C.SPAWN_COL * C.TILE + (C.TILE - C.MINER_W) / 2,
    y: C.SURFACE_Y - C.MINER_H,
    vx: 0,
    vy: 0,
    facing: "east",
    anim: "idle",
    animTime: 0,
    travel: true,
    drill: true,
    fuel: C.FUEL_TIERS[0],
    hull: C.HULL_TIERS[0],
    drilling: null,
    hitTime: 0,
    hurt: 0,
    cargo: {},
    satchel: { resonite: 0, cryenite: 0, coreSample: false },
    tiers: Object.fromEntries(C.TRACKS.map((t) => [t, 1])) as Record<
      C.TrackName,
      number
    >,
    items: Object.fromEntries(C.ITEM_IDS.map((t) => [t, 0])) as Record<
      C.ItemId,
      number
    >,
    nextTeleportHeight: null,
    nextTeleportSpeed: null,
    installed: 0,
    notice: null,
    noticesFired: { gas: false, lava: false },
    summary: null,
    grid: emptyGrid(C.STANDARD_ROWS),
    fx: [],
    cues: [],
    shake: 0,
    note: "",
    noteTime: 0,
    pointerStart: null,
    panelIndex: 0,
    accumulator: 0,
    launchTime: null,
    blastTime: 0,
  };
}
/** Copy the changing simulation values; decoded assets remain immutable shared resources. */
export function copy(s: ReadState): DeepcoreState {
  return {
    ...s,
    grid: [...s.grid] as Cell[],
    cargo: { ...s.cargo },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    noticesFired: { ...s.noticesFired },
    fx: s.fx.map((e) => ({ ...e })),
    cues: [...s.cues],
    images: s.images as Record<string, ImageBitmap>,
    effectsData: s.effectsData as Record<string, ParticleSystem>,
    notice: s.notice ? { ...s.notice } : null,
    summary: s.summary ? { ...s.summary } : null,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    drilling: s.drilling ? { ...s.drilling } : null,
  };
}
export const slots = (s: ReadState) =>
  Object.values(s.cargo).reduce((a, b) => a + (b ?? 0), 0);
export const loadKg = (s: ReadState) =>
  C.MINERALS.reduce((a, m) => a + (s.cargo[m.id] ?? 0) * m.weightKg, 0);
export const maxFuel = (s: ReadState) => C.FUEL_TIERS[s.tiers.fuel - 1];
export const maxHull = (s: ReadState) => C.HULL_TIERS[s.tiers.hull - 1];
export const depth = (s: ReadState) =>
  Math.max(0, ((s.y + C.MINER_H - C.SURFACE_Y) / C.TILE) * C.METERS_PER_ROW);
export const pos = (s: ReadState) => ({
  col: Math.floor((s.x + C.MINER_W / 2) / C.TILE),
  row: Math.max(0, Math.floor((s.y + C.MINER_H / 2) / C.TILE)),
});
export function grounded(s: ReadState): boolean {
  const y = s.y + C.MINER_H;
  return (
    Math.abs(y / C.TILE - Math.round(y / C.TILE)) < 0.02 &&
    [s.x + 2, s.x + C.MINER_W - 2].some(
      (x) =>
        tile(s, Math.floor(x / C.TILE), Math.round(y / C.TILE)).kind !==
        "tunnel",
    )
  );
}
export function scanner(s: ReadState) {
  const range = C.SCANNER_TIERS[s.tiers.scanner - 1],
    p = pos(s);
  let target: C.MaterialId | null = null,
    dx = 0,
    dy = 0,
    best = Infinity;
  if (range)
    for (const m of C.MATERIALS) {
      if (s.satchel[m]) continue;
      const idx = s.grid.findIndex((t) => t.material === m);
      if (idx < 0) continue;
      const x = (idx % 32) - p.col,
        y = Math.floor(idx / 32) - p.row,
        d = Math.hypot(x, y);
      if (d < best && d <= range) {
        target = m;
        dx = x;
        dy = y;
        best = d;
      }
    }
  return target
    ? {
        locked: true,
        target,
        dirX: best ? dx / best : 0,
        dirY: best ? dy / best : 0,
        distanceTiles: best,
      }
    : { locked: false, target: null, dirX: 0, dirY: 0, distanceTiles: null };
}
const SAVE_KEY = "deepcore-expedition-v1";
export function readSave(): Partial<DeepcoreState> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Partial<DeepcoreState>) : null;
  } catch {
    return null;
  }
}
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Storage is optional. */
  }
}
export function note(s: DeepcoreState, text: string) {
  s.note = text;
  s.noteTime = 4;
}
export const mineralTint: Record<C.OreId, string> = Object.fromEntries(
  [...C.ORE_IDS, ...C.GEMSTONE_IDS].map((id, i) => [
    id,
    [
      "#c29d71",
      "#d0c2a1",
      "#e58a51",
      "#d9e6e3",
      "#589ddd",
      "#e2cc58",
      "#8fcac1",
      "#f76d51",
      "#c879ac",
      "#b5e9e8",
      "#62edaa",
      "#ef8bbc",
      "#ffd678",
    ][i],
  ]),
) as Record<C.OreId, string>;
export function effect(
  s: DeepcoreState,
  name: string,
  x = s.x + 28,
  y = s.y + 36,
  tint: string | null = null,
) {
  if (name === "drill-debris") {
    const band = tile(s, Math.floor(x / C.TILE), Math.floor(y / C.TILE)).band;
    tint = ["#b59b77", "#849c9e", "#64768a", "#b47276"][
      C.BANDS.indexOf(band ?? "topsoil")
    ];
  }
  s.fx.push({
    name,
    x,
    y,
    tint,
    age: 0,
    seed: Math.floor(Math.random() * 1e6),
  });
}
export function cue(s: DeepcoreState, c: C.CueName) {
  s.cues.push(c);
}
export function save(s: DeepcoreState) {
  if (s.coreTimer !== null) {
    note(s, "Unstable Core Sample — saving refused");
    return;
  }
  try {
    const { images: _images, effectsData: _effects, fx: _fx, ...payload } = s;
    void _images;
    void _effects;
    void _fx;
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    s.hasSave = true;
    note(s, "Expedition secured at Save Pad");
  } catch {
    note(s, "Storage unavailable — expedition not saved");
  }
}
export function resume(s: DeepcoreState): DeepcoreState {
  const saved = readSave();
  if (!saved) return s;
  return {
    ...s,
    ...saved,
    images: s.images,
    effectsData: s.effectsData,
    screen: "in-mine",
    panel: null,
    x: C.SPAWN_COL * C.TILE + 12,
    y: C.SURFACE_Y - C.MINER_H,
    vx: 0,
    vy: 0,
    summary: null,
    hasSave: true,
  };
}
export function start(s: ReadState): DeepcoreState {
  clearSave();
  const n = initial(
    s.images as Record<string, ImageBitmap>,
    s.effectsData as Record<string, ParticleSystem>,
  );
  n.mode = s.mode;
  n.worldSize = s.worldSize;
  n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[n.worldSize]);
  n.grid = generate(n.coreRow);
  n.screen = "in-mine";
  n.hasSave = false;
  n.muted = s.muted;
  note(n, "Drill down. Bring ore home. Build your escape.");
  return n;
}
