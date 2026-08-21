# Big Video

![Big Video popup](github/Screen%20Shot%202026-05-04%20at%2015.46.05.png)

Big Video is a Manifest V3 browser extension that fits native and embedded website videos to the browser viewport without cropping or stretching them.
Browser tabs and toolbars remain visible, and one click restores the page to its original layout.

## Features

- Detects native videos and deeply nested player frames.
- Preserves landscape, portrait, square, and provider-reported aspect ratios.
- Handles dynamically inserted players, delayed iframe sources, and open shadow roots.
- Provides a remembered manual player picker when automatic detection is uncertain.
- Supports per-site auto-expand, auto-shrink, and hidden-page-element settings.
- Runs on current Chrome, Firefox, and Firefox ESR releases.
- Collects and transmits no user data.

## Development

Install dependencies with `corepack yarn install`.
Run unit tests with `corepack yarn test`.
Run type checking with `corepack yarn typecheck`.
Build Chrome with `corepack yarn build` and Firefox with `corepack yarn build:firefox`.
Run the loaded-extension Chrome regression with `corepack yarn test:e2e` after building Chrome.

See [localsetup.md](localsetup.md) for browser loading, testing, and release instructions.

## License

[MIT](LICENSE)
