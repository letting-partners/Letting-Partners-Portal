"use client";

import { FormEvent, useRef, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { apiPatch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

type UserProfile = {
  id: string;
  email: string;
  agentDisplayName: string;
  profilePicture: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  ownedLandlords: number;
  ownedProperties: number;
};

type Props = {
  user: UserProfile;
};

export function ProfileClient({ user }: Props) {
  const [displayName, setDisplayName] = useState(user.agentDisplayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  // Profile picture state
  const [profilePicture, setProfilePicture] = useState<string | null>(user.profilePicture);
  const [picMsg, setPicMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPic, setSavingPic] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);

  // Crop state
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropSize, setCropSize] = useState(200);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 1, h: 1 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cx: 0, cy: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || user.email[0].toUpperCase();

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setNameMsg(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameMsg({ type: "error", text: "Display name cannot be empty." });
      return;
    }
    setSavingName(true);
    const result = await apiPatch<{ agentDisplayName: string }, { message: string }>(
      "/api/profile",
      { agentDisplayName: trimmed }
    );
    setSavingName(false);
    if (!result.ok) {
      setNameMsg({ type: "error", text: result.message ?? "Failed to update name." });
      return;
    }
    setNameMsg({ type: "success", text: result.data.message });
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.current = "Current password is required.";
    if (!newPassword) errors.new = "New password is required.";
    else if (newPassword.length < 8) errors.new = "Minimum 8 characters.";
    if (newPassword !== confirmPassword) errors.confirm = "Passwords do not match.";
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPw(true);
    const result = await apiPatch<
      { currentPassword: string; newPassword: string },
      { message: string }
    >("/api/profile", { currentPassword, newPassword });
    setSavingPw(false);

    if (!result.ok) {
      setPwMsg({ type: "error", text: result.message ?? "Failed to change password." });
      return;
    }
    setPwMsg({ type: "success", text: result.data.message });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwErrors({});
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPicMsg({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 5_000_000) {
      setPicMsg({ type: "error", text: "File must be smaller than 5 MB." });
      return;
    }
    setPicMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setRawImage(src);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function onImgLoad() {
    const img = cropImgRef.current;
    if (!img) return;
    setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setImgDisplaySize({ w: img.clientWidth, h: img.clientHeight });
    const minDim = Math.min(img.clientWidth, img.clientHeight);
    const size = Math.round(minDim * 0.6);
    setCropSize(size);
    setCropX(Math.round((img.clientWidth - size) / 2));
    setCropY(Math.round((img.clientHeight - size) / 2));
  }

  function clampCrop(x: number, y: number, size: number, dw: number, dh: number) {
    return {
      cx: Math.max(0, Math.min(x, dw - size)),
      cy: Math.max(0, Math.min(y, dh - size)),
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, cx: cropX, cy: cropY });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const { cx, cy } = clampCrop(
      dragStart.cx + (e.clientX - dragStart.x),
      dragStart.cy + (e.clientY - dragStart.y),
      cropSize, imgDisplaySize.w, imgDisplaySize.h,
    );
    setCropX(cx);
    setCropY(cy);
  }

  function onMouseUp() { setDragging(false); }

  function onSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newSize = Number(e.target.value);
    setCropSize(newSize);
    const { cx, cy } = clampCrop(cropX, cropY, newSize, imgDisplaySize.w, imgDisplaySize.h);
    setCropX(cx);
    setCropY(cy);
  }

  function applyCrop() {
    if (!rawImage || !cropImgRef.current) return;
    const scaleX = imgNaturalSize.w / imgDisplaySize.w;
    const scaleY = imgNaturalSize.h / imgDisplaySize.h;
    const canvas = document.createElement("canvas");
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = async () => {
      ctx.drawImage(img, cropX * scaleX, cropY * scaleY, cropSize * scaleX, cropSize * scaleY, 0, 0, outputSize, outputSize);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setShowCropper(false);
      setRawImage(null);
      setSavingPic(true);
      setPicMsg(null);
      const result = await apiPatch<{ profilePicture: string }, { message: string }>("/api/profile", { profilePicture: dataUrl });
      setSavingPic(false);
      if (!result.ok) {
        setPicMsg({ type: "error", text: result.message ?? "Failed to save picture." });
        return;
      }
      setProfilePicture(dataUrl);
      setPicMsg({ type: "success", text: "Profile picture updated." });
    };
    img.src = rawImage;
  }

  async function handleRemovePicture() {
    setSavingPic(true);
    setPicMsg(null);
    const result = await apiPatch<{ profilePicture: null }, { message: string }>("/api/profile", { profilePicture: null });
    setSavingPic(false);
    if (!result.ok) {
      setPicMsg({ type: "error", text: result.message ?? "Failed to remove picture." });
      return;
    }
    setProfilePicture(null);
    setPicMsg({ type: "success", text: "Profile picture removed." });
  }

  const maxCropSize = Math.min(imgDisplaySize.w, imgDisplaySize.h);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account details and security settings.</p>
        </div>
      </header>

      <div className="profile-grid">
        {/* Left: Identity Card */}
        <div>
          <div className="profile-avatar-card">
            {profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePicture} alt="Profile" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--brand-gold)", marginBottom: "0.5rem" }} />
            ) : (
              <div className="profile-avatar">{initials}</div>
            )}
            <h2 className="profile-name">{displayName}</h2>
            <p className="profile-email">{user.email}</p>
            <span className={`badge ${user.role === "ADMIN" ? "badge-admin" : "badge-active"}`}>{user.role}</span>
            <div className="profile-meta" style={{ marginTop: "0.5rem" }}>
              <div className="profile-meta-row">
                <span className="profile-meta-key">Status</span>
                <span className={`badge ${user.isActive ? "badge-active" : "badge-locked"}`}>{user.isActive ? "Active" : "Inactive"}</span>
              </div>
              <div className="profile-meta-row">
                <span className="profile-meta-key">Member since</span>
                <span className="profile-meta-value">{formatDate(user.createdAt)}</span>
              </div>
              <div className="profile-meta-row">
                <span className="profile-meta-key">Landlords</span>
                <span className="profile-meta-value gold">{user.ownedLandlords}</span>
              </div>
              <div className="profile-meta-row">
                <span className="profile-meta-key">Properties</span>
                <span className="profile-meta-value gold">{user.ownedProperties}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Edit Forms */}
        <div className="stack">

          {/* Profile Picture */}
          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ color: "var(--brand-gold)" }}>
                <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909.47.47a.75.75 0 1 1-1.06 1.06L6.53 8.091a.75.75 0 0 0-1.06 0l-2.97 2.97ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
              </svg>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Profile Picture</h2>
            </div>
            <div className="panel-body">
              {picMsg && <UIAlert type={picMsg.type} style={{ marginBottom: "0.75rem" }}>{picMsg.text}</UIAlert>}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                {profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profilePicture} alt="Current profile" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--brand-gold)" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--surface-raised, #1a1a24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700, color: "var(--brand-gold)", border: "2px solid var(--border)" }}>
                    {initials}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
                  <UIButton type="button" onClick={() => fileInputRef.current?.click()} disabled={savingPic}>
                    {savingPic ? "Saving…" : profilePicture ? "Change Picture" : "Upload Picture"}
                  </UIButton>
                  {profilePicture && (
                    <button type="button" onClick={() => void handleRemovePicture()} disabled={savingPic} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.8rem", textAlign: "left", padding: 0 }}>
                      Remove picture
                    </button>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  JPG, PNG or WebP · Max 5 MB<br />You can crop and adjust after selecting
                </p>
              </div>
            </div>
          </div>

          {/* Edit Display Name */}
          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ color: "var(--brand-gold)" }}>
                <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
              </svg>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Edit Display Name</h2>
            </div>
            <div className="panel-body">
              {nameMsg && <UIAlert type={nameMsg.type} style={{ marginBottom: "0.75rem" }}>{nameMsg.text}</UIAlert>}
              <form onSubmit={(e) => void handleSaveName(e)} className="field-grid" style={{ maxWidth: 400 }}>
                <label className="field">
                  <span className="label">Display Name</span>
                  <UIInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                </label>
                <div><UIButton type="submit" disabled={savingName}>{savingName ? "Saving…" : "Save Name"}</UIButton></div>
              </form>
            </div>
          </div>

          {/* Change Password */}
          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ color: "var(--brand-gold)" }}>
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Change Password</h2>
            </div>
            <div className="panel-body">
              {pwMsg && <UIAlert type={pwMsg.type} style={{ marginBottom: "0.75rem" }}>{pwMsg.text}</UIAlert>}
              <form onSubmit={(e) => void handleChangePassword(e)} className="field-grid" style={{ maxWidth: 400 }}>
                <label className="field">
                  <span className="label">Current Password</span>
                  <UIInput type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" autoComplete="current-password" />
                  {pwErrors.current && <span className="error-text">{pwErrors.current}</span>}
                </label>
                <label className="field">
                  <span className="label">New Password</span>
                  <UIInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" />
                  {pwErrors.new && <span className="error-text">{pwErrors.new}</span>}
                </label>
                <label className="field">
                  <span className="label">Confirm New Password</span>
                  <UIInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
                  {pwErrors.confirm && <span className="error-text">{pwErrors.confirm}</span>}
                </label>
                <div><UIButton type="submit" disabled={savingPw}>{savingPw ? "Saving…" : "Change Password"}</UIButton></div>
              </form>
            </div>
          </div>

          {/* Account Info */}
          <div className="panel">
            <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ color: "var(--brand-gold)" }}>
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
              </svg>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Account Information</h2>
            </div>
            <div className="panel-body">
              <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.875rem" }}>
                {[
                  { label: "Email Address", value: user.email },
                  { label: "Account Role", value: user.role },
                  { label: "Account ID", value: user.id.slice(0, 16) + "…" },
                  { label: "Member Since", value: formatDate(user.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border-muted)" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
              <p className="hint-text" style={{ marginTop: "0.75rem" }}>
                To change your email address, contact an administrator.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Crop Modal */}
      {showCropper && rawImage && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCropper(false); setRawImage(null); } }}
        >
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: 580, width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>Adjust &amp; Crop</h2>
              <button onClick={() => { setShowCropper(false); setRawImage(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.25rem" }}>✕</button>
            </div>

            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Drag the circle to reposition · Use the slider to resize
            </p>

            {/* Crop canvas area */}
            <div
              style={{ position: "relative", userSelect: "none", cursor: dragging ? "grabbing" : "default", lineHeight: 0, overflow: "hidden", borderRadius: "0.5rem" }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={cropImgRef} src={rawImage} alt="Crop preview" onLoad={onImgLoad} style={{ maxWidth: "100%", maxHeight: 360, display: "block" }} draggable={false} />
              {/* Dark overlay */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "rgba(0,0,0,0.55)" }} />
              {/* Crop circle */}
              <div
                style={{ position: "absolute", left: cropX, top: cropY, width: cropSize, height: cropSize, borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", border: "2px solid var(--brand-gold)", cursor: "grab", boxSizing: "border-box" }}
                onMouseDown={onMouseDown}
              />
            </div>

            {/* Size slider */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Crop size</span>
              <input type="range" min={40} max={maxCropSize || 200} value={cropSize} onChange={onSizeChange} style={{ width: "100%", accentColor: "var(--brand-gold)" }} />
            </label>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowCropper(false); setRawImage(null); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={applyCrop}>Apply &amp; Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
