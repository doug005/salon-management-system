import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import {
  User,
  ProfessionalProfile,
  Service,
  Advertisement,
  AdvertisementImage,
  BusinessMedia,
} from "../src/models.js";
import { mediaStorage } from "../src/media-storage.js";
import { imageStorage } from "../src/ad-storage.js";

const identities = {
  admin: { name: "Mpho Mokoena", email: "admin@salondemo.example" },
  professional: { name: "Lerato Thabane", email: "lerato@salondemo.example" },
  customer: { name: "Neo Rasebetsi", email: "neo@salondemo.example" },
};

async function loadDemoCredentials() {
  if (process.env.DEMO_SEED_CREDENTIALS_JSON) {
    let supplied;
    try {
      supplied = JSON.parse(process.env.DEMO_SEED_CREDENTIALS_JSON);
    } catch {
      throw new Error("DEMO_SEED_CREDENTIALS_JSON must contain valid JSON.");
    }
    if (
      !supplied ||
      typeof supplied !== "object" ||
      Object.keys(supplied).some((role) => !["admin", "professional", "customer"].includes(role))
    )
      throw new Error("DEMO_SEED_CREDENTIALS_JSON has an invalid shape.");
    const stored = Object.fromEntries(
      ["admin", "professional", "customer"].map((role) => [
        role,
        { ...identities[role], password: supplied[role]?.password },
      ]),
    );
    for (const role of ["admin", "professional", "customer"])
      if (typeof stored[role].password !== "string" || stored[role].password.length < 12)
        throw new Error("DEMO_SEED_CREDENTIALS_JSON is incomplete.");
    return stored;
  }

  const root = fileURLToPath(new URL("../../.local", import.meta.url));
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, "group-demo-credentials.json");
  let stored;
  try {
    stored = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    stored = {
      admin: { ...identities.admin, password: `Mpho-${randomBytes(5).toString("base64url")}` },
      professional: { ...identities.professional, password: `Lerato-${randomBytes(5).toString("base64url")}` },
      customer: { ...identities.customer, password: `Neo-${randomBytes(5).toString("base64url")}` },
    };
    await fs.writeFile(file, JSON.stringify(stored, null, 2), { mode: 0o600, flag: "wx" });
  }
  for (const role of ["admin", "professional", "customer"]) {
    if (!stored[role]?.password || stored[role].password.length < 12) throw new Error("Local demo credentials are incomplete.");
    stored[role] = { ...identities[role], ...stored[role] };
  }
  return stored;
}

const services = [
  ["Knotless Braids", "Lightweight, low-tension knotless braids styled to suit your look.", 90, 35000],
  ["Cornrows", "Neat, long-lasting cornrow styling in a pattern selected with your stylist.", 45, 15000],
  ["Wash and Blow-Dry", "Gentle wash, conditioning and professional blow-dry finish.", 45, 12000],
  ["Gel Manicure", "Clean shaping, cuticle care and durable gel colour.", 60, 18000],
  ["Pedicure", "Soothing foot care, shaping and polished finish.", 60, 22000],
  ["Makeup Session", "Event-ready makeup with a polished finish and consultation.", 90, 30000],
  ["Hair Treatment", "Restorative wash and treatment selected for your hair needs.", 60, 25000],
  ["Wig Installation", "Secure, natural-looking wig fitting and styling.", 120, 40000],
];

const advertisements = [
  ["Braids Special", "Protective braid styling for your next look. Ask Lerato about available dates and care guidance."],
  ["Weekend Beauty Package", "Plan a complete weekend refresh with selected salon beauty services and booking guidance."],
  ["Nail Care Promotion", "Refresh your manicure or pedicure with clean, careful nail care."],
];

async function imageWebp(label, background, accent) {
  const escaped = String(label).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="${background}"/><circle cx="980" cy="120" r="260" fill="${accent}" opacity=".38"/><circle cx="140" cy="620" r="280" fill="#ffffff" opacity=".12"/><text x="80" y="330" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="70" font-weight="700">${escaped}</text><text x="82" y="395" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="28">SALON DEMO · LESOTHO</text></svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 86 }).toBuffer();
}

async function ensurePasswordUser(data, role, createdBy = undefined) {
  let user = await User.findOne({ email: data.email });
  if (!user) {
    user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role,
      active: true,
      ...(createdBy ? { createdBy } : {}),
    });
  } else {
    user.name = data.name;
    user.email = data.email;
    user.role = role;
    user.active = true;
    user.password = data.password;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
  }
  return user;
}

export async function seedGroupDemo() {
  const groupDemoCredentials = await loadDemoCredentials();

  const admin = await ensurePasswordUser(groupDemoCredentials.admin, "admin");
  const professional = await ensurePasswordUser(groupDemoCredentials.professional, "professional", admin._id);
  const customer = await ensurePasswordUser(groupDemoCredentials.customer, "customer");

  const profile = await ProfessionalProfile.findOneAndUpdate(
    { professional: professional._id },
    {
      $set: {
        professional: professional._id,
        published: true,
        salonName: "Lerato Beauty Studio",
        description: "Fictional demonstration salon offering protective styling, nails, makeup and hair care.",
        demo: true,
        currency: "LSL",
        timeZone: "Africa/Maseru",
        whatsappNumber: "26650000000",
        phone: "+266 5000 0000",
        email: professional.email,
        address: "Maseru, Lesotho · demonstration location",
        openingHours: {
          1: "09:00-17:00",
          2: "09:00-17:00",
          3: "09:00-17:00",
          4: "09:00-17:00",
          5: "09:00-17:00",
          6: "09:00-14:00",
        },
        closedDates: [],
        bookingFeeLisente: 5000,
        feeDeducted: true,
        holdMinutes: 60,
        policyText: "Demonstration booking policy: confirm payment arrangements directly with Lerato; an independently verified booking fee confirms the appointment.",
        changeNoticeHours: 24,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  professional.weekdays = [1, 2, 3, 4, 5, 6];
  professional.workStart = "09:00";
  professional.workEnd = "17:00";
  await professional.save();

  if (!profile.photo) {
    const bytes = await imageWebp("Lerato Beauty Studio", "#5f3f82", "#9a7cc0");
    const media = await BusinessMedia.create({ professional: professional._id, kind: "profile", key: `${randomUUID()}.webp`, state: "staged", mimeType: "image/webp" });
    await mediaStorage().put(media.key, bytes, "image/webp");
    media.state = "ready";
    await media.save();
    profile.photo = media._id;
    await profile.save();
  }

  for (let index = 0; index < services.length; index += 1) {
    const [name, description, durationMinutes, priceLisente] = services[index];
    let service = await Service.findOne({ professional: professional._id, name });
    if (!service) {
      service = await Service.create({ professional: professional._id, name, description, durationMinutes, priceLisente, active: true });
    } else {
      service.description = description;
      service.durationMinutes = durationMinutes;
      service.priceLisente = priceLisente;
      service.active = true;
      await service.save();
    }
    if (!service.image) {
      const bytes = await imageWebp(name, index % 2 ? "#6b4b86" : "#4e5a72", index % 2 ? "#b09bcf" : "#8fa3c7");
      const media = await BusinessMedia.create({ professional: professional._id, kind: "service", key: `${randomUUID()}.webp`, state: "staged", mimeType: "image/webp" });
      await mediaStorage().put(media.key, bytes, "image/webp");
      media.state = "ready";
      await media.save();
      service.image = media._id;
      await service.save();
    }
  }

  const targetTitles = new Set(advertisements.map(([title]) => title));
  await Advertisement.updateMany(
    { professional: professional._id, status: "published", title: { $nin: [...targetTitles] } },
    { $set: { status: "unpublished", endsAt: new Date() } },
  );

  const now = new Date();
  for (let index = 0; index < advertisements.length; index += 1) {
    const [title, body] = advertisements[index];
    let ad = await Advertisement.findOne({ professional: professional._id, title });
    if (!ad) ad = await Advertisement.create({ professional: professional._id, title, body, status: "draft" });
    ad.body = body;
    if (!ad.image && !ad.video) {
      const bytes = await imageWebp(title, index === 0 ? "#654382" : index === 1 ? "#4d5d78" : "#815d72", index === 1 ? "#b8a8cf" : "#c9a6bb");
      const media = await AdvertisementImage.create({ professional: professional._id, key: `${randomUUID()}.webp`, mimeType: "image/webp", state: "staged" });
      await imageStorage().put(media.key, bytes, "image/webp");
      media.state = "ready";
      await media.save();
      ad.image = media._id;
      ad.video = undefined;
    }
    if (ad.status !== "published" || !ad.startsAt || !ad.endsAt || ad.endsAt <= now) {
      ad.status = "published";
      ad.startsAt = now;
      ad.endsAt = new Date(+now + 7 * 86400000);
    }
    await ad.save();
  }

  return {
    admin: { id: admin._id.toString(), email: admin.email },
    professional: { id: professional._id.toString(), email: professional.email },
    customer: { id: customer._id.toString(), email: customer.email },
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required.");
  if (process.env.NODE_ENV === "production" && process.env.DEMO_SEED_AUTHORIZED !== "yes") {
    throw new Error("Production demo seeding requires DEMO_SEED_AUTHORIZED=yes.");
  }
  await mongoose.connect(uri);
  await seedGroupDemo();
  await mongoose.disconnect();
}
