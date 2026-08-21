import { describe, expect, it } from "vitest";
import {
  buildBrowserManifest,
  nextPatchVersion,
  shouldIncludeSourcePath,
} from "../scripts/release-lib.mjs";

const commonManifest = {
  manifest_version: 3,
  name: "Big Video",
  description: "Test",
  permissions: ["storage"],
  content_scripts: [{ matches: ["<all_urls>"], js: ["content.js"] }],
};

describe("nextPatchVersion", () => {
  it("normalizes legacy two-part versions and increments only the patch", () => {
    expect(nextPatchVersion("0.4")).toBe("0.4.1");
    expect(nextPatchVersion("2.7.9")).toBe("2.7.10");
  });
});

describe("buildBrowserManifest", () => {
  it("emits browser-specific manifests with the same release version", () => {
    const chrome = buildBrowserManifest(commonManifest, "chrome", "1.2.3");
    const firefox = buildBrowserManifest(commonManifest, "firefox", "1.2.3");

    expect(chrome.version).toBe("1.2.3");
    expect(chrome).not.toHaveProperty("browser_specific_settings");
    expect(firefox.version).toBe("1.2.3");
    expect(firefox.browser_specific_settings.gecko).toMatchObject({
      id: "big-video@gameonhigh.com",
      strict_min_version: "142.0",
      data_collection_permissions: { required: ["none"] },
    });
  });
});

describe("source archive filtering", () => {
  it("includes reproducible sources and excludes generated or private trees", () => {
    expect(shouldIncludeSourcePath("src/content/content.ts")).toBe(true);
    expect(shouldIncludeSourcePath("yarn.lock")).toBe(true);
    expect(shouldIncludeSourcePath("node_modules/pkg/index.js")).toBe(false);
    expect(shouldIncludeSourcePath("dist/chrome/content.js")).toBe(false);
    expect(shouldIncludeSourcePath("releases/old.zip")).toBe(false);
    expect(shouldIncludeSourcePath(".git/config")).toBe(false);
    expect(shouldIncludeSourcePath(".crush/crush.db")).toBe(false);
    expect(shouldIncludeSourcePath("store-source/src/manifest.json")).toBe(false);
  });
});
