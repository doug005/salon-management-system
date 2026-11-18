import nodemailer from "nodemailer";
import { Notification, User } from "./models.js";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function template(title, message) {
  return {
    subject: title,
    text: message,
    html: `<main><h1>${escape(title)}</h1><p>${escape(message)}</p><p>Payments are verified manually by the salon. A payment record or receipt image alone does not confirm receipt of funds.</p></main>`,
  };
}
export async function deliverPending(
  config,
  transportFactory = nodemailer.createTransport,
) {
  const cutoff = new Date(Date.now() - 5 * 60000);
  for (let i = 0; i < 20; i++) {
    const notification = await Notification.findOneAndUpdate(
      {
        status: { $in: ["pending", "failed"] },
        attempts: { $lt: 3 },
        $and: [
          {
            $or: [
              { scope: "personal", professional: { $exists: false } },
              { scope: "platform", professional: { $exists: false } },
              { scope: "business", professional: { $type: "objectId" } },
            ],
          },
          {
            $or: [
              { lockedAt: { $exists: false } },
              { lockedAt: { $lt: cutoff } },
            ],
          },
        ],
      },
      { $set: { lockedAt: new Date() }, $inc: { attempts: 1 } },
      { new: true, sort: { createdAt: 1 } },
    );
    if (!notification) break;
    try {
      if (config.EMAIL_MODE !== "smtp") {
        notification.status = "simulated";
        notification.lastError = undefined;
      } else {
        const user = await User.findById(notification.recipient);
        if (!user?.active) throw new Error("Recipient unavailable");
        const transport = transportFactory({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_PORT === 465,
          auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
          connectionTimeout: 10000,
        });
        await transport.sendMail({
          from: config.SMTP_FROM,
          to: user.email,
          ...template(notification.title, notification.message),
        });
        notification.status = "sent";
        notification.lastError = undefined;
      }
    } catch {
      notification.status = "failed";
      notification.lastError =
        "Delivery failed. Check SMTP configuration; credentials are never logged.";
    }
    await notification.save();
  }
}
