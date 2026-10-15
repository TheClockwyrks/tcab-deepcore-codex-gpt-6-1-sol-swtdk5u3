import * as C from "./constants";
import {
  type ReadState,
  type DeepcoreState,
  copy,
  initial,
  cell,
  tile,
  put,
  bandAt,
  emptyGrid,
  generate,
  buildings,
  maxFuel,
  maxHull,
  slots,
  loadKg,
  grounded,
  pos,
  depth,
  scanner,
  clearSave,
} from "./model";
import { transaction } from "./simulation";
import { menuItems, menuRect, controls } from "./ui";
function valid(ok: boolean): void {
  if (!ok) throw Error("Deepcore: invalid debug argument or state");
}
function number(v: number, min = -Infinity, max = Infinity) {
  valid(Number.isFinite(v) && v >= min && v <= max);
}
function choose<T extends string>(v: T, values: readonly T[]) {
  valid(values.includes(v));
}
function pose(s: ReadState, fn: (s: DeepcoreState) => void) {
  const n = copy(s);
  fn(n);
  return n;
}
function coords(s: ReadState, c: number, r: number) {
  number(c, 0, C.WORLD_COLS - 1);
  number(r, 1, s.coreRow);
  valid(Number.isInteger(c) && Number.isInteger(r));
}
export function snapshot(s: ReadState) {
  const load = loadKg(s),
    lift = C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg;
  const t = s.drilling ? tile(s, s.drilling.col, s.drilling.row) : null;
  return {
    version: C.DEEPCORE_DEBUG_VERSION,
    screen: s.screen,
    panel: s.panel,
    mode: s.mode,
    worldSize: s.worldSize,
    coreRow: s.coreRow,
    menuIndex: s.menuIndex,
    muted: s.muted,
    simTime: s.simTime,
    elapsedSeconds: s.elapsedSeconds,
    hasSave: s.hasSave,
    credits: s.credits,
    creditsEarned: s.creditsEarned,
    depthMeters: depth(s),
    deepestDepthMeters: s.deepestDepthMeters,
    coreTimer: s.coreTimer,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    camera: { x: s.camX, y: s.camY, lead: s.lead },
    miner: {
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      ...pos(s),
      facing: s.facing,
      state: s.anim,
      grounded: grounded(s),
      travel: s.travel,
      drill: s.drill,
      fuel: s.fuel,
      maxFuel: maxFuel(s),
      hull: s.hull,
      maxHull: maxHull(s),
      overloaded: load >= lift,
      drilling: s.drilling
        ? {
            ...s.drilling,
            progress: 1 - (t?.health ?? 0) / (t?.maxHealth ?? 1),
          }
        : null,
    },
    cargo: {
      slotsUsed: slots(s),
      slotCap: C.CARGO_TIERS[s.tiers.cargo - 1],
      loadKg: load,
      liftLimitKg: lift,
      ore: Object.fromEntries(Object.entries(s.cargo).filter(([, v]) => v)),
    },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    nextTeleportHeight: s.nextTeleportHeight,
    nextTeleportSpeed: s.nextTeleportSpeed,
    rocket: {
      installed: C.ROCKET_COMPONENT_IDS.slice(0, s.installed),
      nextComponent: C.ROCKET_COMPONENT_IDS[s.installed] ?? null,
    },
    scanner: scanner(s),
    notice: s.notice
      ? { hazard: s.notice.hazard, shown: s.notice.age >= C.NOTICE_DELAY }
      : null,
    noticesFired: { ...s.noticesFired },
    summary: s.summary ? { ...s.summary } : null,
  };
}
export const debug = {
  version: C.DEEPCORE_DEBUG_VERSION,
  snapshot,
  tileAt: (s: ReadState, c: number, r: number) => ({ ...tile(s, c, r) }),
  findTile(s: ReadState, kind: C.TileKind) {
    choose(kind, C.TILE_KINDS);
    let best: null | { col: number; row: number } = null,
      d = Infinity;
    s.grid.forEach((t, i) => {
      if (t.kind !== kind) return;
      const c = i % 32,
        r = Math.floor(i / 32),
        dist = Math.hypot(
          c * C.TILE + C.TILE / 2 - s.x - C.MINER_W / 2,
          r * C.TILE + C.TILE / 2 - s.y - C.MINER_H / 2,
        );
      if (dist < d) {
        d = dist;
        best = { col: c, row: r };
      }
    });
    return best;
  },
  buildings: (_s: ReadState) => buildings.map((b) => ({ ...b })),
  menuItemRect: (s: ReadState, i: number) =>
    Number.isInteger(i) && i >= 0 && i < menuItems(s).length
      ? menuRect(i)
      : null,
  controlRect: (s: ReadState, control: string, subject: string | null) =>
    controls(s).find((c) => c.action === control && c.subject === subject)
      ?.rect ?? null,
  reset: (s: ReadState) => ({
    ...initial(
      s.images as Record<string, ImageBitmap>,
      s.effectsData as DeepcoreState["effectsData"],
    ),
    muted: s.muted,
    hasSave: s.hasSave,
  }),
  reconcile: (s: ReadState) => copy(s),
  generateMine: (s: ReadState) => ({ ...copy(s), grid: generate(s.coreRow) }),
  clearMine: (s: ReadState) => ({
    ...copy(s),
    grid: s.grid.map((t, i) => {
      const c = i % C.WORLD_COLS,
        r = Math.floor(i / C.WORLD_COLS);
      return c >= 1 && c <= 30 && r >= 1 && r < s.coreRow
        ? cell("tunnel", t.band)
        : { ...t };
    }),
  }),
  clearCargo: (s: ReadState) => ({ ...copy(s), cargo: {} }),
  clearItems: (s: ReadState) => ({
    ...copy(s),
    items: Object.fromEntries(
      C.ITEM_IDS.map((i) => [i, 0]),
    ) as DeepcoreState["items"],
  }),
  setTile: (s: ReadState, c: number, r: number, kind: C.TileKind) =>
    pose(s, (n) => {
      coords(n, c, r);
      choose(kind, C.TILE_KINDS);
      valid(kind !== "ore" && kind !== "material");
      put(n, c, r, cell(kind, bandAt(r, n.coreRow)));
    }),
  setOreTile: (s: ReadState, c: number, r: number, ore: C.OreId) =>
    pose(s, (n) => {
      coords(n, c, r);
      choose(ore, [...C.ORE_IDS, ...C.GEMSTONE_IDS]);
      put(n, c, r, cell("ore", bandAt(r, n.coreRow), ore));
    }),
  setMaterialTile: (s: ReadState, c: number, r: number, m: C.MaterialId) =>
    pose(s, (n) => {
      coords(n, c, r);
      choose(m, C.MATERIALS);
      put(n, c, r, cell("material", bandAt(r, n.coreRow), null, m));
    }),
  setTileHealth: (s: ReadState, c: number, r: number, h: number) =>
    pose(s, (n) => {
      coords(n, c, r);
      const t = tile(n, c, r);
      valid(t.maxHealth !== null);
      number(h, Number.MIN_VALUE, t.maxHealth ?? 0);
      put(n, c, r, { ...t, health: h });
    }),
  placeCoreSample: (s: ReadState, c: number, r: number) =>
    pose(s, (n) => {
      coords(n, c, r);
      valid(n.coreTimer === null && tile(n, c, r).kind === "tunnel");
      n.coreTimer = C.CORE_TIMER;
      n.coreGround = { col: c, row: r };
    }),
  setMinerPosition: (s: ReadState, x: number, y: number) =>
    pose(s, (n) => {
      number(x);
      number(y);
      n.x = x;
      n.y = y;
    }),
  setMinerVelocity: (s: ReadState, vx: number, vy: number) =>
    pose(s, (n) => {
      number(vx);
      number(vy);
      n.vx = vx;
      n.vy = vy;
    }),
  setFacing: (s: ReadState, f: C.Facing) =>
    pose(s, (n) => {
      choose(f, C.FACINGS);
      n.facing = f;
    }),
  setFuel: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, 0);
      n.fuel = v;
    }),
  setHull: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, 0);
      n.hull = v;
    }),
  setMinerTravel: (s: ReadState, v: boolean) => ({ ...copy(s), travel: v }),
  setMinerDrill: (s: ReadState, v: boolean) => ({ ...copy(s), drill: v }),
  setScreen: (s: ReadState, v: C.ScreenName) =>
    pose(s, (n) => {
      choose(v, C.SCREENS);
      n.screen = v;
    }),
  setPanel: (s: ReadState, v: C.PanelId | null) =>
    pose(s, (n) => {
      if (v) choose(v, C.PANELS);
      n.panel = v;
    }),
  setMenuIndex: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, 0, menuItems(s).length - 1);
      valid(Number.isInteger(v));
      n.menuIndex = v;
    }),
  setMode: (s: ReadState, v: C.Mode) =>
    pose(s, (n) => {
      choose(v, C.MODES);
      n.mode = v;
    }),
  setWorldSize: (s: ReadState, v: C.WorldSize) =>
    pose(s, (n) => {
      choose(v, C.WORLD_SIZES);
      const old = n.coreRow;
      n.worldSize = v;
      n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[v]);
      const grid = emptyGrid(n.coreRow);
      for (let r = 1; r < Math.min(old, n.coreRow); r++)
        for (let c = 0; c < 32; c++) grid[r * 32 + c] = n.grid[r * 32 + c];
      n.grid = grid;
    }),
  setCredits: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, 0);
      n.credits = v;
    }),
  setTier: (s: ReadState, t: C.TrackName, v: number) =>
    pose(s, (n) => {
      choose(t, C.TRACKS);
      number(v, 1, C.MAX_TIER[t]);
      valid(Number.isInteger(v));
      n.tiers[t] = v;
      n.fuel = Math.min(n.fuel, maxFuel(n));
      n.hull = Math.min(n.hull, maxHull(n));
    }),
  setCargo: (s: ReadState, t: C.OreId, v: number) =>
    pose(s, (n) => {
      choose(t, [...C.ORE_IDS, ...C.GEMSTONE_IDS]);
      number(v, 0);
      valid(Number.isInteger(v));
      n.cargo[t] = v;
    }),
  setMaterial: (s: ReadState, t: C.MaterialId, v: number) =>
    pose(s, (n) => {
      choose(t, C.MATERIALS);
      number(v, 0);
      valid(Number.isInteger(v));
      n.satchel[t] = v;
    }),
  setCoreCarried: (s: ReadState, v: boolean) =>
    pose(s, (n) => {
      if (v) {
        valid(n.coreTimer === null);
        n.satchel.coreSample = true;
        n.coreTimer = C.CORE_TIMER;
      } else {
        if (n.satchel.coreSample) n.coreTimer = null;
        n.satchel.coreSample = false;
      }
    }),
  setCoreTimer: (s: ReadState, v: number) =>
    pose(s, (n) => {
      valid(n.coreTimer !== null);
      number(v, Number.MIN_VALUE);
      n.coreTimer = v;
    }),
  setItemCount: (s: ReadState, t: C.ItemId, v: number) =>
    pose(s, (n) => {
      choose(t, C.ITEM_IDS);
      number(v, 0);
      valid(Number.isInteger(v));
      n.items[t] = v;
    }),
  setRocketInstalled: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, 0, 5);
      valid(Number.isInteger(v));
      n.installed = v;
    }),
  setNoticeFired: (s: ReadState, h: C.NoticeHazard, v: boolean) =>
    pose(s, (n) => {
      choose(h, C.NOTICE_HAZARDS);
      n.noticesFired[h] = v;
    }),
  setCameraLead: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, -C.CAM_LEAD_MAX, C.CAM_LEAD_MAX);
      n.lead = v;
    }),
  setElapsed: (s: ReadState, v: number) =>
    pose(s, (n) => {
      number(v, 0);
      n.elapsedSeconds = v;
    }),
  clearSave: (s: ReadState) =>
    pose(s, (n) => {
      clearSave();
      n.hasSave = false;
    }),
  setNextTeleportHeight: (s: ReadState, v: number | null) =>
    pose(s, (n) => {
      if (v !== null)
        number(v, C.TELEPORT_HEIGHT_TILES_MIN, C.TELEPORT_HEIGHT_TILES_MAX);
      n.nextTeleportHeight = v;
    }),
  setNextTeleportSpeed: (s: ReadState, v: number | null) =>
    pose(s, (n) => {
      if (v !== null) number(v, C.TELEPORT_SPEED_MIN, C.TELEPORT_SPEED_MAX);
      n.nextTeleportSpeed = v;
    }),
  dropOre: (s: ReadState, t: C.OreId) =>
    pose(s, (n) => transaction(n, "drop-ore", t)),
  sell: (s: ReadState) => pose(s, (n) => transaction(n, "sell")),
  buyFuel: (s: ReadState) => pose(s, (n) => transaction(n, "buy-fuel")),
  fillFuel: (s: ReadState) => pose(s, (n) => transaction(n, "fill-fuel")),
  buyRepair: (s: ReadState) => pose(s, (n) => transaction(n, "buy-repair")),
  repairFull: (s: ReadState) => pose(s, (n) => transaction(n, "repair-full")),
  buyUpgrade: (s: ReadState, t: C.TrackName) =>
    pose(s, (n) => transaction(n, "buy-upgrade", t)),
  buyItem: (s: ReadState, t: C.ItemId) =>
    pose(s, (n) => transaction(n, "buy-item", t)),
  useItem: (s: ReadState, t: C.ItemId) =>
    pose(s, (n) => transaction(n, "use-item", t)),
  jettison: (s: ReadState) => pose(s, (n) => transaction(n, "jettison")),
  fabricate: (s: ReadState) => pose(s, (n) => transaction(n, "fabricate")),
  launch: (s: ReadState) => pose(s, (n) => transaction(n, "launch")),
  save: (s: ReadState) => pose(s, (n) => transaction(n, "save")),
  dismissNotice: (s: ReadState) =>
    pose(s, (n) => transaction(n, "dismiss-notice")),
};
export type DeepcoreDebugApi = typeof debug;
