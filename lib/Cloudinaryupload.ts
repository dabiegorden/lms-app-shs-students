import cloudinary from "@/lib/cloudinary";
import type { IAttachment } from "@/models/Announcement";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES_PER_UPLOAD = 5;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const RAW_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

export const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES, ...RAW_TYPES];

// ─── Determine Cloudinary resource_type from MIME ─────────────────────────────
function getResourceType(mimeType: string): "image" | "video" | "raw" {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (VIDEO_TYPES.includes(mimeType)) return "video";
  return "raw";
}

// ─── Upload a single File to Cloudinary ──────────────────────────────────────
export async function uploadToCloudinary(
  file: File,
  folder: string = "announcements",
): Promise<IAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: File must be smaller than 25MB.`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: File type not supported.`);
  }

  const resourceType = getResourceType(file.type);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload as a base64 data URI
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
    originalName: file.name,
    resourceType,
    format: result.format ?? file.name.split(".").pop() ?? "",
    bytes: result.bytes ?? file.size,
    width: result.width,
    height: result.height,
  };
}

// ─── Upload multiple files ────────────────────────────────────────────────────
export async function uploadManyToCloudinary(
  files: File[],
  folder: string = "announcements",
): Promise<{ attachments: IAttachment[]; errors: string[] }> {
  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw new Error(`Maximum ${MAX_FILES_PER_UPLOAD} files per upload.`);
  }

  const attachments: IAttachment[] = [];
  const errors: string[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const attachment = await uploadToCloudinary(file, folder);
        attachments.push(attachment);
      } catch (err: any) {
        errors.push(err.message ?? `Failed to upload ${file.name}`);
      }
    }),
  );

  return { attachments, errors };
}

// ─── Delete a single asset from Cloudinary ───────────────────────────────────
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "raw",
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (err: any) {
    console.warn("[CLOUDINARY DELETE WARN]", publicId, err.message);
  }
}

// ─── Delete multiple assets ───────────────────────────────────────────────────
export async function deleteManyFromCloudinary(
  attachments: IAttachment[],
): Promise<void> {
  await Promise.all(
    attachments.map((a) => deleteFromCloudinary(a.publicId, a.resourceType)),
  );
}

export { MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE };
