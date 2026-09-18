import { build } from "esbuild";
import { cp, mkdir, writeFile, rename } from "node:fs/promises";

await mkdir("dist", { recursive: true });
const result = await build({
  entryPoints: {
    background: "src/background/service-worker.ts",
    content: "src/content/content-script.ts",
    popup: "src/popup/popup.ts",
    options: "src/options/options.ts"
  },
  outdir: "dist",
  bundle: true,
  write: false,
  format: "esm",
  target: "chrome120",
  sourcemap: true
});
// Never remove a directory that Brave is actively using for an unpacked extension.
// Compile first, atomically replace complete files, and publish the manifest last.
for (const file of result.outputFiles) {
  await writeFile(`${file.path}.next`, file.contents);
  await rename(`${file.path}.next`, file.path);
}
for (const file of ["src/content/content.css", "src/popup/popup.html", "src/popup/popup.css", "src/options/options.html", "src/options/options.css", "manifest.json"]) {
  const target = `dist/${file.split("/").at(-1)}`;
  await cp(file, `${target}.next`);
  await rename(`${target}.next`, target);
}
