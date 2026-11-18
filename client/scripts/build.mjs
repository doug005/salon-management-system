import { build, context } from "esbuild";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, copyFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildClient(watch = false) {
  try {
    loadEnvFile(path.join(root, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.join(root, "dist"), { recursive: true });
  await copyFile(
    path.join(root, "index.html"),
    path.join(root, "dist/index.html"),
  );
  for (const asset of ["manifest.webmanifest", "sw.js", "icon.svg", "icon-192.png", "icon-512.png"])
    await copyFile(path.join(root, "public", asset), path.join(root, "dist", asset));
  const options = {
    absWorkingDir: root,
    entryPoints: ["src/main.jsx"],
    bundle: true,
    outfile: "dist/app.js",
    jsx: "automatic",
    minify: !watch,
    sourcemap: watch,
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        watch ? "development" : "production",
      ),
      __PUBLIC_CONFIG__: JSON.stringify({
        apiUrl: process.env.PUBLIC_API_URL || "/api",
        googleClientId: process.env.PUBLIC_GOOGLE_CLIENT_ID || "",
      }),
    },
  };
  const cli = path.join(
    root,
    "../node_modules/@tailwindcss/cli/dist/index.mjs",
  );
  const args = [
    cli,
    "-i",
    "src/styles.css",
    "-o",
    "dist/app.css",
    ...(watch ? ["--watch=always"] : ["--minify"]),
  ];
  if (watch) {
    // Generate CSS before accepting requests, then watch for subsequent changes.
    const initial = spawnSync(
      process.execPath,
      [cli, "-i", "src/styles.css", "-o", "dist/app.css"],
      { cwd: root, stdio: "inherit" },
    );
    if (initial.status !== 0) throw new Error("Tailwind build failed");
    const css = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
    const ctx = await context(options);
    await ctx.watch();
    return async () => {
      css.kill();
      await ctx.dispose();
    };
  }
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Tailwind build failed");
  await build(options);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildClient();
