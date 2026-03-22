import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: "student" | "instructor";
  // Student-only fields
  school?: string;
  classLevel?: string;
  programme?: string;
  // Profile
  profilePicture?: string;
  profilePicturePublicId?: string; // Cloudinary public_id for deletion
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: ["student", "instructor"],
      default: "student",
    },
    // Student-only fields
    school: { type: String, trim: true },
    classLevel: { type: String, trim: true },
    programme: { type: String, trim: true },
    // Profile picture
    profilePicture: { type: String, default: "" },
    profilePicturePublicId: { type: String, default: "" },
  },
  { timestamps: true },
);

// Prevent model re-registration on hot reload (Next.js dev)
const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
