# Deepcore

A browser dig-and-build game about the price of coming home. Drill through four strata, collect weighted mineral cargo, fly it back to the surface, and turn your haul into better equipment and a five-part escape rocket. Find the two exotic crystals, then extract an unstable Core Sample and race its 90-second timer back to the launch pad.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local Vite URL. Everything runs locally in your browser; no accounts, backend, or credentials are needed.

```sh
npm run build
npm run preview
```

The complete static site is in `dist/`. Serve that directory with any static server, including from a nested URL. Assets are committed and bundled by Vite. Building never invokes an asset-generation binary.

## Controls

| Input | Action |
| --- | --- |
| A / D or left / right | Walk; drill a wall when grounded |
| S or down | Drill downward |
| W, up, or Space | Hold to thrust |
| E or Enter | Activate a building / confirm selection |
| I | Inventory; drop ore or use a supply |
| 1–6 | Use the corresponding field supply |
| J | Jettison a carried Core Sample |
| Escape or P | Close a panel / pause / resume |
| M | Mute sound |
| Backtick | Engine diagnostics |

Use up/down and Enter in menus and panels. Mouse, pen, and touch also operate menus, panels, buildings, and the status bar. Movement uses the keyboard.

Cargo slots and lift weight are separate limits. Drop ore from inventory if overloaded. The surface does not refill anything for free: sell at the Ore Market, then buy fuel and repairs. Save at the Save Pad. Standard mode retains that save after death; Hardcore deletes it. Browser storage is optional, and the game explains when it cannot save.

## Verification and structure

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

`src/model.ts` owns state and generation, `simulation.ts` the fixed-step rules and transactions, `ui.ts` the shared hit regions, `render.ts` the canvas presentation, and `debug.ts` the immutable automation operations returned through `engine.debug`. `game.ts` binds them to Simple 2D's assets, input, audio, diagnostics, and frame loop. Tests include counted-clock engine runs over a native canvas.

All pixel art, eight prospector animation cycles, twelve particle systems, sound effects, and the music were authored for this game. The one-time authoring scripts in `tools/assets.py` and `tools/sound-fx.py` document their construction with `draw`, `draw-sheet`, `particle-2d`, `sfx-synth`, `sfx-sample`, and `music`. The resulting files under `assets/` are the shipped assets. Those scripts require the authoring environment and are never part of installation or production builds.

`showcase/` contains player-facing copy, screenshots, and a genuine engine recording. To recapture it while the Vite development server is running, use `node tools/capture.mjs`; this uses project-local Playwright and Chromium with `--no-sandbox`.
