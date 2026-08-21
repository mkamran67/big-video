import { createExpandButton } from "../utils/customBtn";
import { calculateContainedRect, resolveAspectRatio, scoreIframeCandidate } from "./media";

type ButtonPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type MediaElement = HTMLVideoElement | HTMLIFrameElement;
type PickerMode = "hide" | "player";

interface FrameMessage {
  source: "big-video";
  type: "media-report" | "media-clear" | "expand" | "shrink" | "ended" | "start-player-picker" | "stop-picker" | "player-picked";
  ratio?: number;
  confidence?: number;
}

interface StyleOverride {
  element: HTMLElement;
  property: string;
  savedValue: string;
  savedPriority: string;
}

interface Target {
  element: MediaElement;
  ratio: number;
  confidence: number;
  nested: boolean;
  expandButton?: HTMLButtonElement;
  shrinkButton?: HTMLButtonElement;
  overrides: StyleOverride[];
  cleanup: Array<() => void>;
}

const Z_TOP = 2147483647;
const BTN_SIZE = 38;
const BTN_MARGIN = 12;
const STORAGE_POSITION = "buttonPosition";
const STORAGE_SHRINK = "autoShrinkOnEnd";
const HIDDEN_PREFIX = "bv_hidden_";
const AUTO_EXPAND_PREFIX = "autoExpand_";
const PLAYER_PREFIX = "bv_player_";
const DEFAULT_POSITION: ButtonPosition = "top-right";
const domain = window.location.hostname;
const isTop = window === window.top;

let currentPosition: ButtonPosition = DEFAULT_POSITION;
let autoShrinkOnEnd = false;
let autoExpandOnDomain = false;
let autoExpandFired = false;
let cachedHiddenSelectors: string[] = [];
let rememberedPlayerSelector = "";
let activeTarget: Target | null = null;
let hiddenStyleEl: HTMLStyleElement | null = null;
let backdrop: HTMLDivElement | null = null;
let pickerMode: PickerMode | null = null;
let pickerBanner: HTMLDivElement | null = null;
let pickerStyle: HTMLStyleElement | null = null;
let hoveredPickerElement: HTMLElement | null = null;
const targets = new Map<MediaElement, Target>();
const childTargets = new Map<HTMLIFrameElement, Target>();
const observedRoots = new WeakSet<Document | ShadowRoot>();
let positionFrame = 0;

function postToParent(message: FrameMessage): void {
  if (!isTop) window.parent.postMessage(message, "*");
}

function postToChild(iframe: HTMLIFrameElement, message: FrameMessage): void {
  iframe.contentWindow?.postMessage(message, "*");
}

function directChildFor(source: MessageEventSource | null): HTMLIFrameElement | null {
  if (!source) return null;
  for (const iframe of deepElements<HTMLIFrameElement>(document, "iframe")) {
    if (iframe.contentWindow === source) return iframe;
  }
  return null;
}

function deepElements<T extends Element>(root: Document | ShadowRoot, selector: string): T[] {
  const matches = Array.from(root.querySelectorAll<T>(selector));
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (element.shadowRoot) matches.push(...deepElements<T>(element.shadowRoot, selector));
  }
  return matches;
}

function isVisibleMedia(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 68) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
}

function iframeClassContext(iframe: HTMLIFrameElement): string {
  const values: string[] = [];
  let current: HTMLElement | null = iframe;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    values.push(current.id, typeof current.className === "string" ? current.className : "");
    current = current.parentElement;
  }
  return values.join(" ");
}

function ratioForElement(element: MediaElement, reportedRatio?: number): number {
  const rect = element.getBoundingClientRect();
  return resolveAspectRatio({
    intrinsicWidth: element instanceof HTMLVideoElement ? element.videoWidth : undefined,
    intrinsicHeight: element instanceof HTMLVideoElement ? element.videoHeight : undefined,
    reportedRatio,
    renderedWidth: rect.width,
    renderedHeight: rect.height,
    attributeWidth: Number(element.getAttribute("width")),
    attributeHeight: Number(element.getAttribute("height")),
  });
}

function candidateConfidence(element: MediaElement): number {
  if (element instanceof HTMLVideoElement) return isVisibleMedia(element) ? 100 : -100;
  const rect = element.getBoundingClientRect();
  return scoreIframeCandidate({
    src: element.src || element.getAttribute("src") || "",
    allow: element.allow,
    title: element.title,
    name: element.name,
    id: element.id,
    className: element.className,
    ancestorClassName: iframeClassContext(element),
    width: rect.width,
    height: rect.height,
  });
}

function primaryTarget(): Target | null {
  return [...targets.values()]
    .filter((target) => target.element.isConnected && isVisibleMedia(target.element))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const aRect = a.element.getBoundingClientRect();
      const bRect = b.element.getBoundingClientRect();
      return bRect.width * bRect.height - aRect.width * aRect.height;
    })[0] ?? null;
}

function setOverride(element: HTMLElement, property: string, value: string, bag: StyleOverride[]): void {
  if (bag.some((override) => override.element === element && override.property === property)) {
    element.style.setProperty(property, value, "important");
    return;
  }
  bag.push({ element, property, savedValue: element.style.getPropertyValue(property), savedPriority: element.style.getPropertyPriority(property) });
  element.style.setProperty(property, value, "important");
}

function restoreOverrides(bag: StyleOverride[]): void {
  for (const override of bag.reverse()) {
    if (override.savedValue) override.element.style.setProperty(override.property, override.savedValue, override.savedPriority);
    else override.element.style.removeProperty(override.property);
  }
  bag.length = 0;
}

function suppressStackingContexts(element: HTMLElement, bag: StyleOverride[]): void {
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const style = getComputedStyle(ancestor);
    if (style.transform !== "none") setOverride(ancestor, "transform", "none", bag);
    if (style.filter !== "none") setOverride(ancestor, "filter", "none", bag);
    if (style.perspective !== "none") setOverride(ancestor, "perspective", "none", bag);
    if (style.isolation === "isolate") setOverride(ancestor, "isolation", "auto", bag);
    if (style.contain.includes("paint")) setOverride(ancestor, "contain", "none", bag);
    if (style.willChange !== "auto") setOverride(ancestor, "will-change", "auto", bag);
    ancestor = ancestor.parentElement;
  }
}

function hiddenCss(): string {
  return cachedHiddenSelectors.map((selector) => `${selector}{display:none!important;visibility:hidden!important;pointer-events:none!important}`).join("\n");
}

function applyHiddenSelectors(): void {
  if (!isTop || cachedHiddenSelectors.length === 0) return;
  hiddenStyleEl?.remove();
  hiddenStyleEl = document.createElement("style");
  hiddenStyleEl.dataset.bigVideoHidden = "true";
  hiddenStyleEl.textContent = hiddenCss();
  document.documentElement.appendChild(hiddenStyleEl);
}

function refreshHiddenSelectors(): void {
  if (hiddenStyleEl) hiddenStyleEl.textContent = hiddenCss();
}

function ensureBackdrop(): void {
  if (!isTop || backdrop) return;
  backdrop = document.createElement("div");
  backdrop.dataset.bigVideoBackdrop = "true";
  Object.assign(backdrop.style, { position: "fixed", inset: "0", background: "#000", zIndex: String(Z_TOP - 1) });
  document.documentElement.appendChild(backdrop);
}

function viewportSize(): { width: number; height: number; offsetLeft: number; offsetTop: number } {
  const visual = window.visualViewport;
  return { width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight, offsetLeft: visual?.offsetLeft ?? 0, offsetTop: visual?.offsetTop ?? 0 };
}

function layoutExpandedTarget(target: Target): void {
  if (activeTarget !== target) return;
  const viewport = viewportSize();
  const rect = calculateContainedRect(viewport.width, viewport.height, target.ratio);
  setOverride(target.element, "top", `${viewport.offsetTop + rect.top}px`, target.overrides);
  setOverride(target.element, "left", `${viewport.offsetLeft + rect.left}px`, target.overrides);
  setOverride(target.element, "width", `${rect.width}px`, target.overrides);
  setOverride(target.element, "height", `${rect.height}px`, target.overrides);
}

function expandTarget(target: Target, fromParent = false): void {
  if (activeTarget && activeTarget !== target) shrinkTarget(activeTarget, fromParent);
  if (activeTarget === target) return;
  activeTarget = target;
  target.ratio = ratioForElement(target.element, target.ratio);
  suppressStackingContexts(target.element, target.overrides);
  setOverride(target.element, "position", "fixed", target.overrides);
  setOverride(target.element, "right", "auto", target.overrides);
  setOverride(target.element, "bottom", "auto", target.overrides);
  setOverride(target.element, "max-width", "none", target.overrides);
  setOverride(target.element, "max-height", "none", target.overrides);
  setOverride(target.element, "margin", "0", target.overrides);
  setOverride(target.element, "border", "0", target.overrides);
  setOverride(target.element, "z-index", String(Z_TOP), target.overrides);
  if (target.element instanceof HTMLVideoElement) {
    setOverride(target.element, "object-fit", "contain", target.overrides);
    setOverride(target.element, "background", "#000", target.overrides);
  }
  setOverride(document.documentElement, "overflow", "hidden", target.overrides);
  setOverride(document.body, "overflow", "hidden", target.overrides);
  layoutExpandedTarget(target);

  if (isTop) {
    ensureBackdrop();
    applyHiddenSelectors();
    target.expandButton!.hidden = true;
    target.shrinkButton!.hidden = false;
    target.shrinkButton!.focus({ preventScroll: true });
    schedulePositions();
  }
  if (target.element instanceof HTMLIFrameElement) postToChild(target.element, { source: "big-video", type: "expand", ratio: target.ratio });
}

function shrinkTarget(target: Target, fromParent = false): void {
  if (target.element instanceof HTMLIFrameElement) postToChild(target.element, { source: "big-video", type: "shrink" });
  restoreOverrides(target.overrides);
  if (activeTarget === target) activeTarget = null;
  if (isTop) {
    backdrop?.remove();
    backdrop = null;
    hiddenStyleEl?.remove();
    hiddenStyleEl = null;
    target.shrinkButton!.hidden = true;
    target.expandButton!.hidden = false;
    if (!fromParent) target.expandButton!.focus({ preventScroll: true });
    schedulePositions();
  }
}

function makeShrinkButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.bigVideoShrink = "true";
  button.hidden = true;
  button.setAttribute("aria-label", "Restore video to its original size");
  button.title = "Restore video";
  button.textContent = "×";
  Object.assign(button.style, { position: "fixed", zIndex: String(Z_TOP), width: `${BTN_SIZE}px`, height: `${BTN_SIZE}px`, borderRadius: "999px", border: "1px solid #7478c7", background: "#17182f", color: "#fff", font: "600 22px/1 system-ui,sans-serif", cursor: "pointer", boxShadow: "0 4px 18px rgba(0,0,0,.55)" });
  return button;
}

function registerTarget(element: MediaElement, confidence: number, ratio?: number, nested = false): Target {
  const existing = targets.get(element);
  if (existing) {
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.ratio = ratioForElement(element, ratio ?? existing.ratio);
    schedulePositions();
    return existing;
  }
  const target: Target = { element, ratio: ratioForElement(element, ratio), confidence, nested, overrides: [], cleanup: [] };
  targets.set(element, target);
  if (isTop) {
    target.expandButton = createExpandButton();
    target.shrinkButton = makeShrinkButton();
    document.documentElement.append(target.expandButton, target.shrinkButton);
    target.expandButton.addEventListener("click", () => expandTarget(target));
    target.shrinkButton.addEventListener("click", () => shrinkTarget(target));
    target.cleanup.push(() => target.expandButton?.remove(), () => target.shrinkButton?.remove());
  }
  if (element instanceof HTMLVideoElement) {
    const updateRatio = () => { target.ratio = ratioForElement(element); if (activeTarget === target) layoutExpandedTarget(target); reportPrimary(); };
    const ended = () => {
      if (activeTarget === target && autoShrinkOnEnd) {
        if (isTop) shrinkTarget(target);
        else postToParent({ source: "big-video", type: "ended" });
      }
    };
    element.addEventListener("loadedmetadata", updateRatio);
    element.addEventListener("resize", updateRatio);
    element.addEventListener("ended", ended);
    target.cleanup.push(() => element.removeEventListener("loadedmetadata", updateRatio), () => element.removeEventListener("resize", updateRatio), () => element.removeEventListener("ended", ended));
  }
  schedulePositions();
  reportPrimary();
  maybeAutoExpand();
  return target;
}

function removeTarget(element: MediaElement): void {
  const target = targets.get(element);
  if (!target) return;
  if (activeTarget === target) shrinkTarget(target);
  target.cleanup.forEach((cleanup) => cleanup());
  targets.delete(element);
  if (element instanceof HTMLIFrameElement) childTargets.delete(element);
  reportPrimary();
}

function reportPrimary(): void {
  if (isTop) return;
  const target = primaryTarget();
  if (!target) postToParent({ source: "big-video", type: "media-clear" });
  else postToParent({ source: "big-video", type: "media-report", ratio: target.ratio, confidence: target.confidence });
}

function matchesRememberedPlayer(element: HTMLElement): boolean {
  if (!isTop || !rememberedPlayerSelector) return false;
  try { return element.matches(rememberedPlayerSelector); } catch { return false; }
}

function scanRoot(root: Document | ShadowRoot | HTMLElement): void {
  for (const video of deepElements<HTMLVideoElement>(root as Document | ShadowRoot, "video")) {
    if (isVisibleMedia(video) || video.readyState > 0) registerTarget(video, 100);
  }
  for (const iframe of deepElements<HTMLIFrameElement>(root as Document | ShadowRoot, "iframe")) {
    const confidence = candidateConfidence(iframe);
    if (confidence >= 50 || matchesRememberedPlayer(iframe)) registerTarget(iframe, matchesRememberedPlayer(iframe) ? 110 : confidence);
  }
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) if (element.shadowRoot) observeRoot(element.shadowRoot);
}

function observeRoot(root: Document | ShadowRoot): void {
  if (observedRoots.has(root)) return;
  observedRoots.add(root);
  scanRoot(root);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        if (mutation.target instanceof HTMLIFrameElement) {
          const confidence = candidateConfidence(mutation.target);
          if (confidence >= 50 || matchesRememberedPlayer(mutation.target)) registerTarget(mutation.target, matchesRememberedPlayer(mutation.target) ? 110 : confidence);
        }
        continue;
      }
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (node instanceof HTMLVideoElement && (isVisibleMedia(node) || node.readyState > 0)) registerTarget(node, 100);
        if (node instanceof HTMLIFrameElement) {
          const confidence = candidateConfidence(node);
          if (confidence >= 50) registerTarget(node, confidence);
        }
        scanRoot(node);
        if (node.shadowRoot) observeRoot(node.shadowRoot);
      }
      for (const node of Array.from(mutation.removedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (node instanceof HTMLVideoElement || node instanceof HTMLIFrameElement) removeTarget(node);
        node.querySelectorAll<MediaElement>("video,iframe").forEach(removeTarget);
      }
    }
    schedulePositions();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "allow", "class", "style", "width", "height", "title"] });
}

function schedulePositions(): void {
  if (!isTop || positionFrame) return;
  positionFrame = requestAnimationFrame(() => { positionFrame = 0; updatePositions(); });
}

function updatePositions(): void {
  const viewport = viewportSize();
  for (const target of [...targets.values()]) {
    if (!target.element.isConnected) { removeTarget(target.element); continue; }
    if (!target.expandButton || !target.shrinkButton) continue;
    const rect = target.element.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width;
    target.expandButton.hidden = activeTarget === target || !visible;
    if (activeTarget !== target) {
      target.expandButton.style.top = `${currentPosition.startsWith("top") ? rect.top + BTN_MARGIN : rect.bottom - BTN_SIZE - BTN_MARGIN}px`;
      target.expandButton.style.left = `${currentPosition.endsWith("left") ? rect.left + BTN_MARGIN : rect.right - BTN_SIZE - BTN_MARGIN}px`;
    }
    target.shrinkButton.style.top = `${currentPosition.startsWith("top") ? BTN_MARGIN : viewport.height - BTN_SIZE - BTN_MARGIN}px`;
    target.shrinkButton.style.left = `${currentPosition.endsWith("left") ? BTN_MARGIN : viewport.width - BTN_SIZE - BTN_MARGIN}px`;
  }
  if (activeTarget) layoutExpandedTarget(activeTarget);
}

function selectorFor(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && parts.length < 6) {
    let part = current.tagName.toLowerCase();
    const classes = [...current.classList].filter((name) => name.length > 1 && !/\d{3,}/.test(name)).slice(0, 2);
    if (classes.length) part += `.${classes.map(CSS.escape).join(".")}`;
    const parentElement: HTMLElement | null = current.parentElement;
    if (parentElement) {
      const siblings = [...parentElement.children].filter((child) => child.tagName === current!.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    const selector = parts.join(" > ");
    try { if (document.querySelectorAll(selector).length === 1) return selector; } catch { /* keep building */ }
    current = parentElement;
  }
  return parts.join(" > ");
}

function stopPicker(saveHidden = true): void {
  if (!pickerMode) return;
  const oldMode = pickerMode;
  pickerMode = null;
  hoveredPickerElement?.removeAttribute("data-big-video-picker-hover");
  hoveredPickerElement = null;
  pickerStyle?.remove(); pickerStyle = null;
  pickerBanner?.remove(); pickerBanner = null;
  document.removeEventListener("pointerover", onPickerHover, true);
  document.removeEventListener("click", onPickerClick, true);
  document.removeEventListener("keydown", onPickerKey, true);
  for (const iframe of deepElements<HTMLIFrameElement>(document, "iframe")) postToChild(iframe, { source: "big-video", type: "stop-picker" });
  if (oldMode === "hide" && saveHidden && isTop) chrome.storage.sync.set({ [HIDDEN_PREFIX + domain]: cachedHiddenSelectors });
}

function onPickerHover(event: PointerEvent): void {
  if (!(event.target instanceof HTMLElement) || pickerBanner?.contains(event.target)) return;
  hoveredPickerElement?.removeAttribute("data-big-video-picker-hover");
  hoveredPickerElement = event.target;
  event.target.setAttribute("data-big-video-picker-hover", "true");
}

function onPickerClick(event: MouseEvent): void {
  if (!(event.target instanceof HTMLElement) || pickerBanner?.contains(event.target)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const clicked = event.target;
  const selector = selectorFor(clicked);
  if (pickerMode === "hide") {
    const index = cachedHiddenSelectors.indexOf(selector);
    if (index >= 0) cachedHiddenSelectors.splice(index, 1); else cachedHiddenSelectors.push(selector);
    refreshHiddenSelectors();
    return;
  }
  const media = clicked.closest<MediaElement>("video,iframe") ?? clicked.querySelector<MediaElement>("video,iframe");
  const selected = media ?? clicked;
  if (selected instanceof HTMLVideoElement || selected instanceof HTMLIFrameElement) registerTarget(selected, 120);
  if (isTop) {
    rememberedPlayerSelector = selectorFor(selected);
    chrome.storage.sync.set({ [PLAYER_PREFIX + domain]: rememberedPlayerSelector });
  } else postToParent({ source: "big-video", type: "player-picked", ratio: selected instanceof HTMLVideoElement ? ratioForElement(selected) : undefined, confidence: 120 });
  stopPicker(false);
}

function onPickerKey(event: KeyboardEvent): void { if (event.key === "Escape") stopPicker(); }

function startPicker(mode: PickerMode): void {
  stopPicker(false);
  pickerMode = mode;
  pickerStyle = document.createElement("style");
  pickerStyle.textContent = `[data-big-video-picker-hover]{outline:3px solid #8b8ff5!important;outline-offset:2px!important;cursor:crosshair!important}`;
  document.documentElement.appendChild(pickerStyle);
  if (isTop) {
    pickerBanner = document.createElement("div");
    pickerBanner.dataset.bigVideoPicker = "true";
    pickerBanner.textContent = mode === "player" ? "Select the video or player to remember. Press Esc to cancel." : "Select page elements to hide. Press Esc when finished.";
    Object.assign(pickerBanner.style, { position: "fixed", top: "16px", right: "16px", zIndex: String(Z_TOP), maxWidth: "min(420px, calc(100vw - 32px))", padding: "10px 14px", borderRadius: "10px", border: "1px solid #7478c7", background: "#17182f", color: "#fff", font: "500 13px/1.45 system-ui,sans-serif", boxShadow: "0 6px 24px rgba(0,0,0,.55)" });
    document.documentElement.appendChild(pickerBanner);
  }
  document.addEventListener("pointerover", onPickerHover, true);
  document.addEventListener("click", onPickerClick, true);
  document.addEventListener("keydown", onPickerKey, true);
  if (mode === "player") for (const iframe of deepElements<HTMLIFrameElement>(document, "iframe")) postToChild(iframe, { source: "big-video", type: "start-player-picker" });
}

function handleFrameMessage(event: MessageEvent<FrameMessage>): void {
  const message = event.data;
  if (!message || message.source !== "big-video") return;
  if (event.source === window.parent && !isTop) {
    if (message.type === "expand") { const target = primaryTarget(); if (target) expandTarget(target, true); }
    else if (message.type === "shrink" && activeTarget) shrinkTarget(activeTarget, true);
    else if (message.type === "start-player-picker") startPicker("player");
    else if (message.type === "stop-picker") stopPicker(false);
    return;
  }
  const iframe = directChildFor(event.source);
  if (!iframe) return;
  if (message.type === "media-report" || message.type === "player-picked") {
    const target = registerTarget(iframe, message.confidence ?? 80, message.ratio, true);
    childTargets.set(iframe, target);
    if (message.type === "player-picked") {
      if (isTop) {
        rememberedPlayerSelector = selectorFor(iframe);
        chrome.storage.sync.set({ [PLAYER_PREFIX + domain]: rememberedPlayerSelector });
        stopPicker(false);
      } else postToParent(message);
    }
  } else if (message.type === "media-clear") {
    const target = childTargets.get(iframe);
    if (target && candidateConfidence(iframe) < 50 && !matchesRememberedPlayer(iframe)) removeTarget(iframe);
  } else if (message.type === "ended") {
    const target = childTargets.get(iframe);
    if (target && activeTarget === target && autoShrinkOnEnd) {
      if (isTop) shrinkTarget(target); else postToParent(message);
    }
  }
}

function maybeAutoExpand(): void {
  if (!isTop || !autoExpandOnDomain || autoExpandFired || activeTarget) return;
  const target = primaryTarget();
  if (!target) return;
  autoExpandFired = true;
  requestAnimationFrame(() => expandTarget(target));
}

function initStorage(): void {
  if (!isTop) return;
  chrome.storage.sync.get({ [STORAGE_POSITION]: DEFAULT_POSITION, [STORAGE_SHRINK]: false, [HIDDEN_PREFIX + domain]: [], [AUTO_EXPAND_PREFIX + domain]: false, [PLAYER_PREFIX + domain]: "" }, (result) => {
    currentPosition = result[STORAGE_POSITION] as ButtonPosition;
    autoShrinkOnEnd = Boolean(result[STORAGE_SHRINK]);
    cachedHiddenSelectors = result[HIDDEN_PREFIX + domain] as string[];
    autoExpandOnDomain = Boolean(result[AUTO_EXPAND_PREFIX + domain]);
    rememberedPlayerSelector = String(result[PLAYER_PREFIX + domain] ?? "");
    scanRoot(document); maybeAutoExpand(); schedulePositions();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[STORAGE_POSITION]) currentPosition = changes[STORAGE_POSITION].newValue as ButtonPosition;
    if (changes[STORAGE_SHRINK]) autoShrinkOnEnd = Boolean(changes[STORAGE_SHRINK].newValue);
    if (changes[HIDDEN_PREFIX + domain]) { cachedHiddenSelectors = changes[HIDDEN_PREFIX + domain].newValue as string[]; refreshHiddenSelectors(); }
    if (changes[AUTO_EXPAND_PREFIX + domain]) { autoExpandOnDomain = Boolean(changes[AUTO_EXPAND_PREFIX + domain].newValue); if (!autoExpandOnDomain) autoExpandFired = false; maybeAutoExpand(); }
    if (changes[PLAYER_PREFIX + domain]) { rememberedPlayerSelector = String(changes[PLAYER_PREFIX + domain].newValue ?? ""); scanRoot(document); }
    schedulePositions();
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isTop) return;
  if (message?.action === "startHidePicker" || message?.action === "startPicker") startPicker("hide");
  if (message?.action === "startPlayerPicker") startPicker("player");
  if (message?.action === "getPageContext") { sendResponse({ domain, playerSelector: rememberedPlayerSelector, detectedCount: targets.size }); return true; }
});

window.addEventListener("message", handleFrameMessage);
window.addEventListener("scroll", schedulePositions, { passive: true, capture: true });
window.addEventListener("resize", schedulePositions, { passive: true });
window.visualViewport?.addEventListener("resize", schedulePositions, { passive: true });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && activeTarget) shrinkTarget(activeTarget); }, true);

initStorage();
observeRoot(document);
reportPrimary();
