import { prisma } from "./db";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cloudinaryEnabled } from "./cloudinary";

// Accepted image + video mime types.
export const ALLOWED_MIME =
  /^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|quicktime|webm))$/i;

export type MediaKind = "Image" | "Video" | "Reel";

export function kindFromMime(mime: string): MediaKind {
  return mime.startsWith("image/") ? "Image" : "Video";
}

// ---- Storage driver selection ------------------------------------------
//
// If S3 credentials are configured (Supabase Storage's S3-compatible endpoint
// or AWS S3), uploads go client-direct to the bucket via a presigned URL —
// this bypasses the ~4.5 MB Vercel function body limit, so large videos work.
// Otherwise media falls back to bytes-in-Postgres ("db"), capped small.
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ENDPOINT = process.env.S3_ENDPOINT; // Supabase: https://<ref>.storage.supabase.co/storage/v1/s3
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

// Cloudinary (if configured) also does per-platform resizing, so it wins;
// otherwise S3/Supabase; otherwise bytes-in-Postgres.
export const MEDIA_DRIVER: "cloudinary" | "s3" | "db" = cloudinaryEnabled()
  ? "cloudinary"
  : S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
    ? "s3"
    : "db";

// db is bounded by the serverless body limit; cloudinary/s3 upload direct.
const MAX_MB =
  Number(process.env.MEDIA_MAX_MB) || (MEDIA_DRIVER === "db" ? 4 : 100);
export const MAX_UPLOAD_BYTES = MAX_MB * 1024 * 1024;
export const MAX_UPLOAD_LABEL = `${MAX_MB} MB`;

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT, // undefined => real AWS
      forcePathStyle: !!S3_ENDPOINT, // Supabase / MinIO require path-style
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

export function presignDownload(key: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: 3600 },
  );
}

// A safe, unique object key for an upload.
export function objectKey(eventId: string | null, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `uploads/${eventId || "shared"}/${rand}-${safe}`;
}

// ---- Postgres byte storage (db driver) ---------------------------------

export async function storeMedia(input: {
  eventId?: string | null;
  filename: string;
  mimeType: string;
  kind: MediaKind;
  bytes: Buffer;
}) {
  return prisma.media.create({
    data: {
      eventId: input.eventId ?? null,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.bytes.length,
      kind: input.kind,
      driver: "db",
      status: "ready",
      data: input.bytes,
    },
    select: { id: true, filename: true, mimeType: true, size: true, kind: true },
  });
}

export async function readMedia(id: string) {
  return prisma.media.findUnique({ where: { id } });
}
