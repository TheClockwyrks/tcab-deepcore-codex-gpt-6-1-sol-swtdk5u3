/* global document, EventTarget, KeyboardEvent, Buffer, console */
// Run against the development server after the normal production checks.
// Captures genuine engine drawing; this script never participates in the build.
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => {
  throw e;
});
await page.goto("http://localhost:5173");
await page.waitForTimeout(700);
const captured = await page.evaluate(async () => {
  const { game } = await import("/src/game.ts");
  const { createEngine, ConstantClock } =
    await import("/.vendor/engine/@clockwyrks/simple-2d/dist/index.js");
  const canvas = document.createElement("canvas");
  canvas.id = "stage";
  canvas.style.cssText = "width:100vw;height:100vh;display:block";
  document.getElementById("stage").replaceWith(canvas);
  const target = new EventTarget();
  const engine = createEngine({
    canvas,
    width: 1280,
    height: 720,
    background: "#0b1721",
    game,
    clock: new ConstantClock(1000 / 30),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => target,
    },
  });
  await engine.initialize();
  const d = engine.debug;
  const key = (code, down) =>
    target.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code }),
    );
  const tap = async (code) => {
    key(code, true);
    await engine.advance(1);
    key(code, false);
    await engine.advance(1);
  };
  await tap("Enter");
  await tap("Enter");
  await tap("Enter");
  await engine.advance(130);
  const surface = canvas.toDataURL("image/png");
  engine.apply((s) => d.setCredits(s, 4860));
  for (const track of ["fuel", "hull", "drill", "jetpack", "cargo"])
    engine.apply((s) => d.setTier(s, track, 4));
  engine.apply((s) => d.setFuel(s, 360));
  engine.apply((s) => d.setHull(s, 290));
  for (let r = 1; r <= 100; r++)
    engine.apply((s) => d.setTile(s, 16, r, "tunnel"));
  for (const r of [95, 100])
    for (let c = 12; c <= 23; c++)
      engine.apply((s) => d.setTile(s, c, r, "tunnel"));
  for (let r = 101; r < 108; r++)
    engine.apply((s) =>
      d.setOreTile(s, 18, r, r % 2 ? "cobaltine" : "argenite"),
    );
  for (let c = 19; c < 24; c++)
    engine.apply((s) => d.setOreTile(s, c, 102, "cobaltine"));
  engine.apply((s) => d.setMinerPosition(s, 18 * 80 + 12, 101 * 80 - 72));
  engine.apply((s) => d.setMinerVelocity(s, 0, 0));
  await engine.advance(1);
  engine.startRecording();
  key("KeyS", true);
  await engine.advance(100);
  key("KeyS", false);
  await engine.advance(1);
  const mine = canvas.toDataURL("image/png");
  key("Space", true);
  await engine.advance(65);
  key("Space", false);
  await engine.advance(12);
  const recording = engine.stopRecording();
  const snapshot = d.snapshot(engine.state);
  // A second still shows the molten bands, with an honestly posed field expedition.
  for (let r = 145; r <= 153; r++)
    engine.apply((s) => d.setTile(s, 16, r, "tunnel"));
  for (let c = 12; c <= 22; c++)
    engine.apply((s) => d.setTile(s, c, 150, "tunnel"));
  for (let c = 20; c < 25; c++)
    for (let r = 151; r < 153; r++)
      engine.apply((s) => d.setTile(s, c, r, "lava"));
  engine.apply((s) => d.setOreTile(s, 18, 152, "roselite"));
  engine.apply((s) => d.setMaterialTile(s, 13, 152, "cryenite"));
  engine.apply((s) => d.setMinerPosition(s, 16 * 80 + 12, 151 * 80 - 72));
  engine.apply((s) => d.setMinerVelocity(s, 0, 0));
  await engine.advance(1);
  const deep = canvas.toDataURL("image/png");
  engine.destroy();
  return { surface, mine, deep, recording, snapshot };
});
await mkdir("showcase", { recursive: true });
for (const name of ["surface", "mine", "deep"])
  await writeFile(
    `showcase/${name}.png`,
    Buffer.from(captured[name].split(",")[1], "base64"),
  );
await writeFile(
  "showcase/descent.json.gz",
  gzipSync(JSON.stringify(captured.recording)),
);
console.log(
  JSON.stringify({
    frames: captured.recording.frames.length,
    depth: captured.snapshot.depthMeters,
    screen: captured.snapshot.screen,
  }),
);
await browser.close();
