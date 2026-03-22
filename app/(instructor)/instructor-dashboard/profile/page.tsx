"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  school?: string;
  classLevel?: string;
  programme?: string;
}

// ─── Avatar Preview ───────────────────────────────────────────────────────────
function AvatarPreview({
  src,
  name,
  size = "lg",
}: {
  src?: string;
  name: string;
  size?: "lg" | "xl";
}) {
  const dim = size === "xl" ? "w-28 h-28 text-4xl" : "w-20 h-20 text-2xl";
  return src ? (
    <img
      src={src}
      alt={name}
      className={`${dim} rounded-full object-cover ring-4 ring-blue-100 shadow-lg`}
    />
  ) : (
    <div
      className={`${dim} rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black ring-4 ring-blue-100 shadow-lg`}
    >
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
        <span className="text-xl">{icon}</span>
        <h2 className="font-black text-slate-800 text-base">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`w-full border rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
          readOnly
            ? "bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200"
            : disabled
              ? "opacity-60 cursor-not-allowed border-slate-200"
              : "border-slate-200"
        }`}
      />
      {hint && <p className="text-[11px] text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}

// ─── Eye Icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      className="w-4.5 h-4.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  ) : (
    <svg
      className="w-4.5 h-4.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ sm }: { sm?: boolean }) {
  const s = sm ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <svg
      className={`animate-spin ${s} shrink-0`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Profile form fields
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [programme, setProgramme] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Picture state
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | undefined>(
    undefined,
  );
  const [pictureSaving, setPictureSaving] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirmNew, setShowConfirmNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ── Fetch current user on mount ────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/profile");
        const data = await res.json();
        if (!res.ok || !data.user) {
          router.push("/login");
          return;
        }
        const u: UserProfile = data.user;
        setUser(u);
        setName(u.name ?? "");
        setSchool(u.school ?? "");
        setClassLevel(u.classLevel ?? "");
        setProgramme(u.programme ?? "");
        setPicturePreview(u.profilePicture);
      } catch {
        router.push("/login");
      } finally {
        setPageLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  // ── Picture file selection → local preview ─────────────────────────────────
  const handlePictureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation before hitting the API
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }

    setPictureFile(file);
    // Show instant local preview while uploading
    const reader = new FileReader();
    reader.onloadend = () => setPicturePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Upload picture to Cloudinary via API ───────────────────────────────────
  const handlePictureUpload = async () => {
    if (!pictureFile) return;
    setPictureSaving(true);
    try {
      // Must be multipart/form-data so the route receives it as a File
      const fd = new FormData();
      fd.append("profilePicture", pictureFile);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        body: fd, // Do NOT set Content-Type manually; browser sets multipart boundary
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Update preview to the Cloudinary CDN URL
      setPicturePreview(data.user.profilePicture);
      setPictureFile(null);
      setUser((prev) =>
        prev ? { ...prev, profilePicture: data.user.profilePicture } : prev,
      );
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload picture.");
      // Revert preview on failure
      setPicturePreview(user?.profilePicture);
      setPictureFile(null);
    } finally {
      setPictureSaving(false);
    }
  };

  // ── Save profile info ──────────────────────────────────────────────────────
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    setProfileSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      if (school) fd.append("school", school.trim());
      if (classLevel) fd.append("classLevel", classLevel);
      if (programme) fd.append("programme", programme);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: data.user.name,
              school: data.user.school,
              classLevel: data.user.classLevel,
              programme: data.user.programme,
            }
          : prev,
      );
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setPasswordSaving(true);
    try {
      const fd = new FormData();
      fd.append("currentPassword", currentPassword);
      fd.append("newPassword", newPassword);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Password changed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-slate-500 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  const newPasswordMatch =
    confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const newPasswordMismatch =
    confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;
  const isStudent = user.role === "student";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow-sm">
          👤
        </div>
        <div>
          <h1 className="font-black text-slate-900 text-xl tracking-tight">
            My Profile
          </h1>
          <p className="text-slate-500 text-sm">
            Manage your account information
          </p>
        </div>
      </div>

      {/* ── Profile Picture Card ──────────────────────────────────────── */}
      <SectionCard title="Profile Picture" icon="🖼️">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar preview */}
          <div className="relative shrink-0">
            <AvatarPreview src={picturePreview} name={name} size="xl" />
            {/* Edit overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors text-base"
              title="Change picture"
            >
              ✏️
            </button>
          </div>

          {/* Instructions + actions */}
          <div className="flex-1 flex flex-col gap-3 text-center sm:text-left">
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                Upload a profile photo
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                JPEG, PNG, WebP or GIF · Max 5MB · Auto-cropped to square
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePictureSelect}
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 text-sm font-bold text-blue-700 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 py-2.5 rounded-xl transition-all"
              >
                Choose Photo
              </button>
              {pictureFile && (
                <button
                  type="button"
                  onClick={handlePictureUpload}
                  disabled={pictureSaving}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed py-2.5 rounded-xl shadow-md transition-all"
                >
                  {pictureSaving ? (
                    <>
                      <Spinner sm /> Uploading…
                    </>
                  ) : (
                    "✓ Save Picture"
                  )}
                </button>
              )}
            </div>

            {pictureFile && (
              <p className="text-[11px] text-blue-600 font-semibold">
                📎 {pictureFile.name} selected — click "Save Picture" to upload
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Personal Information ──────────────────────────────────────── */}
      <SectionCard title="Personal Information" icon="📝">
        <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
          <Field
            label="Full Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            disabled={profileSaving}
          />

          <Field
            label="Email Address"
            name="email"
            type="email"
            value={user.email}
            readOnly
            hint="Email cannot be changed. Contact support if needed."
          />

          <Field
            label="Role"
            name="role"
            value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            readOnly
          />

          {/* Student-specific fields */}
          {isStudent && (
            <>
              <Field
                label="School Name"
                name="school"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="e.g. Presec-Legon"
                disabled={profileSaving}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Class
                  </label>
                  <select
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    disabled={profileSaving}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white disabled:opacity-60"
                  >
                    <option value="">Select class</option>
                    <option value="SHS 1">SHS 1</option>
                    <option value="SHS 2">SHS 2</option>
                    <option value="SHS 3">SHS 3</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Programme
                  </label>
                  <select
                    value={programme}
                    onChange={(e) => setProgramme(e.target.value)}
                    disabled={profileSaving}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white disabled:opacity-60"
                  >
                    <option value="">Select programme</option>
                    <option value="General Science">General Science</option>
                    <option value="Business">Business</option>
                    <option value="Visual Arts">Visual Arts</option>
                    <option value="General Arts">General Arts</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={profileSaving || !name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            >
              {profileSaving ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                "💾 Save Changes"
              )}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Change Password ───────────────────────────────────────────── */}
      <SectionCard title="Change Password" icon="🔒">
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          {/* Current password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
                disabled={passwordSaving}
                autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                tabIndex={-1}
              >
                <EyeIcon open={showCurrent} />
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a new password (min. 6 chars)"
                required
                disabled={passwordSaving}
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                tabIndex={-1}
              >
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmNew ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                disabled={passwordSaving}
                autoComplete="new-password"
                className={`w-full border rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-60 ${
                  newPasswordMismatch
                    ? "border-red-300 focus:ring-red-400 bg-red-50/40"
                    : newPasswordMatch
                      ? "border-green-300 focus:ring-green-400 bg-green-50/40"
                      : "border-slate-200 focus:ring-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmNew((p) => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                tabIndex={-1}
              >
                <EyeIcon open={showConfirmNew} />
              </button>
            </div>
            {newPasswordMismatch && (
              <p className="text-[11px] text-red-500 font-semibold">
                ✗ Passwords do not match
              </p>
            )}
            {newPasswordMatch && (
              <p className="text-[11px] text-green-600 font-semibold">
                ✓ Passwords match
              </p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={
                passwordSaving ||
                !currentPassword ||
                !newPassword ||
                !confirmNewPassword ||
                newPasswordMismatch
              }
              className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            >
              {passwordSaving ? (
                <>
                  <Spinner /> Changing Password…
                </>
              ) : (
                "🔑 Change Password"
              )}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-red-700 text-sm">Account</p>
          <p className="text-xs text-red-500 mt-0.5">
            Need to deactivate or delete your account? Contact your
            administrator.
          </p>
        </div>
        <span className="text-2xl shrink-0">⚠️</span>
      </div>
    </div>
  );
}
