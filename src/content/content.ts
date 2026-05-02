import { createExpandButton } from "../utils/customBtn";

type ButtonPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const Z_TOP = 2147483647;
const BTN_SIZE = 36;
const BTN_MARGIN = 10;
const STORAGE_KEY = "buttonPosition";
const STORAGE_KEY_SHRINK = "autoShrinkOnEnd";
const HIDDEN_PREFIX = "bv_hidden_";
const AUTO_EXPAND_PREFIX = "autoExpand_";
const DEFAULT_POSITION: ButtonPosition = "top-right";
const domain = window.location.hostname;

let currentPosition: ButtonPosition = DEFAULT_POSITION;
let autoShrinkOnEnd: boolean = false;
let autoExpandOnDomain: boolean = false;
let autoExpandFired: boolean = false; // ensure only first iframe auto-expands per page load
const repositionFns: Array<() => void> = [];

chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_POSITION, [HIDDEN_PREFIX + domain]: [], [STORAGE_KEY_SHRINK]: false, [AUTO_EXPAND_PREFIX + domain]: false }, (result) => {
  currentPosition = result[STORAGE_KEY] as ButtonPosition;
  cachedHiddenSelectors = result[HIDDEN_PREFIX + domain] as string[];
  autoShrinkOnEnd = result[STORAGE_KEY_SHRINK] as boolean;
  autoExpandOnDomain = result[AUTO_EXPAND_PREFIX + domain] as boolean;
  repositionFns.forEach((fn) => fn());
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes[STORAGE_KEY]) {
    currentPosition = changes[STORAGE_KEY].newValue as ButtonPosition;
    repositionFns.forEach((fn) => fn());
  }
  if (changes[HIDDEN_PREFIX + domain]) {
    cachedHiddenSelectors = changes[HIDDEN_PREFIX + domain].newValue as string[];
  }
  if (changes[STORAGE_KEY_SHRINK]) {
    autoShrinkOnEnd = changes[STORAGE_KEY_SHRINK].newValue as boolean;
  }
  if (changes[AUTO_EXPAND_PREFIX + domain]) {
    autoExpandOnDomain = changes[AUTO_EXPAND_PREFIX + domain].newValue as boolean;
    // Reset fired flag whenever the setting is toggled so a new decision takes effect
    if (!autoExpandOnDomain) autoExpandFired = false;
  }
});

// ─── Style override helpers ───────────────────────────────────────────────────

interface StyleOverride {
  element: HTMLElement;
  property: string;
  savedValue: string;
  savedPriority: string;
}

function makeOverride(el: HTMLElement, prop: string, value: string, bag: StyleOverride[]): void {
  bag.push({ element: el, property: prop, savedValue: el.style.getPropertyValue(prop), savedPriority: el.style.getPropertyPriority(prop) });
  el.style.setProperty(prop, value, "important");
}

function restoreBag(bag: StyleOverride[]): void {
  for (const o of bag) {
    o.savedValue !== ""
      ? o.element.style.setProperty(o.property, o.savedValue, o.savedPriority || "")
      : o.element.style.removeProperty(o.property);
  }
  bag.length = 0;
}

// ─── Hidden selector cache (populated at init, kept in sync with storage) ───

let cachedHiddenSelectors: string[] = [];

// ─── Stacking context suppression ────────────────────────────────────────────

const stackingOverrides: StyleOverride[] = [];

function suppressPageStacking(iframe: HTMLIFrameElement): void {
  let ancestor: HTMLElement | null = iframe.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const cs = window.getComputedStyle(ancestor);
    if (cs.transform !== "none")    makeOverride(ancestor, "transform", "none", stackingOverrides);
    if (cs.filter !== "none")       makeOverride(ancestor, "filter", "none", stackingOverrides);
    if (cs.perspective !== "none")  makeOverride(ancestor, "perspective", "none", stackingOverrides);
    if (cs.isolation === "isolate") makeOverride(ancestor, "isolation", "auto", stackingOverrides);
    if (cs.willChange !== "auto")   makeOverride(ancestor, "will-change", "auto", stackingOverrides);
    const bf = cs.getPropertyValue("backdrop-filter");
    if (bf && bf !== "none")        makeOverride(ancestor, "backdrop-filter", "none", stackingOverrides);
    ancestor = ancestor.parentElement;
  }
  makeOverride(document.body, "position", "relative", stackingOverrides);
  makeOverride(document.body, "z-index", "1", stackingOverrides);
}

// ─── Hidden-element selector management ──────────────────────────────────────

let hiddenStyleEl: HTMLStyleElement | null = null;

/** Inject a <style> tag that hides all saved selectors with !important rules.
 *  A style tag wins against every cascade layer, including !important in stylesheets. */
function buildHiddenCSS(selectors: string[]): string {
  return selectors
    .map((sel) => `${sel} { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }`)
    .join("\n");
}

function applyHiddenSelectors(): void {
  if (cachedHiddenSelectors.length === 0) return;
  // Remove any previously injected tag before creating a new one so repeated
  // expand → shrink → expand cycles don't accumulate orphaned <style> tags.
  hiddenStyleEl?.remove();
  hiddenStyleEl = document.createElement("style");
  hiddenStyleEl.setAttribute("data-bv-hidden", "true");
  hiddenStyleEl.textContent = buildHiddenCSS(cachedHiddenSelectors);
  document.head.appendChild(hiddenStyleEl);
}

/** Patch the live <style> tag so elements hide/show immediately while expanded. */
function refreshHiddenSelectors(selectors: string[]): void {
  if (!hiddenStyleEl) return; // not currently expanded — nothing to do
  hiddenStyleEl.textContent = buildHiddenCSS(selectors);
}

function removeHiddenSelectors(): void {
  hiddenStyleEl?.remove();
  hiddenStyleEl = null;
}

// ─── CSS selector generator ───────────────────────────────────────────────────

function generateSelector(target: HTMLElement): string {
  if (target.id) {
    const s = `#${CSS.escape(target.id)}`;
    try { if (document.querySelectorAll(s).length === 1) return s; } catch { /**/ }
  }
  const path: string[] = [];
  let el: HTMLElement | null = target;
  while (el && el.tagName !== "HTML" && el.tagName !== "BODY") {
    let part = el.tagName.toLowerCase();
    if (el.id) { path.unshift(`#${CSS.escape(el.id)}`); break; }
    const classes = Array.from(el.classList)
      .filter((c) => c.length > 1 && !/^\d/.test(c))
      .slice(0, 2);
    if (classes.length) part += "." + classes.map((c) => CSS.escape(c)).join(".");
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === el!.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(el) + 1})`;
    }
    path.unshift(part);
    try { if (document.querySelectorAll(path.join(" > ")).length === 1) break; } catch { /**/ }
    el = el.parentElement;
  }
  return path.join(" > ");
}

// ─── Picker mode ──────────────────────────────────────────────────────────────

let pickerActive = false;
let pickerBanner: HTMLElement | null = null;
let pickerStyle: HTMLStyleElement | null = null;
let hoveredEl: HTMLElement | null = null;
let pickerSelectors: Set<string> = new Set();

function onHover(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (pickerBanner?.contains(t)) return;
  hoveredEl?.removeAttribute("data-bv-hover");
  hoveredEl = t;
  t.setAttribute("data-bv-hover", "true");
}
function onOut(e: MouseEvent): void {
  (e.target as HTMLElement).removeAttribute("data-bv-hover");
}
function onPickerClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  if (pickerBanner?.contains(t)) return;
  e.preventDefault(); e.stopPropagation();
  const sel = generateSelector(t);
  if (pickerSelectors.has(sel)) {
    pickerSelectors.delete(sel);
    document.querySelectorAll(`[data-bv-selected]`).forEach((el) => {
      if (generateSelector(el as HTMLElement) === sel) el.removeAttribute("data-bv-selected");
    });
  } else {
    pickerSelectors.add(sel);
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.setAttribute("data-bv-selected", "true"));
  }
  // Immediately hide/show the element if the video is currently expanded.
  refreshHiddenSelectors(Array.from(pickerSelectors));
}
function onPickerKey(e: KeyboardEvent): void { if (e.key === "Escape") stopPicker(); }

function stopPicker(): void {
  if (!pickerActive) return;
  pickerActive = false;
  // Update the cache immediately so the next expand uses the new selectors
  // without waiting for storage.onChanged to fire.
  cachedHiddenSelectors = Array.from(pickerSelectors);
  chrome.storage.sync.set({ [HIDDEN_PREFIX + domain]: cachedHiddenSelectors });
  // If the video is currently expanded, patch the live <style> tag immediately
  // so elements disappear without requiring a shrink → re-expand cycle.
  refreshHiddenSelectors(cachedHiddenSelectors);
  document.querySelectorAll("[data-bv-hover],[data-bv-selected]").forEach((el) => {
    el.removeAttribute("data-bv-hover"); el.removeAttribute("data-bv-selected");
  });
  pickerStyle?.remove(); pickerStyle = null;
  pickerBanner?.remove(); pickerBanner = null;
  hoveredEl = null;
  document.removeEventListener("mouseover", onHover, true);
  document.removeEventListener("mouseout", onOut, true);
  document.removeEventListener("click", onPickerClick, true);
  document.removeEventListener("keydown", onPickerKey, true);
}

function startPicker(): void {
  if (pickerActive) return;
  pickerActive = true;

  // Reset the working set immediately (before the async storage read) so that
  // clicks registered before the callback fires are not lost when the Set
  // reference is replaced.
  pickerSelectors = new Set(cachedHiddenSelectors);
  pickerSelectors.forEach((sel) => {
    try { document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.setAttribute("data-bv-selected", "true")); } catch { /**/ }
  });

  // Sync with storage in case another tab updated the list after our last
  // cachedHiddenSelectors refresh, then merge any extra selectors in.
  chrome.storage.sync.get({ [HIDDEN_PREFIX + domain]: [] }, (result) => {
    const stored = result[HIDDEN_PREFIX + domain] as string[];
    stored.forEach((sel) => {
      if (!pickerSelectors.has(sel)) {
        pickerSelectors.add(sel);
        try { document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.setAttribute("data-bv-selected", "true")); } catch { /**/ }
      }
    });
  });

  pickerStyle = document.createElement("style");
  pickerStyle.textContent = `
    [data-bv-hover]    { outline: 3px solid #5566ff !important; outline-offset: 2px !important; cursor: crosshair !important; }
    [data-bv-selected] { outline: 3px solid #22cc77 !important; outline-offset: 2px !important; }
  `;
  document.head.appendChild(pickerStyle);

  pickerBanner = document.createElement("div");
  pickerBanner.setAttribute("data-bv-banner", "true");
  Object.assign(pickerBanner.style, {
    position: "fixed", top: "0", left: "0", right: "0",
    zIndex: String(Z_TOP), background: "linear-gradient(135deg,#1a1a3e,#0d0d20)",
    color: "#dde0ff", padding: "10px 16px", display: "flex",
    alignItems: "center", gap: "10px",
    fontFamily: "system-ui,-apple-system,sans-serif", fontSize: "13px",
    borderBottom: "1px solid rgba(100,100,255,0.3)",
    boxShadow: "0 2px 20px rgba(0,0,0,0.5)",
  });

  const label = document.createElement("span");
  label.innerHTML = "🎯 <strong>Picker Mode</strong> — click elements to <strong>hide</strong> when expanded · click again to deselect · <kbd>Esc</kbd> to finish";
  label.style.flex = "1";

  const done = document.createElement("button");
  done.textContent = "✓ Done";
  Object.assign(done.style, {
    padding: "5px 14px", background: "rgba(80,80,220,0.35)",
    border: "1px solid rgba(120,120,255,0.5)", borderRadius: "6px",
    color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "700",
  });
  done.addEventListener("click", stopPicker);

  pickerBanner.appendChild(label);
  pickerBanner.appendChild(done);
  document.body.appendChild(pickerBanner);

  document.addEventListener("mouseover", onHover, true);
  document.addEventListener("mouseout", onOut, true);
  document.addEventListener("click", onPickerClick, true);
  document.addEventListener("keydown", onPickerKey, true);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "startPicker") startPicker();
  if (msg.action === "stopPicker") stopPicker();
});

// ─── Shrink button ────────────────────────────────────────────────────────────

function createShrinkButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute("data-big-video-shrink", "true");
  btn.title = "Restore original size";
  btn.innerText = "✕";
  Object.assign(btn.style, {
    position: "fixed", zIndex: String(Z_TOP), display: "none",
    width: `${BTN_SIZE}px`, height: `${BTN_SIZE}px`, padding: "0",
    background: "rgba(10,10,20,0.75)", backdropFilter: "blur(8px)",
    color: "#e0e0ff", border: "1px solid rgba(120,120,255,0.4)", borderRadius: "50%",
    cursor: "pointer", fontSize: "16px", lineHeight: "1",
    boxShadow: "0 4px 16px rgba(0,0,0,0.5)", fontFamily: "system-ui,-apple-system,sans-serif",
    transition: "opacity 180ms,transform 180ms,background 180ms", opacity: "0.85",
  });
  btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; btn.style.transform = "scale(1.1)"; btn.style.background = "rgba(30,30,60,0.9)"; });
  btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.85"; btn.style.transform = "scale(1)"; btn.style.background = "rgba(10,10,20,0.75)"; });
  return btn;
}

// ─── Iframe detection helpers ─────────────────────────────────────────────────

const handledIframes = new WeakSet<HTMLIFrameElement>();
const VIDEO_SRC_PATTERNS = [
  /youtube\.com\/embed/, /youtu\.be/, /vimeo\.com\/video/, /player\.vimeo\.com/,
  /dailymotion\.com\/embed/, /twitch\.tv\/embed/, /facebook\.com\/plugins\/video/,
  /instagram\.com\/p\//, /tiktok\.com\/embed/, /rumble\.com\/embed/,
  /odysee\.com\/\$/, /bitchute\.com\/embed/, /streamable\.com\/e\//,
  /wistia\.com\/embed/, /loom\.com\/embed/, /drive\.google\.com\/file/,
];

function looksLikeVideoFrame(iframe: HTMLIFrameElement): boolean {
  const src = iframe.src || iframe.getAttribute("src") || "";
  if (!src) return false;
  const allow = iframe.getAttribute("allow") || "";
  if (/autoplay|fullscreen|picture-in-picture/i.test(allow)) return true;
  return VIDEO_SRC_PATTERNS.some((re) => re.test(src));
}

// ─── Core: attach overlay buttons to a video iframe ───────────────────────────

function attachButton(iframe: HTMLIFrameElement): void {
  if (handledIframes.has(iframe)) return;
  handledIframes.add(iframe);

  const expandBtn = createExpandButton();
  const shrinkBtn = createShrinkButton();
  document.body.appendChild(expandBtn);
  document.body.appendChild(shrinkBtn);

  /** Positions both the expand button (when visible) and the shrink button
   *  (when visible) to the current corner. Safe to call at any time. */
  const updateBtnPositions = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ── Expand button: tracks the iframe corner while not expanded ──
    const rect = iframe.getBoundingClientRect();
    const inViewport = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
    if (expandBtn.style.display !== "none") {
      expandBtn.style.visibility = inViewport ? "visible" : "hidden";
    }
    const btnTop  = currentPosition.startsWith("top")  ? rect.top    + BTN_MARGIN : rect.bottom - BTN_SIZE - BTN_MARGIN;
    const btnLeft = currentPosition.endsWith("left")   ? rect.left   + BTN_MARGIN : rect.right  - BTN_SIZE - BTN_MARGIN;
    expandBtn.style.top  = `${btnTop}px`;
    expandBtn.style.left = `${btnLeft}px`;

    // ── Shrink button: tracks the chosen corner of the full viewport ──
    const sTop  = currentPosition.startsWith("top")  ? BTN_MARGIN                  : vh - BTN_SIZE - BTN_MARGIN;
    const sLeft = currentPosition.endsWith("left")   ? BTN_MARGIN                  : vw - BTN_SIZE - BTN_MARGIN;
    shrinkBtn.style.top  = `${sTop}px`;
    shrinkBtn.style.left = `${sLeft}px`;
    // Clear old inset shorthands set by the original hardcoded style.
    shrinkBtn.style.right  = "";
    shrinkBtn.style.bottom = "";
  };

  // Alias so existing repositionFns registration still works.
  const updateExpandBtnPos = updateBtnPositions;

  repositionFns.push(updateBtnPositions);
  requestAnimationFrame(updateBtnPositions);
  window.addEventListener("scroll", updateBtnPositions, { passive: true, capture: true });
  window.addEventListener("resize", updateBtnPositions, { passive: true });
  new ResizeObserver(updateBtnPositions).observe(document.body);

  const savedStyles = {
    width: iframe.style.width, height: iframe.style.height, position: iframe.style.position,
    top: iframe.style.top, left: iframe.style.left, right: iframe.style.right,
    bottom: iframe.style.bottom, zIndex: iframe.style.zIndex,
    maxWidth: iframe.style.maxWidth, maxHeight: iframe.style.maxHeight,
  };

  const expand = () => {
    suppressPageStacking(iframe);
    applyHiddenSelectors();

    iframe.style.position = "fixed";
    iframe.style.top = "0"; iframe.style.left = "0";
    iframe.style.right = "0"; iframe.style.bottom = "0";
    iframe.style.width = "100vw"; iframe.style.height = "100vh";
    iframe.style.maxWidth = "100vw"; iframe.style.maxHeight = "100vh";
    iframe.style.zIndex = String(Z_TOP);

    expandBtn.style.display = "none";
    shrinkBtn.style.display = "flex";
    shrinkBtn.style.alignItems = "center";
    shrinkBtn.style.justifyContent = "center";
    updateBtnPositions(); // position shrink btn to correct corner immediately
  };

  const shrink = () => {
    restoreBag(stackingOverrides);
    removeHiddenSelectors();

    iframe.style.position = savedStyles.position || "";
    iframe.style.top = savedStyles.top || ""; iframe.style.left = savedStyles.left || "";
    iframe.style.right = savedStyles.right || ""; iframe.style.bottom = savedStyles.bottom || "";
    iframe.style.width = savedStyles.width || ""; iframe.style.height = savedStyles.height || "";
    iframe.style.maxWidth = savedStyles.maxWidth || ""; iframe.style.maxHeight = savedStyles.maxHeight || "";
    iframe.style.zIndex = savedStyles.zIndex || "";

    shrinkBtn.style.display = "none";
    expandBtn.style.display = "flex";
    requestAnimationFrame(updateExpandBtnPos);
  };

  // ── Auto-shrink on video end ──────────────────────────────────────────────
  // Four independent strategies fire in parallel; whichever triggers first wins.

  let autoShrinkVideoEl: HTMLVideoElement | null = null;
  let autoShrinkMsgHandler: ((e: MessageEvent) => void) | null = null;
  let autoShrinkPollId: ReturnType<typeof setInterval> | null = null;
  let autoShrinkTriggered = false; // prevent double-shrink if multiple strategies fire at once

  /** Called by any strategy when it detects the video has ended. */
  function onVideoEnded(): void {
    if (!autoShrinkOnEnd || shrinkBtn.style.display === "none") return;
    if (autoShrinkTriggered) return;
    autoShrinkTriggered = true;
    detachAutoShrinkListeners();
    shrink();
  }

  function attachAutoShrinkListeners(): void {
    if (!autoShrinkOnEnd) return;
    autoShrinkTriggered = false;

    // ── Strategy 1: Same-origin — attach `ended` event + near-end poll ──────
    try {
      const doc = iframe.contentDocument;
      if (doc) {
        const vid = doc.querySelector<HTMLVideoElement>("video");
        if (vid) {
          autoShrinkVideoEl = vid;
          vid.addEventListener("ended", onVideoEnded, { once: true });

          // Poll fallback: catches cases where `ended` already fired or is unreliable.
          autoShrinkPollId = setInterval(() => {
            if (!vid.duration || vid.paused || vid.ended) {
              if (vid.ended) onVideoEnded();
              return;
            }
            // Trigger when within 0.5 s of the end.
            if (vid.duration - vid.currentTime <= 0.5) onVideoEnded();
          }, 500);
        }
      }
    } catch {
      // Cross-origin — expected.
    }

    // ── Strategy 2: YouTube — inject enablejsapi + send listening handshake ──
    // Without enablejsapi=1 in the src, YouTube won't emit postMessage events.
    const src = iframe.src;
    if (/youtube\.com\/embed|youtu\.be/.test(src) && iframe.contentWindow) {
      try {
        const url = new URL(src);
        if (!url.searchParams.has("enablejsapi")) {
          url.searchParams.set("enablejsapi", "1");
          // Reassigning src reloads the iframe, so only do it once per session.
          if (!iframe.dataset.bvJsApi) {
            iframe.dataset.bvJsApi = "1";
            iframe.src = url.toString();
          }
        }
        // Send the listening handshake after a short delay (allow the player to load).
        setTimeout(() => {
          iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
        }, 1500);
      } catch { /* invalid URL */ }
    }

    // ── Strategy 3: postMessage — all major platforms ─────────────────────────
    autoShrinkMsgHandler = (e: MessageEvent) => {
      if (shrinkBtn.style.display === "none") return;
      try {
        let parsed: Record<string, unknown> | null = null;

        if (typeof e.data === "string") {
          try { parsed = JSON.parse(e.data) as Record<string, unknown>; } catch { return; }
        } else if (typeof e.data === "object" && e.data !== null) {
          parsed = e.data as Record<string, unknown>;
        }

        if (!parsed) return;

        // YouTube IFrame API: playerState 0 = ended
        //   With enablejsapi: { event:"onStateChange", info:0 }
        //   Also seen:        { event:"infoDelivery", info:{ playerState:0 } }
        if (parsed["event"] === "onStateChange" && parsed["info"] === 0) { onVideoEnded(); return; }
        if (parsed["event"] === "infoDelivery") {
          const info = parsed["info"] as Record<string, unknown> | undefined;
          if (info && info["playerState"] === 0) { onVideoEnded(); return; }
        }

        // Vimeo Player SDK: { event:"finish" } or { method:"finish" }
        if (parsed["event"] === "finish" || parsed["method"] === "finish") { onVideoEnded(); return; }

        // Dailymotion: { type:"video_end" }
        if (parsed["type"] === "video_end") { onVideoEnded(); return; }

        // Twitch / generic: look for a "ended" or "end" signal
        if (parsed["type"] === "video.ended" || parsed["event"] === "ended" || parsed["event"] === "end") { onVideoEnded(); return; }

        // Wistia: { type:"betweentimes", ... } — no clean ended event; rely on poll.
        // Streamable / Loom / others: check for a "complete" field
        if (parsed["event"] === "complete" || parsed["type"] === "complete") { onVideoEnded(); return; }

      } catch { /* ignore */ }
    };
    window.addEventListener("message", autoShrinkMsgHandler);
  }

  function detachAutoShrinkListeners(): void {
    if (autoShrinkVideoEl) {
      autoShrinkVideoEl.removeEventListener("ended", onVideoEnded);
      autoShrinkVideoEl = null;
    }
    if (autoShrinkMsgHandler) {
      window.removeEventListener("message", autoShrinkMsgHandler);
      autoShrinkMsgHandler = null;
    }
    if (autoShrinkPollId !== null) {
      clearInterval(autoShrinkPollId);
      autoShrinkPollId = null;
    }
  }

  expandBtn.addEventListener("click", () => { expand(); attachAutoShrinkListeners(); });
  shrinkBtn.addEventListener("click", () => { detachAutoShrinkListeners(); shrink(); });

  // ── Auto-expand on domain ────────────────────────────────────────────────
  // Delay slightly to ensure the iframe is rendered before we expand.
  if (autoExpandOnDomain && !autoExpandFired) {
    autoExpandFired = true;
    requestAnimationFrame(() => { expand(); attachAutoShrinkListeners(); });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shrinkBtn.style.display !== "none") {
      detachAutoShrinkListeners();
      shrink();
    }
  });
}

// ─── Discovery ────────────────────────────────────────────────────────────────

function scanForVideoFrames(): void {
  document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
    if (looksLikeVideoFrame(iframe)) attachButton(iframe);
  });
}

scanForVideoFrames();
const observer = new MutationObserver(scanForVideoFrames);
observer.observe(document.documentElement, { childList: true, subtree: true });
