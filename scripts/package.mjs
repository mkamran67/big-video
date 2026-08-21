import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { nextPatchVersion, shouldIncludeSourcePath } from "./release-lib.mjs";

const projectRoot = process.cwd();
const packagePath = path.join(projectRoot, "package.json");
const originalPackageText = readFileSync(packagePath, "utf8");
const packageJson = JSON.parse(originalPackageText);
const nextVersion = nextPatchVersion(packageJson.version);
const stagingRoot = mkdtempSync(path.join(tmpdir(), "big-video-release-"));
const stagedArtifacts = path.join(stagingRoot, "artifacts");
const releasesDir = path.join(projectRoot, "releases");
const fixedMtime = new Date(1980, 0, 2, 0, 0, 0, 0);

function run(command, args) {
  execFileSync(command, args, { cwd: projectRoot, stdio: "inherit" });
}

function collectFiles(root, filter = () => true, prefix = "") {
  const entries = {};
  const visit = (directory, relativeDirectory) => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = path.posix.join(relativeDirectory, name);
      if (!filter(relative)) continue;
      const stats = statSync(absolute);
      if (stats.isDirectory()) visit(absolute, relative);
      else if (stats.isFile()) entries[path.posix.join(prefix, relative)] = [new Uint8Array(readFileSync(absolute)), { mtime: fixedMtime }];
    }
  };
  visit(root, "");
  return entries;
}

function createZip(destination, entries) {
  writeFileSync(destination, zipSync(entries, { level: 9 }));
}

function sourceEntries() {
  const entries = collectFiles(projectRoot, (relative) => shouldIncludeSourcePath(relative));
  entries["package.json"] = [strToU8(`${JSON.stringify({ ...packageJson, version: nextVersion }, null, 2)}\n`), { mtime: fixedMtime }];
  return entries;
}

const names = {
  chrome: `big-video-chrome-v${nextVersion}.zip`,
  firefox: `big-video-firefox-v${nextVersion}.zip`,
  source: `big-video-firefox-source-v${nextVersion}.zip`,
};

try {
  mkdirSync(stagedArtifacts, { recursive: true });
  console.log(`Preparing Big Video ${nextVersion}`);
  run("corepack", ["yarn", "test"]);
  run("corepack", ["yarn", "typecheck"]);
  for (const browser of ["chrome", "firefox"]) {
    run("corepack", ["yarn", "webpack", "--config", "webpack.config.mjs", "--mode=production", "--env", `browser=${browser}`, "--env", `releaseVersion=${nextVersion}`]);
  }
  run("corepack", ["yarn", "test:e2e"]);
  run("corepack", ["yarn", "web-ext", "lint", "--source-dir", "dist/firefox", "--warnings-as-errors"]);

  createZip(path.join(stagedArtifacts, names.chrome), collectFiles(path.join(projectRoot, "dist", "chrome")));
  createZip(path.join(stagedArtifacts, names.firefox), collectFiles(path.join(projectRoot, "dist", "firefox")));
  createZip(path.join(stagedArtifacts, names.source), sourceEntries());

  for (const browser of ["chrome", "firefox"]) {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, "dist", browser, "manifest.json"), "utf8"));
    if (manifest.version !== nextVersion) throw new Error(`${browser} manifest version mismatch`);
  }

  mkdirSync(releasesDir, { recursive: true });
  const nextPackageText = `${JSON.stringify({ ...packageJson, version: nextVersion }, null, 2)}\n`;
  const stagedPackagePath = path.join(projectRoot, ".package.json.next");
  writeFileSync(stagedPackagePath, nextPackageText);
  const published = [];
  try {
    renameSync(stagedPackagePath, packagePath);
    for (const name of Object.values(names)) {
      const destination = path.join(releasesDir, name);
      renameSync(path.join(stagedArtifacts, name), destination);
      published.push(destination);
    }
  } catch (error) {
    writeFileSync(packagePath, originalPackageText);
    for (const destination of published) rmSync(destination, { force: true });
    rmSync(stagedPackagePath, { force: true });
    throw error;
  }

  console.log("Release created:");
  for (const name of Object.values(names)) console.log(`  releases/${name}`);
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
