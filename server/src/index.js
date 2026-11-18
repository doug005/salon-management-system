import { cleanupAdvertisements } from "./advertisements.js";
import { cleanupBusinessMedia } from "./business-media.js";
import http from "node:http";
import mongoose from "mongoose";
import { loadConfig } from "./config.js";
import { prepareIndexes } from "./integrity.js";
import { createApp } from "./app.js";
import { expireHolds } from "./business.js";
import { deliverPending } from "./notifications.js";
try {
  const config = loadConfig();
  mongoose.set("bufferCommands", false);
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: config.NODE_ENV !== "production",
  });
  await prepareIndexes(config.NODE_ENV === "production");
  const server = http.createServer(createApp(config));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(
      config.PORT,
      config.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
      resolve,
    );
  });
  console.log(
    `Salon API listening on http://localhost:${config.PORT}; email mode: ${config.EMAIL_MODE}`,
  );
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const job of [
        expireHolds,
        () => deliverPending(config),
        cleanupAdvertisements,
        cleanupBusinessMedia,
      ]) {
        try {
          await job();
        } catch {
          console.error("Background work failed; it will retry.");
        }
      }
    } finally {
      busy = false;
    }
  }, 30000);
  const stop = () => {
    clearInterval(timer);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch {
  await mongoose.disconnect();
  console.error(
    "Startup failed. Check environment configuration and MongoDB access. Credentials are not logged.",
  );
  process.exit(1);
}
