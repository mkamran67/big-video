import path from "node:path";
import { fileURLToPath } from "node:url";
import HTMLWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import { buildBrowserManifest } from "./scripts/release-lib.mjs";
import packageJson from "./package.json" with { type: "json" };

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default (env = {}, argv = {}) => {
  const browser = env.browser ?? "chrome";
  const version = env.releaseVersion ?? packageJson.version;
  const mode = argv.mode ?? "production";

  if (!["chrome", "firefox"].includes(browser)) throw new Error(`Unsupported browser: ${browser}`);

  return {
    mode,
    devtool: mode === "development" ? "cheap-module-source-map" : false,
    entry: {
      popup: "./src/popup/popup.ts",
      content: "./src/content/content.ts",
    },
    output: {
      path: path.resolve(projectRoot, "dist", browser),
      filename: "[name].js",
      clean: true,
    },
    module: {
      rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }],
    },
    resolve: { extensions: [".ts", ".js"] },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: "src/manifest.json",
            to: "manifest.json",
            transform(content) {
              const common = JSON.parse(content.toString("utf8"));
              return `${JSON.stringify(buildBrowserManifest(common, browser, version), null, 2)}\n`;
            },
          },
          { from: "src/icons/icon*.png", to: "icons/[name][ext]" },
        ],
      }),
      new HTMLWebpackPlugin({ template: "./src/popup/popup.html", filename: "popup.html", chunks: ["popup"] }),
    ],
  };
};
