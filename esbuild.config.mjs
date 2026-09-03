import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";
import builtinModulesPackage from "builtin-modules";

const production = process.argv[2] === "production";
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/language",
    "@codemirror/rangeset",
    "@codemirror/state",
    "@codemirror/view",
    ...builtinModules,
    ...builtinModulesPackage
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
