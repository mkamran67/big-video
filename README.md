# Big Video

![Big Video App Screenshot](github/Screen%20Shot%202026-05-04%20at%2015.46.05.png)

> A browser extension that adds an **Expand / Shrink** button below embedded video iframes so you can blow them up to fill the entire viewport with a single click.

Compatible with **Chrome** (MV3) and **Firefox** (126+).

---

## What can this extension do?

Big Video is designed to enhance your viewing experience on websites that embed video iframes but do not provide a native full-window mode. When an embedded video is detected, a convenient button is added just below the video. Clicking this button immediately expands the video to fill your entire browser window, without going into full-screen mode, allowing you to multitask or keep other tabs visible while enjoying a larger video. Clicking it again restores the video to its exact original dimensions and placement on the page.

### Features

- **Automatic Detection:** Detects embedded video iframes automatically across various platforms (YouTube, Vimeo, Twitch, Dailymotion, Loom, and more).
- **Dynamic Content Support:** Watches for dynamically injected iframes via `MutationObserver` — ensuring it works flawlessly on Single Page Applications (SPAs) and sites that load videos after the initial page load.
- **Precise Restoration:** Restores the original iframe dimensions precisely when you shrink it back.
- **Always Accessible:** The "Shrink" button sticks to the top of the viewport while the video is expanded, so it's always reachable.
- **Smart Placement:** Handles video iframes nested inside complex layouts seamlessly.
- **Lightweight:** Zero dependencies at runtime for fast performance.

For development instructions, please refer to [localsetup.md](localsetup.md).

---

## License

[MIT](LICENSE)
