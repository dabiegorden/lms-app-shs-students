import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { IAttachment } from "./Announcement";

// ─── Comment document ─────────────────────────────────────────────────────────

export interface IAnnouncementComment extends Document {
  _id: mongoose.Types.ObjectId;
  announcement: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId; // ref: User (student or instructor)
  authorRole: "student" | "instructor";

  body: string;
  attachments: IAttachment[]; // optional image/file reply

  // Threading — one level deep (reply to top-level comment)
  parentComment: mongoose.Types.ObjectId | null;
  repliesCount: number; // denormalised

  // Engagement
  likes: mongoose.Types.ObjectId[]; // user IDs who liked
  likesCount: number; // denormalised

  isEdited: boolean;
  editedAt: Date | null;
  isDeleted: boolean; // soft-delete — show "deleted" placeholder

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const AttachmentSchema = new Schema(
  {
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    originalName: { type: String, default: "file" },
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

const AnnouncementCommentSchema = new Schema<IAnnouncementComment>(
  {
    announcement: {
      type: Schema.Types.ObjectId,
      ref: "Announcement",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorRole: {
      type: String,
      enum: ["student", "instructor"],
      required: true,
    },
    body: {
      type: String,
      trim: true,
      maxlength: [2000, "Comment must be under 2000 characters"],
      default: "",
    },
    attachments: { type: [AttachmentSchema], default: [] },

    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "AnnouncementComment",
      default: null,
    },
    repliesCount: { type: Number, default: 0 },

    likes: { type: [Schema.Types.ObjectId], default: [] },
    likesCount: { type: Number, default: 0 },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Indexes
AnnouncementCommentSchema.index({
  announcement: 1,
  parentComment: 1,
  createdAt: 1,
});
AnnouncementCommentSchema.index({ author: 1 });

const AnnouncementComment: Model<IAnnouncementComment> =
  mongoose.models.AnnouncementComment ??
  mongoose.model<IAnnouncementComment>(
    "AnnouncementComment",
    AnnouncementCommentSchema,
  );

export default AnnouncementComment;
