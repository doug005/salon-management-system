import express from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Advertisement as Ad,
  AdvertisementImage as Image,
  AdvertisementLock as Lock,
  User,
} from "./models.js";
import { businessScope } from "./tenancy.js";
import { tx, fail, audit } from "./business.js";
import { allowRoles } from "./auth.js";
import { imageStorage } from "./ad-storage.js";
const week = 7 * 86400000;
export const activeAds = (now = new Date()) => ({
  status: "published",
  startsAt: { $lte: now },
  endsAt: { $gt: now },
});
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const content = z
  .object({
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().max(2000).default(""),
  })
  .strict();
async function locked(professional, callback) {
  await Lock.updateOne(
    { professional },
    { $setOnInsert: { professional } },
    { upsert: true },
  ).catch((e) => {
    if (e.code !== 11000) throw e;
  });
  return tx(async (session) => {
    await Lock.updateOne(
      { professional },
      { $inc: { revision: 1 } },
      { session },
    );
    return callback(session);
  });
}
export async function cleanupAdvertisements(
  now = new Date(),
  storage = imageStorage(),
) {
  const expired = await Ad.find({
    status: "published",
    endsAt: { $lte: now },
  }).select("_id professional");
  for (const ad of expired)
    await locked(ad.professional, async (session) => {
      await Ad.updateOne(
        { _id: ad._id, status: "published", endsAt: { $lte: now } },
        { $set: { status: "expired" }, $unset: { image: 1, video: 1 } },
        { session },
      );
    });
  // Grace period protects uploads in progress; durable staged records survive process crashes.
  const images = await Image.find({
    $or: [
      { state: { $in: ["deleting", "ready"] } },
      { createdAt: { $lte: new Date(+now - 3600000) } },
    ],
  });
  for (const image of images) {
    try {
      const claimed = await locked(image.professional, async (session) => {
        if (
          await Ad.exists({
            $or: [{ image: image._id }, { video: image._id }],
          }).session(session)
        )
          return false;
        return Image.findOneAndUpdate(
          { _id: image._id },
          { $set: { state: "deleting" } },
          { session, new: true },
        );
      });
      if (!claimed) continue;
      await storage.remove(image.key);
      await Image.deleteOne({ _id: image._id, state: "deleting" });
    } catch {
      await Image.updateOne(
        { _id: image._id },
        { $inc: { failureCount: 1 }, $set: { lastFailureAt: new Date() } },
      );
      console.error("Advertisement image cleanup failed; scheduled for retry.");
    }
  }
}
const view = (ad) => ({
  _id: ad._id,
  professional: ad.professional,
  title: ad.title,
  body: ad.body,
  status: ad.status,
  startsAt: ad.startsAt,
  endsAt: ad.endsAt,
  imageUrl: ad.image ? `/api/public/advertisements/${ad._id}/image` : null,
  videoUrl: ad.video ? `/api/public/advertisements/${ad._id}/video` : null,
});
export function publicAdvertisementRoutes(app) {
  app.get("/api/public/advertisements", async (req, res) => {
    const professional = req.query.professional
      ? id.parse(req.query.professional)
      : undefined;
    const active = await User.find({
      role: "professional",
      active: true,
      ...(professional ? { _id: professional } : {}),
    }).select("_id");
    const rows = await Ad.find({
      ...activeAds(),
      professional: { $in: active.map((u) => u._id) },
    })
      .sort({ startsAt: -1 })
      .limit(100);
    res.set("Cache-Control", "no-store").json({ items: rows.map(view) });
  });
  app.get("/api/public/advertisements/:id/image", async (req, res) => {
    const ad = await Ad.findOne({
      _id: id.parse(req.params.id),
      ...activeAds(),
    });
    if (
      !ad ||
      !ad.image ||
      !(await User.exists({
        _id: ad.professional,
        active: true,
        role: "professional",
      }))
    )
      fail(404, "Image unavailable.");
    const image = await Image.findOne({
      _id: ad.image,
      state: "ready",
      professional: ad.professional,
      mimeType: "image/webp",
    });
    if (!image) fail(404, "Image unavailable.");
    res
      .set("Cache-Control", "no-store")
      .set("Cross-Origin-Resource-Policy", "cross-origin")
      .type("webp")
      .send(await imageStorage().get(image.key));
  });
  app.get("/api/public/advertisements/:id/video", async (req, res) => {
    const ad = await Ad.findOne({
      _id: id.parse(req.params.id),
      ...activeAds(),
    });
    if (
      !ad?.video ||
      !(await User.exists({
        _id: ad.professional,
        active: true,
        role: "professional",
      }))
    )
      fail(404, "Video unavailable.");
    const video = await Image.findOne({
      _id: ad.video,
      state: "ready",
      professional: ad.professional,
      mimeType: { $in: ["video/mp4", "video/webm"] },
    });
    if (!video) fail(404, "Video unavailable.");
    const data = await imageStorage().get(video.key);
    res
      .set("Accept-Ranges", "bytes")
      .set("Cache-Control", "no-store")
      .set("Cross-Origin-Resource-Policy", "cross-origin");
    res.type(video.mimeType);
    const header = req.get("Range");
    if (header) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(header);
      if (!match || (!match[1] && !match[2])) {
        res.set("Content-Range", `bytes */${data.length}`).status(416).end();
        return;
      }
      const suffix = !match[1];
      const start = suffix
        ? Math.max(0, data.length - Number(match[2]))
        : Number(match[1]);
      const end = suffix
        ? data.length - 1
        : Math.min(data.length - 1, match[2] ? Number(match[2]) : data.length - 1);
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end < start ||
        start >= data.length
      ) {
        res.set("Content-Range", `bytes */${data.length}`).status(416).end();
        return;
      }
      res
        .status(206)
        .set("Content-Range", `bytes ${start}-${end}/${data.length}`)
        .set("Content-Length", String(end - start + 1))
        .send(data.subarray(start, end + 1));
      return;
    }
    res.set("Content-Length", String(data.length)).send(data);
  });
}
export function privateAdvertisementRoutes(app) {
  const base = "/api/professional/advertisements";
  app.use(base, allowRoles("professional"));
  app.get(base, async (req, res) => {
    const rows = await Ad.find(businessScope(req.user)).sort({ createdAt: -1 });
    res.set("Cache-Control", "no-store").json({
      items: rows.map((ad) => ({
        ...view(ad),
        status:
          ad.status === "published" && +ad.endsAt <= Date.now()
            ? "expired"
            : ad.status,
      })),
    });
  });
  app.post(base, async (req, res) =>
    res.status(201).json(
      await Ad.create({
        ...content.parse(req.body),
        ...businessScope(req.user),
      }),
    ),
  );
  const mutate = async (req, action, callback) => {
    const scope = { ...businessScope(req.user), _id: id.parse(req.params.id) };
    return locked(req.user._id, async (session) => {
      const ad = await Ad.findOne(scope).session(session);
      if (!ad) fail(404, "Advertisement not found.");
      const result = await callback(ad, session);
      await audit(
        req.user._id,
        action,
        "Advertisement",
        ad._id,
        "",
        session,
        req.user._id,
      );
      return result;
    });
  };
  app.patch(base + "/:id", async (req, res) => {
    const data = content.parse(req.body);
    res.json(
      await mutate(req, "advertisement.edit", async (ad, session) => {
        Object.assign(ad, data);
        await ad.save({ session });
        return view(ad);
      }),
    );
  });
  app.post(base + "/:id/publish", async (req, res) =>
    res.json(
      await mutate(req, "advertisement.publish", async (ad, session) => {
        const now = new Date();
        if (ad.status === "published" && +ad.endsAt > +now)
          fail(
            409,
            "Already published. Unpublish before starting a new period.",
          );
        if (
          (await Ad.countDocuments({
            professional: req.user._id,
            ...activeAds(now),
          }).session(session)) >= 3
        )
          fail(409, "Maximum three active advertisements.");
        ad.status = "published";
        ad.startsAt = now;
        ad.endsAt = new Date(+now + week);
        await ad.save({ session });
        return view(ad);
      }),
    ),
  );
  app.post(base + "/:id/unpublish", async (req, res) =>
    res.json(
      await mutate(req, "advertisement.unpublish", async (ad, session) => {
        ad.status = "unpublished";
        await ad.save({ session });
        return view(ad);
      }),
    ),
  );
  app.delete(base + "/:id", async (req, res) => {
    await mutate(req, "advertisement.delete", async (ad, session) => {
      await ad.deleteOne({ session });
    });
    res.status(204).end();
  });
  app.delete(base + "/:id/media", async (req, res) => {
    res.json(
      await mutate(req, "advertisement.media_removed", async (ad, session) => {
        for (const mediaId of [ad.image, ad.video].filter(Boolean))
          await Image.updateOne(
            { _id: mediaId, professional: req.user._id },
            { $set: { state: "deleting" } },
            { session },
          );
        ad.image = undefined;
        ad.video = undefined;
        await ad.save({ session });
        return view(ad);
      }),
    );
  });
  app.put(
    base + "/:id/image",
    express.raw({
      type: ["image/png", "image/jpeg", "image/webp"],
      limit: "5mb",
    }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Upload a PNG, JPEG or WebP image up to 5 MB.");
      // Check ownership before decoding or writing files.
      if (
        !(await Ad.exists({
          ...businessScope(req.user),
          _id: id.parse(req.params.id),
        }))
      )
        fail(404, "Advertisement not found.");
      let data;
      try {
        const decoder = sharp(req.body, {
          limitInputPixels: 20000000,
          animated: false,
        });
        const metadata = await decoder.metadata();
        if (
          !["png", "jpeg", "webp"].includes(metadata.format) ||
          (metadata.pages || 1) > 1
        )
          fail(400, "Unsupported image.");
        data = await decoder
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        fail(
          400,
          "Invalid image. Use a non-animated PNG, JPEG or WebP up to 20 megapixels.",
        );
      }
      const image = await Image.create({
        professional: req.user._id,
        key: randomUUID() + ".webp",
      });
      try {
        await imageStorage().put(image.key, data);
        const result = await mutate(
          req,
          "advertisement.image",
          async (ad, session) => {
            const ready = await Image.findOneAndUpdate(
              { _id: image._id, state: "staged" },
              { $set: { state: "ready" } },
              { session, new: true },
            );
            if (!ready) fail(409, "Upload expired. Retry.");
            if (ad.image)
              await Image.updateOne(
                { _id: ad.image, professional: req.user._id },
                { $set: { state: "deleting" } },
                { session },
              );
            if (ad.video)
              await Image.updateOne(
                { _id: ad.video, professional: req.user._id },
                { $set: { state: "deleting" } },
                { session },
              );
            ad.image = image._id;
            ad.video = undefined;
            await ad.save({ session });
            return view(ad);
          },
        );
        res.json(result);
      } catch (error) {
        await Image.updateOne(
          { _id: image._id },
          { $set: { state: "deleting" } },
        );
        throw error;
      }
    },
  );
  app.put(
    base + "/:id/video",
    express.raw({ type: ["video/mp4", "video/webm"], limit: "50mb" }),
    async (req, res) => {
      const contentType = req.get("Content-Type")?.split(";")[0].trim();
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Upload an MP4 or WebM video up to 50 MB.");
      if (
        !(await Ad.exists({
          ...businessScope(req.user),
          _id: id.parse(req.params.id),
        }))
      )
        fail(404, "Advertisement not found.");
      const isMp4 =
        req.body.length >= 12 &&
        req.body.toString("ascii", 4, 8) === "ftyp" &&
        req.body.readUInt32BE(0) >= 8 &&
        req.body.readUInt32BE(0) <= req.body.length;
      const isWebm =
        req.body.length >= 4 &&
        req.body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
        req.body
          .subarray(0, Math.min(req.body.length, 4096))
          .includes(Buffer.from("webm"));
      if (
        (contentType === "video/mp4" && !isMp4) ||
        (contentType === "video/webm" && !isWebm) ||
        !["video/mp4", "video/webm"].includes(contentType)
      )
        fail(400, "Video content does not match the MP4 or WebM content type.");
      const extension = contentType === "video/mp4" ? "mp4" : "webm";
      const video = await Image.create({
        professional: req.user._id,
        key: `${randomUUID()}.${extension}`,
        mimeType: contentType,
      });
      try {
        await imageStorage().put(video.key, req.body, contentType);
        const result = await mutate(
          req,
          "advertisement.video",
          async (ad, session) => {
            const ready = await Image.findOneAndUpdate(
              {
                _id: video._id,
                professional: req.user._id,
                state: "staged",
              },
              { $set: { state: "ready" } },
              { session, new: true },
            );
            if (!ready) fail(409, "Upload expired. Retry.");
            if (ad.image)
              await Image.updateOne(
                { _id: ad.image, professional: req.user._id },
                { $set: { state: "deleting" } },
                { session },
              );
            if (ad.video)
              await Image.updateOne(
                { _id: ad.video, professional: req.user._id },
                { $set: { state: "deleting" } },
                { session },
              );
            ad.image = undefined;
            ad.video = video._id;
            await ad.save({ session });
            return view(ad);
          },
        );
        res.json(result);
      } catch (error) {
        await Image.updateOne(
          { _id: video._id },
          { $set: { state: "deleting" } },
        );
        throw error;
      }
    },
  );
}
