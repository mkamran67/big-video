# Big Video

> A browser extension that adds an **Expand / Shrink** button below embedded video iframes so you can blow them up to fill the entire viewport with a single click.

Compatible with **Chrome** (MV3) and **Firefox** (126+).

---

## Features

- Detects embedded video iframes automatically (YouTube, Vimeo, Twitch, Dailymotion, Loom, and more)
- Watches for dynamically injected iframes via `MutationObserver` — works on SPAs
- Restores the original iframe dimensions precisely when you shrink it back
- Button sticks to the top of the viewport while expanded so it's always reachable
- Zero dependencies at runtime

---

## Development

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Corepack / Yarn | 4.x (managed via `packageManager` in `package.json`) |

Enable Yarn via Corepack (one-time):

```bash
corepack enable
```

### Install & Build

```bash
# Install dependencies
yarn install

# One-off production build → ./dist
yarn build

# Watch mode (rebuilds on every save)
yarn watch
```

The compiled extension is written to the **`dist/`** directory.

---

## Loading in a Dev Environment

### Chrome

1. Open **`chrome://extensions`** in your browser.
2. Toggle **Developer mode** on (top-right switch).
3. Click **"Load unpacked"**.
4. Select the **`dist/`** folder inside this repo.
5. The extension icon should appear in your toolbar. Reload the tab after any rebuild.

> **Tip:** With `yarn watch` running, just hit the ↺ refresh icon on the extension card in `chrome://extensions` after each save — no need to re-load unpacked.

---

### Firefox

1. Open **`about:debugging#/runtime/this-firefox`** in Firefox.
2. Click **"Load Temporary Add-on…"**.
3. Navigate to the **`dist/`** folder and select **`manifest.json`**.
4. The extension is active until Firefox is closed. Reload it after each rebuild via the **Reload** button on the same page.

> **Note:** Temporary add-ons are removed on browser restart. For persistent dev installs, sign the extension or use [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/).

---

## Project Structure

```
src/
├── content/
│   └── content.ts       # Injected into every page; finds iframes & attaches buttons
├── utils/
│   └── customBtn.ts     # Factory function that creates the styled expand button
├── popup/
│   ├── popup.html
│   └── popup.ts
├── options/
│   ├── options.html
│   └── options.ts
└── manifest.json
```

---

## License

[MIT](LICENSE)
