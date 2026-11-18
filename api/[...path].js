// Vercel same-origin proxy keeps refresh cookies first-party. No credentials belong here.
const https = require("node:https");
module.exports = (req, res) => {
  let origin;
  try {
    origin = new URL(process.env.BACKEND_ORIGIN);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/"
    )
      throw new Error();
  } catch {
    res.statusCode = 503;
    return res.end("Backend origin is not configured.");
  }
  const pathname = req.url.split("?")[0];
  if (!pathname.startsWith("/api/")) {
    res.statusCode = 404;
    return res.end();
  }
  const headers = { ...req.headers, host: origin.host };
  delete headers.connection;
  delete headers["transfer-encoding"];
  delete headers["content-length"];
  const upstream = https.request(
    {
      hostname: origin.hostname,
      port: origin.port || 443,
      path: req.url,
      method: req.method,
      headers,
      timeout: 15000,
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "Backend unavailable." }));
    } else res.end();
  });
  if (req.body !== undefined)
    upstream.end(
      typeof req.body === "string" || Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body),
    );
  else req.pipe(upstream);
};
