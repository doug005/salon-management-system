import { randomBytes, createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { AuthChallenge } from "./models.js";
import { template } from "./notifications.js";

const digest = (token) => createHash("sha256").update(token).digest("hex");
const lifetimes = { email_verification: 30 * 60_000, password_reset: 30 * 60_000, google_nonce: 5 * 60_000 };

export async function createChallenge(user, purpose, session) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = digest(token);
  await AuthChallenge.updateMany(
    { user: user?._id, purpose, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } },
    session ? { session } : undefined,
  );
  const [challenge] = await AuthChallenge.create([{
    ...(user?._id ? { user: user._id } : {}),
    purpose,
    tokenHash,
    expiresAt: new Date(Date.now() + lifetimes[purpose]),
  }], session ? { session } : undefined);
  return { token, challenge };
}

export async function consumeChallenge(token, purpose, session) {
  if (typeof token !== "string" || token.length < 32 || token.length > 200) return null;
  return AuthChallenge.findOneAndUpdate(
    {
      purpose,
      tokenHash: digest(token),
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
    { new: true, ...(session ? { session } : {}) },
  );
}

export async function sendAccountEmail(config, user, purpose, token, transportFactory = nodemailer.createTransport) {
  const challenge = await AuthChallenge.findOne({
    user: user._id,
    purpose,
    tokenHash: digest(token),
  });
  if (!challenge) return "failed";
  if (config.EMAIL_MODE !== "smtp") {
    challenge.deliveryStatus = "simulated";
    await challenge.save();
    return "simulated";
  }
  try {
    const path = purpose === "email_verification" ? "/verify-email" : "/reset-password";
    const url = new URL(path, config.CLIENT_ORIGIN);
    url.searchParams.set("token", token);
    const title = purpose === "email_verification" ? "Verify your salon account email" : "Reset your salon account password";
    const message = purpose === "email_verification"
      ? `Use this one-time link within 30 minutes to verify your email address: ${url.toString()}`
      : `Use this one-time link within 30 minutes to reset your password: ${url.toString()}`;
    const transport = transportFactory({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
      connectionTimeout: 10000,
    });
    await transport.sendMail({ from: config.SMTP_FROM, to: user.email, ...template(title, message) });
    challenge.deliveryStatus = "sent";
    await challenge.save();
    return "sent";
  } catch {
    challenge.deliveryStatus = "failed";
    challenge.lastError = "Delivery failed. Check SMTP configuration; credentials are never logged.";
    await challenge.save();
    return "failed";
  }
}
