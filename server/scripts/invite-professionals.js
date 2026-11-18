import path from "node:path";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { loadConfig } from "../src/config.js";
import { prepareIndexes } from "../src/integrity.js";
import { User } from "../src/models.js";
import { createApp } from "../src/app.js";
import request from "supertest";
import { fileURLToPath } from "node:url";

// Admin JWTs are obtained through the existing authentication API; no password or setup token is printed.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const listPath = path.join(project, ".local/professional-invite-recipients.csv");
const text = await readFile(listPath, "utf8");
const emails = [...new Set(text.split(/\r?\n/).slice(1).map((value) => value.trim().toLowerCase()).filter(Boolean))];
const expected = [
  "katleho073@gmail.com",
  "nereahlebona@gmail.com",
  "khotlemaseapei@gmail.com",
  "relebohilehoody@gmail.com",
].sort();
if (JSON.stringify([...emails].sort()) !== JSON.stringify(expected)) throw new Error("Invitation list must match the four approved addresses exactly.");
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error("MONGODB_URI and JWT_SECRET must be configured privately.");
const config = loadConfig();
await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: config.NODE_ENV !== "production" });
try {
  await prepareIndexes(config.NODE_ENV === "production");
  const existing = await User.find({ email: { $in: emails } }).select("email role active setupPending emailVerified").lean();
  const conflicts = existing.filter((user) => user.role !== "professional" || !user.setupPending || user.emailVerified !== false);
  if (conflicts.length) throw new Error("One or more addresses already belong to a non-pending account. Review each account individually; no invitations were sent.");
  const pending = existing.map((user) => user.email);
  const adminEmail = String(process.env.PROFESSIONAL_INVITER_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) throw new Error("Set PROFESSIONAL_INVITER_EMAIL to the existing administrator address; no password or secret will be read from command-line arguments.");
  const app = createApp(config);
  const response = await request(app).post("/api/auth/login").send({ email: adminEmail, password: process.env.PROFESSIONAL_INVITER_PASSWORD });
  delete process.env.PROFESSIONAL_INVITER_PASSWORD;
  if (response.status !== 200 || response.body.user?.role !== "admin") throw new Error("Administrator authentication failed; no invitation was sent.");
  let sent = 0;
  for (const email of emails) {
    if (pending.includes(email)) continue;
    const result = await request(app).post("/api/admin/professional-invitations")
      .set("Authorization", `Bearer ${response.body.token}`)
      .send({ email });
    if (result.status !== 201) throw new Error(`Invitation operation stopped for ${email} (HTTP ${result.status}). Inspect the approved admin workspace and SMTP configuration; no credential is displayed.`);
    if (result.body.emailDeliveryStatus !== "sent") {
      console.error(`Account prepared for ${email}, but delivery is not configured. No setup token or link was generated for manual sharing.`);
      continue;
    }
    sent++;
  }
  console.log(`Completed secure invitations: ${sent} email(s) delivered by configured SMTP; pending existing invitation(s): ${pending.length}. No passwords or setup tokens were output.`);
  if (config.EMAIL_MODE !== "smtp" || config.EMAIL_DELIVERY_APPROVED !== "yes")
    console.log("SMTP safe mode is active: no email was delivered. Configure explicitly approved SMTP before inviting professionals.");
} finally {
  await mongoose.disconnect();
}
