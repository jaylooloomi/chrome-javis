# 🦾 Javis — Self-Teaching Browser Agent

**Teach Javis a task once; it watches itself succeed, freezes the run into a reusable skill, and replays it later with no AI calls.**

Javis is a Manifest V3 Chrome extension. You describe a task in natural language; an LLM-driven agent reads the page's DOM and performs the task. As it succeeds, each action is **frozen** into a stable, multi-fallback selector. The result is a named **skill** you can re-run on demand — and replay is **fully deterministic and zero-LLM**, so it's fast, free, and private. The model is only ever called while *learning* a new skill or *self-healing* a broken one.

> This is a focused rebuild of an earlier multi-feature extension. The product was deliberately narrowed to one thing done well — see [the design spec](docs/superpowers/specs/2026-06-14-javis-redefinition-design.md).

## Why this is different

Most "AI browser agents" call the model on **every** action, every run — slow and expensive. Javis calls the model **once to learn**, then compiles the run into a deterministic script:

| | Typical live agent | **Javis** |
|---|---|---|
| Cost per replay | LLM tokens every run | **zero** |
| Speed | model latency each step | DOM-speed |
| Determinism | varies run to run | **stable** |
| Privacy | page sent to model each run | only during learning |
| Resilience | re-reasons each time | stable selectors + **self-heal** fallback |

## How it works

```
Learn (once):   task ──▶ perceive DOM ──▶ LLM picks action ──▶ FREEZE (stable selector) ──▶ execute ──▶ repeat ──▶ Skill
Replay (many):  skill ──▶ resolve selector ──▶ act ──▶ next …            (no LLM)
Self-heal:      selector miss ──▶ perceive + LLM relocate ──▶ re-freeze ──▶ retry ──▶ persist
```

The key idea (and the hard part) is the **freeze translation**: at the moment an action succeeds, the live element is converted into a *bundle* of independent, prioritized selectors — `data-testid` › stable `id` › `name` › ARIA role+name › unique text › structural CSS › XPath. Replay tries them in order, so a skill survives DOM drift; only when **all** fail does self-heal invoke the model.

## Architecture

```
Side Panel (UI + orchestration + LLM + skill store)
   │  messaging
Content Script (DOM: perceive / freeze / execute / replay)   Service Worker (tabs/navigation host)
   │
Core engines (pure, unit-tested):
   selector-engine · replay-engine · recorder · skill-store · dom-serializer · learn-engine · self-heal · llm-client
```

The core engines are framework-free and DOM-pure, so they're covered by **102 jsdom unit tests** (`npm test`). The content script keeps the live `index→element` map in the page; only JSON (DOM text, frozen steps) crosses the messaging boundary.

## Model configuration (model-agnostic)

Javis talks to any **OpenAI-compatible** `/chat/completions` endpoint. In **Settings**, set `baseURL`, `model`, and `apiKey`:

- **Local Ollama (recommended, free, private):** `http://localhost:11434/v1`, model e.g. `qwen3:14b`, no key. Run `ollama serve` and `ollama pull qwen3:14b`.
- **Any cloud key:** point `baseURL`/`apiKey` at your provider's OpenAI-compatible endpoint.
- **page-agent demo (dev only):** `qwen3.5-plus`, no key — evaluation only, routes through third-party servers; never use for real data or a published build.

## Build & load

```bash
npm install
npm run build      # bundles the extension into dist/
```

Then in Chrome:
1. open `chrome://extensions/`
2. enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. open a normal web page (http/https), click the Javis toolbar icon to open the side panel
5. set your model endpoint in **Settings**, then teach a skill

`npm run dev` rebuilds on change (reload the extension in Chrome to pick up changes).

## Develop

```bash
npm test            # run the unit suite (vitest + jsdom)
npm run test:watch  # watch mode
npm run build       # production bundle -> dist/
```

Project layout:

```
src/
  core/        selector-engine, replay-engine, recorder, skill-store,
               dom-serializer, learn-engine, self-heal, llm-client
  content/     content.js            (in-page DOM perceive/freeze/replay)
  background/  service-worker.js     (thin host: side panel, tabs)
  ui/
    sidepanel/ skill library + teach + heal-aware run
    options/   model endpoint config
  shared/      messages, actions, config
tests/         jsdom unit tests (one per core module)
build/         esbuild config
docs/          design spec
```

## Status

- ✅ **Verified** (unit tests + clean build): selector engine, replay engine, recorder, skill store, DOM serializer, learn loop (scripted-LLM), self-heal, LLM client. The extension bundles into a complete, loadable `dist/`.
- ⏳ **Needs real-browser verification**: end-to-end learn/replay against live sites with a real model (Ollama or a cloud key), side-panel/content runtime behavior.
- 🔭 **Planned (next):** parameter capture UI, scheduled skill runs, i18n wiring (assets retained in `i18n/`), API-key encryption at rest (`crypto-utils.js`), Web Store listing.

## License

MIT (includes portions inspired by the MIT-licensed [alibaba/page-agent](https://github.com/alibaba/page-agent): the text-indexed-DOM perception approach). See [LICENSE](LICENSE).
