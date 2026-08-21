/**
 * Creates the "expand" overlay button. Styling matches the shrink button -
 * small circular pill with a glass-dark look. Positioned by the caller.
 */
export function createExpandButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("data-big-video-btn", "true");
  btn.setAttribute("aria-label", "Fit video to browser viewport");
  btn.title = "Fit video to browser viewport";
  btn.innerText = "↗";

  btn.style.position = "fixed"; // caller will set top/left from getBoundingClientRect
  btn.style.zIndex = "2147483647";

  btn.style.width = "36px";
  btn.style.height = "36px";
  btn.style.padding = "0";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.background = "#17182f";
  btn.style.color = "#ffffff";
  btn.style.border = "1px solid #7478c7";
  btn.style.borderRadius = "50%";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "18px";
  btn.style.lineHeight = "1";
  btn.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";
  btn.style.fontFamily = "system-ui, -apple-system, sans-serif";
  btn.style.transition = "transform 160ms ease-out, background 160ms ease-out";

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.08)";
    btn.style.background = "#292d58";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
    btn.style.background = "#17182f";
  });

  return btn;
}
