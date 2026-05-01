/**
 * Creates the "expand" overlay button. Styling matches the shrink button —
 * small circular pill with a glass-dark look. Positioned by the caller.
 */
export function createExpandButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute("data-big-video-btn", "true");
  btn.title = "Expand video to full screen";
  btn.innerText = "⤢";

  btn.style.position = "fixed"; // caller will set top/left from getBoundingClientRect
  btn.style.zIndex = "2147483647";

  btn.style.width = "36px";
  btn.style.height = "36px";
  btn.style.padding = "0";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.background = "rgba(10, 10, 20, 0.72)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.color = "#e0e0ff";
  btn.style.border = "1px solid rgba(120, 120, 255, 0.4)";
  btn.style.borderRadius = "50%";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "18px";
  btn.style.lineHeight = "1";
  btn.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";
  btn.style.fontFamily = "system-ui, -apple-system, sans-serif";
  btn.style.transition = "opacity 180ms, transform 180ms, background 180ms";
  btn.style.opacity = "0.8";

  btn.addEventListener("mouseenter", () => {
    btn.style.opacity = "1";
    btn.style.transform = "scale(1.12)";
    btn.style.background = "rgba(30, 30, 60, 0.92)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "0.8";
    btn.style.transform = "scale(1)";
    btn.style.background = "rgba(10, 10, 20, 0.72)";
  });

  return btn;
}
