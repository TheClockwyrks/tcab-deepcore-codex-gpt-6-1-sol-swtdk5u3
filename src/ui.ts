import * as C from "./constants";
import { type ReadState, maxFuel, maxHull, slots, loadKg } from "./model";
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Control {
  action: string;
  subject: string | null;
  label: string;
  detail: string;
  rect: Rect;
  enabled: boolean;
}
export const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export function menuItems(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return s.hasSave ? C.TITLE_ITEMS : C.TITLE_ITEMS.slice(1);
    case "mode-select":
      return C.MODE_ITEMS;
    case "size-select":
      return C.SIZE_ITEMS;
    case "how-to-play":
      return C.HOW_TO_PLAY_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "victory":
      return C.VICTORY_ITEMS;
    case "game-over":
      return s.hasSave && s.mode === "standard"
        ? C.GAME_OVER_SAVE_ITEMS
        : C.GAME_OVER_ITEMS;
    default:
      return [];
  }
}
export const menuRect = (i: number): Rect => ({
  x: 92,
  y: 405 + i * 65,
  w: 400,
  h: 52,
});
export function controls(s: ReadState): Control[] {
  if (s.screen !== "in-mine") return [];
  const list: Control[] = [];
  const add = (
    action: string,
    label: string,
    detail = "",
    enabled = true,
    subject: string | null = null,
  ) => {
    const i = list.filter((c) => c.rect.y > 56).length;
    list.push({
      action,
      subject,
      label,
      detail,
      enabled,
      rect: { x: 240, y: 190 + i * 53, w: 800, h: 45 },
    });
  };
  for (const [i, action] of ["inventory", "pause", "mute"].entries())
    list.push({
      action,
      subject: null,
      label:
        action === "mute"
          ? s.muted
            ? "SOUND OFF"
            : "SOUND ON"
          : action.toUpperCase(),
      detail: "",
      enabled: true,
      rect: { x: 1004 + i * 90, y: 9, w: 84, h: 36 },
    });
  if (s.panel === "fuel-depot") {
    add(
      "buy-fuel",
      `FUEL +${C.FUEL_BUY_INCREMENT}`,
      `${C.FUEL_BUY_INCREMENT * C.FUEL_PRICE} CR`,
      s.credits > 0 && s.fuel < maxFuel(s),
    );
    add(
      "fill-fuel",
      "FILL TANK",
      `${Math.ceil(Math.max(0, maxFuel(s) - s.fuel))} CR`,
      s.credits > 0 && s.fuel < maxFuel(s),
    );
    add(
      "buy-repair",
      `REPAIR +${C.REPAIR_BUY_INCREMENT}`,
      `${C.REPAIR_BUY_INCREMENT * C.REPAIR_PRICE} CR`,
      s.credits > 0 && s.hull < maxHull(s),
    );
    add(
      "repair-full",
      "FULL REPAIR",
      `${Math.ceil(Math.max(0, maxHull(s) - s.hull) * C.REPAIR_PRICE)} CR`,
      s.credits > 0 && s.hull < maxHull(s),
    );
  }
  if (s.panel === "ore-market") {
    const value = C.MINERALS.reduce(
      (n, m) => n + (s.cargo[m.id] ?? 0) * m.value,
      0,
    );
    add("sell", C.SELL, `${slots(s)} minerals · ${value} CR`, value > 0);
  }
  if (s.panel === "upgrade-shop")
    for (const t of C.TRACKS) {
      const tier = s.tiers[t],
        max = tier === C.MAX_TIER[t];
      let desc = "";
      if (t === "fuel") desc = `${C.FUEL_TIERS[tier]} fuel`;
      if (t === "hull") desc = `${C.HULL_TIERS[tier]} hull`;
      if (t === "cargo") desc = `${C.CARGO_TIERS[tier]} slots`;
      if (t === "drill") desc = `power ${tier + 1}`;
      if (t === "jetpack")
        desc = `${C.JETPACK_TIERS[tier]?.liftLimitKg} kg lift`;
      if (t === "radiator")
        desc = `${Math.round((C.RADIATOR_TIERS[tier] ?? 0) * 100)}% protection`;
      if (t === "scanner") desc = `${C.SCANNER_TIERS[tier]} tile range`;
      add(
        "buy-upgrade",
        `${t.toUpperCase()}   /   ${tier}`,
        max ? "MAXIMUM" : `${desc} · ${C.UPGRADE_PRICES[tier - 1]} CR`,
        !max && s.credits >= C.UPGRADE_PRICES[tier - 1],
        t,
      );
    }
  if (s.panel === "supply-depot")
    for (const [i, item] of C.ITEMS.entries())
      add(
        "buy-item",
        `${i + 1}   ${item.name.toUpperCase()}`,
        `${s.items[item.id]} held · ${item.price} CR`,
        s.credits >= item.price,
        item.id,
      );
  if (s.panel === "launch-pad") {
    const part = C.ROCKET_COMPONENTS[s.installed];
    if (part)
      add(
        "fabricate",
        C.FABRICATE,
        `${part.name} · ${part.credits} CR${part.material ? " + " + part.material : ""}`,
        s.credits >= part.credits &&
          (part.material === "core-sample"
            ? s.satchel.coreSample
            : part.material
              ? s.satchel[part.material] > 0
              : true),
      );
    else add("launch", C.LAUNCH, "All systems ready");
  }
  if (s.panel === "inventory") {
    for (const m of C.MINERALS)
      if (s.cargo[m.id])
        add(
          "drop-ore",
          `${m.name} × ${s.cargo[m.id]}`,
          `${m.weightKg} kg each · DROP ONE`,
          true,
          m.id,
        );
    for (const item of C.ITEMS)
      if (s.items[item.id])
        add(
          "use-item",
          `${item.name} × ${s.items[item.id]}`,
          C.USE,
          true,
          item.id,
        );
    if (s.satchel.coreSample)
      add("jettison", C.JETTISON, "Discard unstable Core Sample");
    const rows = list.filter((c) => c.rect.y > 56);
    if (rows.length > 8)
      rows.forEach((c, i) => {
        c.rect = {
          x: 220 + (i % 2) * 430,
          y: 185 + Math.floor(i / 2) * 42,
          w: 410,
          h: 36,
        };
      });
  }
  if (s.notice && s.notice.age >= C.NOTICE_DELAY)
    list.push({
      action: "dismiss-notice",
      subject: null,
      label: "",
      detail: "",
      enabled: true,
      rect: { x: 850, y: 550, w: 400, h: 125 },
    });
  return list;
}
export function inventoryInfo(s: ReadState) {
  return `${loadKg(s) >= C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg ? C.OVERLOAD + " · " : ""}${slots(s)} / ${C.CARGO_TIERS[s.tiers.cargo - 1]} slots   ·   ${loadKg(s)} kg   ·   lift ${C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg} kg`;
}
