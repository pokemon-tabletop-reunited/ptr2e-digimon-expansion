import esbuild from "esbuild";
import fs from "fs-extra";
import path from "path";
import * as Vite from "vite";
import checker from "vite-plugin-checker";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";
import packageJSON from "./package.json" with { type: "json" };

const EN_JSON = JSON.parse(fs.readFileSync("./static/lang/en.json", { encoding: "utf-8" }));

const config = Vite.defineConfig(({ command, mode }): Vite.UserConfig => {
  const buildMode = mode === "production" ? "production" : "development";
  const outDir = path.resolve(__dirname, "dist");

  const plugins = [checker({ typescript: true }), tsconfigPaths()];

  if (buildMode === "production") {
    plugins.push(
      {
        name: "minify",
        renderChunk: {
          order: "post",
          async handler(code, chunk) {
            return chunk.fileName.endsWith(".mjs")
              ? esbuild.transform(code, {
                keepNames: true,
                minifyIdentifiers: true,
                minifySyntax: true,
                minifyWhitespace: true,
              })
              : code;
          },
        },
      },
      ...viteStaticCopy({
        targets: [{ src: "README.md", dest: "." }],
      })
    );
  } else {
    plugins.push(
      {
        name: "touch-vendor-mjs",
        apply: "build",
        writeBundle: {
          async handler() {
            fs.closeSync(fs.openSync(path.resolve(outDir, "vendor.mjs"), "w"));
          },
        },
      },
      {
        name: "hmr-handler",
        apply: "serve",
        handleHotUpdate(context) {
          if (context.file.startsWith(outDir)) return;

          if (context.file.endsWith("en.json")) {
            const basePath = context.file.slice(context.file.indexOf("lang/"));
            console.log(`Updating lang file at ${basePath}`);
            fs.promises.copyFile(context.file, `${outDir}/${basePath}`).then(() => {
              context.server.ws.send({
                type: "custom",
                event: "lang-update",
                data: { path: `modules/ptr2e-digimon-expansion/${basePath}` },
              });
            });
          } else if (context.file.endsWith(".hbs")) {
            const basePath = context.file.slice(context.file.indexOf("templates/"));
            console.log(`Updating template file at ${basePath}`);
            fs.promises.copyFile(context.file, `${outDir}/${basePath}`).then(() => {
              context.server.ws.send({
                type: "custom",
                event: "template-update",
                data: { path: `modules/ptr2e-digimon-expansion/${basePath}` },
              });
            });
          }
        },
      }
    );
  }

  if (command === "serve") {
    const message = "This file is for a running vite dev server and is not copied to a build";
    fs.writeFileSync("./index.html", `<h1>${message}</h1>\n`);
    if (!fs.existsSync("./styles")) fs.mkdirSync("./styles");
    fs.writeFileSync("./styles/module.css", `/** ${message} */\n`);
    fs.writeFileSync("./module.mjs", `/** ${message} */\n\nimport "./src/module.ts";\n`);
    fs.writeFileSync("./vendor.mjs", `/** ${message} */\n`);
  }

  return {
    base: command === "build" ? "./" : "/modules/ptr2e-digimon-expansion/",
    publicDir: "static",
    define: {
      BUILD_MODE: JSON.stringify(buildMode),
      EN_JSON: JSON.stringify(EN_JSON),
      fu: "foundry.utils",
    },
    esbuild: { keepNames: true },
    build: {
      outDir,
      assetsDir: "static",
      emptyOutDir: false, // fails if world is running due to compendium locks. We do it in "npm run clean" instead.
      minify: false,
      cssMinify: buildMode === "production",
      sourcemap: buildMode === "development",
      lib: {
        name: "ptr2e-digimon-expansion",
        entry: "src/module.ts",
        formats: ["es"],
        fileName: "module",
      },
      rollupOptions: {
        external: new RegExp(".webp$"),
        input: {
          module: path.resolve(__dirname, "src/module.ts"),
        },
        output: {
          assetFileNames: ({ name }): string =>
            name === "style.css" ? "styles/module.css" : name ?? "",
          chunkFileNames: "[name].mjs",
          entryFileNames: () => {
            return "[name].mjs";
          },
          manualChunks: {
            vendor:
              buildMode === "production" ? Object.keys(packageJSON.dependencies) : [],
          }
        },
        watch: { buildDelay: 100 },
      },
      target: "es2022",
    },
    server: {
      port: 30001,
      open: "/game",
      proxy: {
        "/socket.io": {
          target: "ws://localhost:30000",
          ws: true,
        },
        "^(?!/modules/ptr2e-digimon-expansion/)": "http://localhost:30000/",
      },
    },
    plugins,
    css: {
      devSourcemap: buildMode === "development",
    },
  };
});

export default config;
