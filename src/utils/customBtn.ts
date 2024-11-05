const newButtonEl = document.createElement("button");
newButtonEl.innerText = "Expand ⤢";
newButtonEl.style.position = "fixed";
newButtonEl.style.padding = "10px";
newButtonEl.style.backgroundColor = "black";
newButtonEl.style.color = "white";
newButtonEl.style.border = "none";
newButtonEl.style.borderRadius = "5px";
newButtonEl.style.cursor = "pointer";
newButtonEl.style.zIndex = "9999999999999";
newButtonEl.id = "superSizeBtn";
newButtonEl.style.boxShadow = "0 0 10px 0 rgba(0, 0, 0, 0.5)";
newButtonEl.style.left = "10px";
newButtonEl.style.bottom = "10px";
newButtonEl.style.opacity = "0.5";
newButtonEl.style.transition = "opacity 250ms";

export default newButtonEl;
