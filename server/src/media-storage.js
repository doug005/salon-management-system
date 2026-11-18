import path from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const root = fileURLToPath(new URL("../../.local/business-media/", import.meta.url));

export function mediaStorage() {
  const valid = (key) => {
    if (!/^[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(key)) throw new Error("Invalid storage key");
    return key;
  };
  if (process.env.AD_STORAGE === "s3") {
    const bucket = process.env.AD_S3_BUCKET;
    if (!bucket) throw new Error("Media storage not configured");
    const client = new S3Client({
      region: process.env.AD_S3_REGION || "auto",
      endpoint: process.env.AD_S3_ENDPOINT || undefined,
    });
    const keyFor = (key) => `business-media/${valid(key)}`;
    return {
      put: (key, data, type) => client.send(new PutObjectCommand({ Bucket: bucket, Key: keyFor(key), Body: data, ContentType: type })),
      get: async (key) => Buffer.from(await (await client.send(new GetObjectCommand({ Bucket: bucket, Key: keyFor(key) }))).Body.transformToByteArray()),
      remove: (key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyFor(key) })),
    };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Production requires configured media object storage");
  return {
    put: async (key, data) => { await mkdir(root, { recursive: true }); await writeFile(path.join(root, valid(key)), data, { flag: "wx", mode: 0o600 }); },
    get: (key) => readFile(path.join(root, valid(key))),
    remove: async (key) => { try { await unlink(path.join(root, valid(key))); } catch (error) { if (error.code !== "ENOENT") throw error; } },
  };
}
