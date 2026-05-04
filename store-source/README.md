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

## Source Code Build Instructions (for Reviewers)

These instructions outline how to build the extension from source to generate an exact copy of the submitted add-on code.

### 1. Build Environment Requirements
- **Operating System:** Linux or macOS (or Windows via WSL)
- **Node.js:** v18.0.0 or higher
- **System Utilities:** `jq` and `zip` are required by the packaging script.

### 2. Program Installation
- **Node.js**: Download and install from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm` (`nvm install 18`).
- **Yarn**: This project uses Yarn v4. Enable it via Node's Corepack:
  ```bash
  corepack enable
  ```
- **jq & zip**: Install via your system's package manager.
  - Ubuntu/Debian: `sudo apt install jq zip`
  - macOS (Homebrew): `brew install jq zip`

### 3. Step-by-Step Build Instructions

1. Open your terminal and navigate to the root directory of the extracted source code.
2. Install the project dependencies:
   ```bash
   yarn install
   ```
3. Run the automated build and packaging script:
   ```bash
   ./package.sh
   ```

### 4. Build Output
The build script (`package.sh`) will compile the TypeScript code via Webpack, create the production assets in the `dist/` directory, and generate two release packages:
- `releases/big-video-chrome-v[VERSION].zip`
- `releases/big-video-firefox-v[VERSION].zip`

The generated zip files contain the exact replica of the add-on code submitted to the store.

---

## Development Commands

- **Build once:** `yarn build` (outputs to `./dist`)
- **Watch mode:** `yarn watch` (rebuilds on every save)

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
