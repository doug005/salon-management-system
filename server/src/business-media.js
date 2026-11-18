import express from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { BusinessMedia as Media, ProfessionalProfile, Service, User } from "./models.js";
import { businessScope, publishedProfessionalIds } from "./tenancy.js";
import { allowRoles } from "./auth.js";
import { fail, tx, audit } from "./business.js";
import { mediaStorage } from "./media-storage.js";

const id = z.string().regex(/^[a-f0-9]{24}$/i);
const storage = () => mediaStorage();

async function uploadImage(req, kind, ownerCallback) {
  if (!Buffer.isBuffer(req.body) || !req.body.length) fail(400, "Upload a PNG, JPEG or WebP image up to 5 MB.");
  let data;
  try {
    const decoder = sharp(req.body, { limitInputPixels: 20000000, animated: false });
    const metadata = await decoder.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format) || (metadata.pages || 1) > 1) fail(400, "Unsupported image.");
    data = await decoder.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error.status) throw error;
    fail(400, "Invalid image. Use a non-animated PNG, JPEG or WebP up to 20 megapixels.");
  }
  const media = await Media.create({ professional: req.user._id, kind, key: randomUUID() + ".webp" });
  try {
    await storage().put(media.key, data, "image/webp");
    return await tx(async (session) => {
      const ready = await Media.findOneAndUpdate({ _id: media._id, state: "staged", professional: req.user._id }, { $set: { state: "ready" } }, { session, new: true });
      if (!ready) fail(409, "Upload expired. Retry.");
      return ownerCallback(media, session);
    });
  } catch (error) {
    await Media.updateOne({ _id: media._id }, { $set: { state: "deleting" } });
    throw error;
  }
}

export async function cleanupBusinessMedia() {
  const now = new Date();
  const rows = await Media.find({ $or: [{ state: "deleting" }, { createdAt: { $lte: new Date(+now - 3600000) }, state: "staged" }] });
  for (const media of rows) {
    const referenced = await Promise.all([
      ProfessionalProfile.exists({ photo: media._id }),
      Service.exists({ image: media._id }),
    ]);
    if (referenced.some(Boolean)) continue;
    try {
      await storage().remove(media.key);
      await Media.deleteOne({ _id: media._id, state: { $in: ["staged", "deleting"] } });
    } catch {
      console.error("Business media cleanup failed; scheduled for retry.");
    }
  }
}

export function publicBusinessMediaRoutes(app) {
  app.get("/api/public/professionals/:id/photo", async (req, res) => {
    const profile = await ProfessionalProfile.findOne({ professional: id.parse(req.params.id), published: true }).populate("photo");
    if (!profile?.photo || profile.photo.state !== "ready" || profile.photo.kind !== "profile" || String(profile.photo.professional) !== String(profile.professional)) fail(404, "Profile photo unavailable.");
    if (!(await User.exists({ _id: profile.professional, role: "professional", active: true }))) fail(404, "Profile photo unavailable.");
    res.set("Cache-Control", "no-store").set("Cross-Origin-Resource-Policy", "cross-origin").type("webp").send(await storage().get(profile.photo.key));
  });

  app.get("/api/public/services/:id/image", async (req, res) => {
    const service = await Service.findOne({ _id: id.parse(req.params.id), active: true }).populate("image");
    if (!service?.image || service.image.state !== "ready" || service.image.kind !== "service" || String(service.image.professional) !== String(service.professional)) fail(404, "Service image unavailable.");
    const ids = await publishedProfessionalIds();
    if (!ids.some((value) => String(value) === String(service.professional))) fail(404, "Service image unavailable.");
    res.set("Cache-Control", "no-store").set("Cross-Origin-Resource-Policy", "cross-origin").type("webp").send(await storage().get(service.image.key));
  });
}

export function privateBusinessMediaRoutes(app) {
  app.use(["/api/professional/profile/photo", "/api/professional/services/:id/image"], allowRoles("professional"));

  app.put("/api/professional/profile/photo", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "5mb" }), async (req, res) => {
    res.json(await uploadImage(req, "profile", async (media, session) => {
      const profile = await ProfessionalProfile.findOneAndUpdate({ ...businessScope(req.user) }, { $set: { photo: media._id } }, { session, new: true, upsert: true, setDefaultsOnInsert: true });
      await audit(req.user._id, "profile.photo_updated", "ProfessionalProfile", profile._id, "", session, req.user._id);
      return { photoUrl: `/api/public/professionals/${req.user._id}/photo`, updatedAt: profile.updatedAt };
    }));
  });

  app.delete("/api/professional/profile/photo", async (req, res) => {
    await tx(async (session) => {
      const profile = await ProfessionalProfile.findOne({ ...businessScope(req.user) }).session(session);
      if (!profile?.photo) return;
      const old = await Media.findById(profile.photo).session(session);
      profile.photo = undefined;
      await profile.save({ session });
      if (old) await Media.updateOne({ _id: old._id }, { $set: { state: "deleting" } }, { session });
      await audit(req.user._id, "profile.photo_removed", "ProfessionalProfile", profile._id, "", session, req.user._id);
    });
    res.json({ photoUrl: null });
  });

  app.put("/api/professional/services/:id/image", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "5mb" }), async (req, res) => {
    const serviceId = id.parse(req.params.id);
    res.json(await uploadImage(req, "service", async (media, session) => {
      const service = await Service.findOneAndUpdate({ _id: serviceId, ...businessScope(req.user) }, { $set: { image: media._id } }, { session, new: true });
      if (!service) fail(404, "Service not found.");
      await audit(req.user._id, "service.image_updated", "Service", service._id, "", session, req.user._id);
      return { imageUrl: `/api/public/services/${service._id}/image`, updatedAt: service.updatedAt };
    }));
  });

  app.delete("/api/professional/services/:id/image", async (req, res) => {
    const serviceId = id.parse(req.params.id);
    await tx(async (session) => {
      const service = await Service.findOne({ _id: serviceId, ...businessScope(req.user) }).session(session);
      if (!service) fail(404, "Service not found.");
      if (service.image) await Media.updateOne({ _id: service.image }, { $set: { state: "deleting" } }, { session });
      service.image = undefined;
      await service.save({ session });
      await audit(req.user._id, "service.image_removed", "Service", service._id, "", session, req.user._id);
    });
    res.json({ imageUrl: null });
  });
}
