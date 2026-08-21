import { describe, expect, it } from "vitest";
import {
  calculateContainedRect,
  resolveAspectRatio,
  scoreIframeCandidate,
} from "../src/content/media";

describe("calculateContainedRect", () => {
  it("maximizes a landscape video without stretching it", () => {
    expect(calculateContainedRect(1200, 800, 16 / 9)).toEqual({
      width: 1200,
      height: 675,
      left: 0,
      top: 62.5,
    });
  });

  it("maximizes portrait and square videos", () => {
    expect(calculateContainedRect(1200, 800, 9 / 16)).toEqual({
      width: 450,
      height: 800,
      left: 375,
      top: 0,
    });
    expect(calculateContainedRect(1200, 800, 1)).toEqual({
      width: 800,
      height: 800,
      left: 200,
      top: 0,
    });
  });
});

describe("resolveAspectRatio", () => {
  it("prefers intrinsic media dimensions over rendered dimensions", () => {
    expect(resolveAspectRatio({ intrinsicWidth: 1920, intrinsicHeight: 1080, renderedWidth: 400, renderedHeight: 400 })).toBe(16 / 9);
  });

  it("falls back through reported and rendered ratios to 16:9", () => {
    expect(resolveAspectRatio({ reportedRatio: 4 / 3, renderedWidth: 400, renderedHeight: 400 })).toBe(4 / 3);
    expect(resolveAspectRatio({ renderedWidth: 400, renderedHeight: 500 })).toBe(0.8);
    expect(resolveAspectRatio({})).toBe(16 / 9);
  });
});

describe("scoreIframeCandidate", () => {
  it("recognizes known and structurally credible players", () => {
    expect(scoreIframeCandidate({ src: "https://www.youtube.com/embed/abc", width: 640, height: 360 })).toBeGreaterThanOrEqual(80);
    expect(scoreIframeCandidate({ src: "https://player.example.test/abc", allow: "autoplay; fullscreen; picture-in-picture", title: "Video player", width: 640, height: 360 })).toBeGreaterThanOrEqual(50);
  });

  it("rejects hidden, tiny, advertising, and authentication frames", () => {
    expect(scoreIframeCandidate({ src: "https://ads.example.test/sync", width: 0, height: 0 })).toBeLessThan(0);
    expect(scoreIframeCandidate({ src: "https://accounts.example.test/login", width: 640, height: 360 })).toBeLessThan(30);
    expect(scoreIframeCandidate({ src: "https://example.test/widget", width: 30, height: 30 })).toBeLessThan(30);
  });
});
