const EXCLUDED_SOURCE_ROOTS = new Set([
  ".git",
  ".crush",
  ".yarn",
  "dist",
  "node_modules",
  "releases",
  "store-source",
]);

export function nextPatchVersion(version) {
  const parts = String(version).split(".");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(`Invalid version: ${version}`);
  }
  const [major, minor, patch = 0] = parts.map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

export function buildBrowserManifest(commonManifest, browser, version) {
  const manifest = structuredClone(commonManifest);
  manifest.version = version;

  if (browser === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        id: "big-video@gameonhigh.com",
        strict_min_version: "142.0",
        data_collection_permissions: { required: ["none"] },
      },
    };
  } else if (browser !== "chrome") {
    throw new Error(`Unsupported browser: ${browser}`);
  }

  return manifest;
}

export function shouldIncludeSourcePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  const [root] = normalized.split("/");
  return Boolean(normalized) && !EXCLUDED_SOURCE_ROOTS.has(root);
}
