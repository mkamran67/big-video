import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";

const projectRoot = process.cwd();
const extensionPath = path.join(projectRoot, "dist", "chrome");
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const pages = {
  "/native": `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:80px;background:#eee}video{display:block;width:640px;height:360px}</style><video controls></video>`,
  "/frame": `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:60px;background:#eee}iframe{width:640px;height:360px;border:0}</style><iframe title="Video player" allow="fullscreen; autoplay" src="/nested"></iframe>`,
  "/nested": `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}video{display:block;width:640px;height:360px}</style><video controls></video>`,
};

const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(pages[request.url] ?? "Not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Test server did not start");
const baseUrl = `http://127.0.0.1:${address.port}`;

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    enableExtensions: [extensionPath],
    args: ["--no-first-run", "--no-default-browser-check"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });

  await page.goto(`${baseUrl}/native`, { waitUntil: "networkidle0" });
  const nativeButton = await page.waitForSelector("[data-big-video-btn]:not([hidden])", { timeout: 10_000 });
  assert(nativeButton, "Native video should receive an expand control");
  await nativeButton.click();
  const nativeRect = await page.$eval("video", (video) => {
    const rect = video.getBoundingClientRect();
    return { width: rect.width, height: rect.height, objectFit: getComputedStyle(video).objectFit };
  });
  assert.deepEqual(nativeRect, { width: 1200, height: 675, objectFit: "contain" });

  await page.goto(`${baseUrl}/frame`, { waitUntil: "networkidle0" });
  const frameButton = await page.waitForSelector("[data-big-video-btn]:not([hidden])", { timeout: 10_000 });
  assert(frameButton, "A nested video frame should receive an expand control");
  await frameButton.click();
  const iframeRect = await page.$eval("iframe", (iframe) => {
    const rect = iframe.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert.deepEqual(iframeRect, { width: 1200, height: 675 });

  console.log("Chrome extension E2E passed: native and nested videos preserve 16:9 while fitting the viewport.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
