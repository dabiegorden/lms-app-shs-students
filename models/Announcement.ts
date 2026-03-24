import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Attachment (Cloudinary-backed) ──────────────────────────────────────────

export interface IAttachment {
  publicId: string; // Cloudinary public_id for deletion
  url: string; // Secure delivery URL
  originalName: string; // Original filename shown in UI
  resourceType: "image" | "video" | "raw"; // Cloudinary resource type
  format: string; // e.g. "pdf", "png", "mp4"
  bytes: number; // File size
  width?: number; // For images/videos
  height?: number;
}

// ─── Announcement document ────────────────────────────────────────────────────

export interface IAnnouncement extends Document {
  _id: mongoose.Types.ObjectId;

  // ── Content ──────────────────────────────────────────────────────────────
  title: string;
  body: string; // Rich text / markdown body
  attachments: IAttachment[]; // Cloudinary files

  // ── Targeting ────────────────────────────────────────────────────────────
  instructor: mongoose.Types.ObjectId;
  targetType: "all" | "class" | "subject" | "course";
  targetClassLevel: string[]; // e.g. ["SHS 1", "SHS 2"]
  targetSubjects: string[]; // e.g. ["Physics", "Chemistry"]
  targetCourses: mongoose.Types.ObjectId[]; // specific course IDs

  // ── Settings ─────────────────────────────────────────────────────────────
  isPinned: boolean;
  allowComments: boolean;
  status: "draft" | "published";
  publishedAt: Date | null;

  // ── Engagement (denormalised) ─────────────────────────────────────────────
  viewsCount: number;
  commentsCount: number;
  likesCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const AttachmentSchema = new Schema<IAttachment>(
  {
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    originalName: { type: String, required: true, default: "file" },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      default: "raw",
    },
    format: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must be under 200 characters"],
    },
    body: {
      type: String,
      required: [true, "Body is required"],
      trim: true,
      maxlength: [10000, "Body must be under 10000 characters"],
    },
    attachments: { type: [AttachmentSchema], default: [] },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["all", "class", "subject", "course"],
      default: "all",
    },
    targetClassLevel: { type: [String], default: [] },
    targetSubjects: { type: [String], default: [] },
    targetCourses: { type: [Schema.Types.ObjectId], default: [] },

    isPinned: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    publishedAt: { type: Date, default: null },

    viewsCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Set publishedAt when status transitions to published
AnnouncementSchema.pre("save", async function () {
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
});

// Indexes
AnnouncementSchema.index({ title: "text", body: "text" });
AnnouncementSchema.index({ instructor: 1, createdAt: -1 });
AnnouncementSchema.index({ instructor: 1, isPinned: -1, createdAt: -1 });
AnnouncementSchema.index({ status: 1, targetType: 1 });

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ??
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);

export default Announcement;
