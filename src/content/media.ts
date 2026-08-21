export interface ContainedRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface AspectRatioInput {
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  reportedRatio?: number;
  renderedWidth?: number;
  renderedHeight?: number;
  attributeWidth?: number;
  attributeHeight?: number;
}

export interface IframeCandidateInput {
  src?: string;
  allow?: string;
  title?: string;
  name?: string;
  id?: string;
  className?: string;
  ancestorClassName?: string;
  width: number;
  height: number;
}

const KNOWN_PLAYER_HOSTS = [
  /(?:youtube\.com\/embed|youtube-nocookie\.com\/embed|youtu\.be)/i,
  /player\.vimeo\.com|vimeo\.com\/video/i,
  /dailymotion\.com\/embed/i,
  /player\.twitch\.tv|twitch\.tv\/embed/i,
  /facebook\.com\/plugins\/video/i,
  /instagram\.com\/(?:p|reel)\//i,
  /tiktok\.com\/embed/i,
  /rumble\.com\/embed/i,
  /streamable\.com\/e\//i,
  /wistia\.(?:com|net)\/embed/i,
  /loom\.com\/embed/i,
  /drive\.google\.com\/file/i,
  /(?:kwik\.(?:cx|si|to)|mp4upload\.com|filemoon\.[^/]+|streamlare\.com|mixdrop\.[^/]+|vidplay\.[^/]+|streamtape\.com|voe\.[^/]+)\//i,
];

const PLAYER_TEXT = /\b(?:video|player|media|stream|watch|theatre|theater|cinema|embed|jwplayer|plyr|vjs)\b/i;
const NON_PLAYER_TEXT = /(?:\bads?\b|advert|doubleclick|analytics|tracker|tracking|user.?sync|captcha|recaptcha|accounts?|auth|login|sign.?in)/i;

export function calculateContainedRect(viewportWidth: number, viewportHeight: number, aspectRatio: number): ContainedRect {
  const safeWidth = Math.max(0, viewportWidth);
  const safeHeight = Math.max(0, viewportHeight);
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
  let width = safeWidth;
  let height = width / safeRatio;

  if (height > safeHeight) {
    height = safeHeight;
    width = height * safeRatio;
  }

  return {
    width,
    height,
    left: (safeWidth - width) / 2,
    top: (safeHeight - height) / 2,
  };
}

function validRatio(width?: number, height?: number): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function resolveAspectRatio(input: AspectRatioInput): number {
  return validRatio(input.intrinsicWidth, input.intrinsicHeight)
    ?? (input.reportedRatio && input.reportedRatio > 0 ? input.reportedRatio : null)
    ?? validRatio(input.renderedWidth, input.renderedHeight)
    ?? validRatio(input.attributeWidth, input.attributeHeight)
    ?? 16 / 9;
}

export function scoreIframeCandidate(input: IframeCandidateInput): number {
  const { width, height } = input;
  const src = input.src ?? "";
  const text = [input.allow, input.title, input.name, input.id, input.className, input.ancestorClassName].filter(Boolean).join(" ");

  if (width <= 0 || height <= 0) return -100;
  if (width < 120 || height < 68) return -40;

  let score = 0;
  if (KNOWN_PLAYER_HOSTS.some((pattern) => pattern.test(src))) score += 90;
  if (/fullscreen/i.test(input.allow ?? "")) score += 25;
  if (/autoplay|picture-in-picture|encrypted-media/i.test(input.allow ?? "")) score += 15;
  if (PLAYER_TEXT.test(text)) score += 25;
  if (NON_PLAYER_TEXT.test(`${src} ${text}`)) score -= 70;

  const area = width * height;
  const ratio = width / height;
  if (area >= 120_000) score += 10;
  if (ratio >= 1.2 && ratio <= 2.4) score += 10;

  return score;
}
