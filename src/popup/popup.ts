type ButtonPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface PageContext {
  domain: string;
  playerSelector: string;
  detectedCount: number;
}

const STORAGE_POSITION = "buttonPosition";
const STORAGE_SHRINK = "autoShrinkOnEnd";
const AUTO_EXPAND_PREFIX = "autoExpand_";
const PLAYER_PREFIX = "bv_player_";
const DEFAULT_POSITION: ButtonPosition = "top-right";
const POSITION_LABELS: Record<ButtonPosition, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

let activeTabId: number | null = null;
let activeDomain = "";

function setTab(name: string, focus = false): void {
  document.querySelectorAll<HTMLButtonElement>("[role=tab]").forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  document.querySelectorAll<HTMLElement>("[role=tabpanel]").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
}

function setPosition(position: ButtonPosition): void {
  document.querySelectorAll<HTMLButtonElement>(".pos-btn").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.pos === position));
  });
  const label = document.getElementById("position-label");
  if (label) label.textContent = POSITION_LABELS[position];
}

function showUnavailable(): void {
  document.getElementById("domain")!.textContent = "Unavailable on this page";
  document.getElementById("detected-count")!.textContent = "";
  document.getElementById("status-note")!.textContent = "Browser and extension pages do not allow video controls.";
  document.querySelectorAll<HTMLButtonElement>("#player-picker,#hide-picker").forEach((button) => { button.disabled = true; });
  (document.getElementById("auto-expand") as HTMLInputElement).disabled = true;
}

function renderPageContext(context: PageContext): void {
  activeDomain = context.domain;
  document.getElementById("domain")!.textContent = context.domain || "Current site";
  document.getElementById("detected-count")!.textContent = `${context.detectedCount} found`;
  document.getElementById("status-note")!.textContent = context.detectedCount
    ? "Expand controls are shown over detected players."
    : "No player detected yet. Choose one manually if video is present.";
  document.getElementById("saved-player")!.hidden = !context.playerSelector;

  const autoExpand = document.getElementById("auto-expand") as HTMLInputElement;
  chrome.storage.sync.get({ [AUTO_EXPAND_PREFIX + activeDomain]: false }, (result) => {
    autoExpand.checked = Boolean(result[AUTO_EXPAND_PREFIX + activeDomain]);
  });
}

function sendAction(action: string): void {
  if (activeTabId === null) return;
  chrome.tabs.sendMessage(activeTabId, { action }, () => {
    if (chrome.runtime.lastError) showUnavailable();
    else window.close();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLButtonElement>("[role=tab]").forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab ?? "settings"));
    tab.addEventListener("keydown", (event) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      setTab(tab.dataset.tab === "settings" ? "about" : "settings", true);
    });
  });

  document.getElementById("version")!.textContent = `Version ${chrome.runtime.getManifest().version}`;

  chrome.storage.sync.get({ [STORAGE_POSITION]: DEFAULT_POSITION, [STORAGE_SHRINK]: false }, (result) => {
    setPosition(result[STORAGE_POSITION] as ButtonPosition);
    (document.getElementById("auto-shrink") as HTMLInputElement).checked = Boolean(result[STORAGE_SHRINK]);
  });

  document.querySelectorAll<HTMLButtonElement>(".pos-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const position = button.dataset.pos as ButtonPosition;
      setPosition(position);
      chrome.storage.sync.set({ [STORAGE_POSITION]: position });
    });
  });

  document.getElementById("auto-shrink")!.addEventListener("change", (event) => {
    chrome.storage.sync.set({ [STORAGE_SHRINK]: (event.target as HTMLInputElement).checked });
  });
  document.getElementById("auto-expand")!.addEventListener("change", (event) => {
    if (activeDomain) chrome.storage.sync.set({ [AUTO_EXPAND_PREFIX + activeDomain]: (event.target as HTMLInputElement).checked });
  });
  document.getElementById("player-picker")!.addEventListener("click", () => sendAction("startPlayerPicker"));
  document.getElementById("hide-picker")!.addEventListener("click", () => sendAction("startHidePicker"));
  document.getElementById("clear-player")!.addEventListener("click", () => {
    if (!activeDomain) return;
    chrome.storage.sync.remove(PLAYER_PREFIX + activeDomain, () => {
      document.getElementById("saved-player")!.hidden = true;
    });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (typeof tab?.id !== "number") { showUnavailable(); return; }
    activeTabId = tab.id;
    chrome.tabs.sendMessage(tab.id, { action: "getPageContext" }, (context?: PageContext) => {
      if (chrome.runtime.lastError || !context) showUnavailable();
      else renderPageContext(context);
    });
  });
});
