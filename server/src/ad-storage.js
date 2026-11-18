import path from "node:path";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
const root = fileURLToPath(new URL("../../.local/ad-images/", import.meta.url));
export function imageStorage() {
  const valid = (key) => {
    if (!/^[a-f0-9-]{36}\.(webp|mp4|webm)$/.test(key))
      throw new Error("Invalid storage key");
    return key;
  };
  if (process.env.AD_STORAGE === "s3") {
    const bucket = process.env.AD_S3_BUCKET;
    if (!bucket) throw new Error("Advertisement storage not configured");
    const client = new S3Client({
      region: process.env.AD_S3_REGION || "auto",
      endpoint: process.env.AD_S3_ENDPOINT || undefined,
    });
    const Key = (key) => `advertisements/${valid(key)}`;
    return {
      put: (key, data, contentType = "image/webp") =>
        client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: Key(key),
            Body: data,
            ContentType: contentType,
          }),
        ),
      get: async (key) =>
        Buffer.from(
          await (
            await client.send(
              new GetObjectCommand({ Bucket: bucket, Key: Key(key) }),
            )
          ).Body.transformToByteArray(),
        ),
      remove: (key) =>
        client.send(new DeleteObjectCommand({ Bucket: bucket, Key: Key(key) })),
    };
  }
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Production requires configured advertisement object storage",
    );
  return {
    put: async (key, data) => {
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, valid(key)), data, {
        flag: "wx",
        mode: 0o600,
      });
    },
    get: (key) => readFile(path.join(root, valid(key))),
    remove: async (key) => {
      try {
        await unlink(path.join(root, valid(key)));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    },
  };
}
