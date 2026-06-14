# ⚡ Snapfill — Private AI Form Filler & Autofill

**Autofill any web form in one click from your saved profile — privately, on-device. Your data never leaves your browser.**

Snapfill is a Manifest V3 Chrome extension. It reads the form on the current page, uses an AI to map your saved profile to the right fields, shows you a preview, and fills it on your confirmation. The mapping can run on **Chrome's built-in Gemini Nano** (on-device, free, offline) or any OpenAI-compatible endpoint. The actual filling is plain, deterministic JavaScript — no AI at the writing step.

## Why Snapfill

- **Private by default** — with on-device Nano, the form and your profile never leave your machine.
- **One click** — no per-site setup; it matches your profile to whatever form is in front of you.
- **You stay in control** — preview every field before it fills, passwords are never touched, and nothing is submitted automatically.
- **Model-agnostic** — Nano-first, with fallback to any OpenAI-compatible endpoint (local Ollama or a cloud key).

## How it works

```
read DOM  ──▶  AI maps profile → fields  ──▶  preview  ──▶  (confirm)  ──▶  JS fills the fields
(content)      (Nano or endpoint; the only AI step)                        (deterministic, no AI)
```

1. **Read DOM** — `serializeForm()` collects each fillable field (label, type, required, select options).
2. **Map (the one AI step)** — the model receives your profile + the field list and returns `{ field → value }`. Semantic matching is exactly what a small on-device model is good at.
3. **Preview & confirm** — you see field → value before anything changes.
4. **Fill** — plain JS sets values and fires `input`/`change` events (so React/Vue forms react). No AI here.

## Install & use

```bash
npm install
npm run build      # bundles the extension into dist/
```

In Chrome: `chrome://extensions/` → **Developer mode** → **Load unpacked** → select `dist/`.

Then:
1. Open **Settings** (gear icon) → fill in your **Profile** (name, email, address, custom fields). It's encrypted on this device.
2. Pick a **form-fill model** — *Auto* uses on-device Nano if available, otherwise your endpoint. (Set the endpoint under *Model*; default `minimax-m2.5:cloud` via local Ollama.)
3. On any page with a form, click **⚡ Fill this form** in the side panel (or press **Alt+Shift+F**) → review the preview → **Confirm fill**.

> On-device Nano needs Chrome with built-in AI and a one-time model download. If unavailable, *Auto* silently uses your configured endpoint.

## Develop

```bash
npm test            # unit suite (vitest + jsdom)
npm run test:watch
npm run build       # production bundle -> dist/
```

```
src/
  core/        form-fill, dom-serializer (serializeForm), nano-client,
               llm-client, selector-engine (accessible-name util)
  content/     content.js   (serialize form / apply fill in the page)
  background/  service-worker.js (open side panel, Alt+Shift+F command)
  ui/
    sidepanel/ Fill this form + preview/confirm
    options/   profile editor, model + form-fill provider, Nano status
  shared/      messages, config, profile, crypto-utils (encrypt at rest)
tests/         jsdom unit tests
```

## Status

- ✅ Unit-tested + clean build: form serialization, profile→field mapping/validation/apply, Nano provider (with endpoint fallback), profile store, model client.
- ⏳ Needs a real-Chrome pass: end-to-end fill on live sites with a real model.
- 🔭 Possible next: site-specific field memory, multi-profile, more locales.

## License

MIT. Includes an accessible-name/DOM utility inspired by the MIT-licensed [alibaba/page-agent](https://github.com/alibaba/page-agent). See [LICENSE](LICENSE).
