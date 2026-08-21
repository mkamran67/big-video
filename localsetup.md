# Local Setup

## Requirements

- Node.js 20 or newer
- Corepack
- Chrome or Firefox for local testing

The release process is implemented in Node and does not require `jq`, `zip`, or platform-specific shell scripts.

## Install

```bash
corepack yarn install --immutable
```

## Quality Checks

```bash
corepack yarn test
corepack yarn typecheck
corepack yarn build
corepack yarn test:e2e
```

## Development Builds

Build Chrome into `dist/chrome`:

```bash
corepack yarn build
```

Build Firefox into `dist/firefox`:

```bash
corepack yarn build:firefox
```

Use `corepack yarn watch` while developing the Chrome build.

## Load in Chrome

Open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `dist/chrome`.
Reload the extension and the website tab after rebuilding.

## Load in Firefox

Open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, and select `dist/firefox/manifest.json`.
Reload the temporary extension after rebuilding.

## Create a Release

```bash
corepack yarn package
```

The command runs tests, type checking, both production builds, a loaded-extension Chrome regression, and strict Firefox manifest validation before changing the version.
On success it increments the patch version in `package.json` and creates three deterministic archives:

- `releases/big-video-chrome-vX.Y.Z.zip`
- `releases/big-video-firefox-vX.Y.Z.zip`
- `releases/big-video-firefox-source-vX.Y.Z.zip`

The Firefox source archive contains the source code, tests, dependency lockfile, license, and these build instructions.
A failed release leaves the version and existing release artifacts unchanged.
