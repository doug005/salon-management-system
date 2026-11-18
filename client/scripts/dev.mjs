import express from "express";
import http from "node:http";
import path from "node:path";
import { root, buildClient } from "./build.mjs";
const cleanup = await buildClient(true);
const app = express();
app.disable("x-powered-by");
// Only proxy to the project API; preserve /api in the forwarded path.
app.use((req, res, next) => {
  if (req.path !== "/api" && !req.path.startsWith("/api/")) return next();
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 4000,
      path: req.originalUrl,
      method: req.method,
      headers: { ...req.headers, host: "127.0.0.1:4000" },
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent)
      res
        .status(502)
        .json({
          message:
            "The salon API is unavailable. Start the configured backend to use authentication.",
        });
    else res.end();
  });
  req.pipe(upstream);
});
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (req, res) => {
  if (req.accepts("html") && !path.extname(req.path))
    return res.sendFile(path.join(root, "dist/index.html"));
  res.sendStatus(404);
});
const server = http.createServer(app);
server.on("error", async (error) => {
  console.error(error.message);
  await cleanup();
  process.exit(1);
});
server.listen(3000, "127.0.0.1", () =>
  console.log("React frontend running at http://localhost:3000"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await cleanup();
      process.exit(0);
    }),
  );
