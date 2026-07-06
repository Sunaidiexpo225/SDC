import { v2 as cloudinary } from "cloudinary";

// Server-only. Credentials come from env — either CLOUDINARY_URL
// (cloudinary://<key>:<secret>@<cloud>) or the three CLOUDINARY_* vars. The
// secret never leaves the server; the browser uploads directly to Cloudinary
// with a short-lived signature we generate here.
function resolveCreds() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  };
}

const CREDS = resolveCreds();
export const CLOUDINARY_CLOUD = CREDS.cloudName;

export function cloudinaryEnabled(): boolean {
  return !!(CREDS.cloudName && CREDS.apiKey && CREDS.apiSecret);
}

if (cloudinaryEnabled()) {
  cloudinary.config({
    cloud_name: CREDS.cloudName,
    api_key: CREDS.apiKey,
    api_secret: CREDS.apiSecret,
    secure: true,
  });
}

// Signature for a browser-direct (unsigned-file) upload. The browser POSTs the
// file plus these fields to the upload endpoint; Cloudinary verifies the
// signature so only our server can authorize uploads.
export function signUpload(folder: string, resourceType: "image" | "video") {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    CREDS.apiSecret,
  );
  return {
    cloudName: CREDS.cloudName,
    apiKey: CREDS.apiKey,
    timestamp,
    signature,
    folder,
    resourceType,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CREDS.cloudName}/${resourceType}/upload`,
  };
}
