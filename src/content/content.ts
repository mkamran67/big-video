import newButtonEl from "../utils/customBtn";

let myNewFrame: null | HTMLIFrameElement = null;
let myNewFramesParent: null | HTMLElement = null;
let isBig = false;

const addButtons = (frameElement: HTMLIFrameElement) => {
  let customSuperSizeBtn = newButtonEl.cloneNode(true) as HTMLButtonElement;
  let previousWidth = frameElement.style.width;
  let previousHeight = frameElement.style.height;

  customSuperSizeBtn.onclick = () => {
    if (customSuperSizeBtn.innerText === "Expand ⤢") {
      //  Make it big
      frameElement.style.top = "0";
      frameElement.style.left = "0";
      frameElement.style.bottom = "0";
      frameElement.style.right = "0";
      frameElement.style.width = "100%";
      frameElement.style.height = "100%";
      frameElement.style.zIndex = "99";
      frameElement.style.position = "fixed";
      customSuperSizeBtn.innerText = "Shrink ⤡";
    } else {
      //  Shrink it
      if (previousWidth && previousHeight) {
        frameElement.style.width = previousWidth;
        frameElement.style.height = previousHeight;
      } else {
        frameElement.style.height = "315px";
        frameElement.style.width = "560px";
      }

      customSuperSizeBtn.innerText = "Expand ⤢";
    }
  };

  customSuperSizeBtn.addEventListener("mouseover", () => {
    customSuperSizeBtn.style.opacity = "1";
  });

  customSuperSizeBtn.addEventListener("mouseout", () => {
    customSuperSizeBtn.style.opacity = "0";
  });

  if (myNewFramesParent) {
    myNewFramesParent.insertBefore(
      customSuperSizeBtn,
      myNewFramesParent.firstChild
    );
  }
};

const myInterval = setInterval(() => {
  const listOfVideos = document.body.querySelectorAll("iframe");

  for (const videoFrame of listOfVideos) {
    if (videoFrame) {
      myNewFrame = videoFrame;
      myNewFramesParent = videoFrame.parentElement;

      addButtons(videoFrame);
      clearInterval(myInterval);
      break;
    }
  }
}, 2000);

if (myNewFrame !== null) {
  // @ts-ignore
  if (myNewFrame.parentElement) {
    // @ts-ignore
    myNewFrame.parentElement.appendChild(newButtonEl);
  }
}

console.log(myNewFrame);
