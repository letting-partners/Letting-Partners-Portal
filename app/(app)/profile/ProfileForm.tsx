"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Upload } from "lucide-react";
import { Card } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { THEME_LABELS, THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { saveProfileAction, uploadAvatarAction } from "./actions";

/**
 * The user's own profile.
 *
 * Role, status, email and team assignment are deliberately read-only here -
 * those are identity, and only an administrator sets them.
 */
export default function ProfileForm({
  initial,
  isAgent,
}: {
  initial: {
    fullName: string;
    email: string;
    phone: string;
    jobTitle: string;
    role: string;
    avatarUrl: string | null;
    publicPhone: string;
    publicEmail: string;
    publicBio: string;
    themePreference: ThemePreference;
    notifications: {
      emailFollowUpReminders: boolean;
      emailMissedCustomerChat: boolean;
      inAppSound: boolean;
    };
  };
  isAgent: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [publicPhone, setPublicPhone] = useState(initial.publicPhone);
  const [publicEmail, setPublicEmail] = useState(initial.publicEmail);
  const [publicBio, setPublicBio] = useState(initial.publicBio);
  const [theme, setTheme] = useState<ThemePreference>(initial.themePreference);
  const [notifications, setNotifications] = useState(initial.notifications);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveProfileAction({
        fullName,
        phone: phone || null,
        jobTitle: jobTitle || null,
        publicPhone: publicPhone || null,
        publicEmail: publicEmail || null,
        publicBio: publicBio || null,
        themePreference: theme,
        ...notifications,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Apply the theme immediately rather than waiting for a reload.
      const root = document.documentElement;
      if (theme === "SYSTEM") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", theme.toLowerCase());

      toast.success("Profile saved.");
      router.refresh();
    });
  }

  function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadAvatarAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAvatarUrl(result.data.url);
      toast.success("Photo updated.");
      router.refresh();
    });
  }

  return (
    <div className="grid-sidebar">
      <div className="stack">
        {error && (
          <div className="alert alert--danger" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <Card title="Your details">
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="profile-name">
                Full name<span className="required">*</span>
              </label>
              <input
                id="profile-name"
                className="input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-email">
                Email address
              </label>
              <input id="profile-email" className="input" value={initial.email} readOnly disabled />
              <span className="field-hint">
                This is your sign-in address. An administrator can change it.
              </span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-phone">
                Phone
              </label>
              <input
                id="profile-phone"
                className="input numeric"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-title">
                Job title
              </label>
              <input
                id="profile-title"
                className="input"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
            </div>
          </div>
        </Card>

        {isAgent && (
          <Card title="Public profile">
            <p className="muted small" style={{ marginBottom: 12 }}>
              Shown on the website next to properties you publish. Leave a field blank to keep it
              off the public page.
            </p>

            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="public-phone">
                  Public phone
                </label>
                <input
                  id="public-phone"
                  className="input numeric"
                  inputMode="tel"
                  value={publicPhone}
                  onChange={(event) => setPublicPhone(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="public-email">
                  Public email
                </label>
                <input
                  id="public-email"
                  type="email"
                  className="input"
                  value={publicEmail}
                  onChange={(event) => setPublicEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label className="field-label" htmlFor="public-bio">
                Short bio
              </label>
              <textarea
                id="public-bio"
                className="textarea"
                rows={3}
                maxLength={600}
                value={publicBio}
                placeholder="Lettings manager covering East London and Redbridge."
                onChange={(event) => setPublicBio(event.target.value)}
              />
            </div>
          </Card>
        )}

        <Card title="Notifications">
          <div className="stack--sm stack">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={notifications.emailFollowUpReminders}
                onChange={(event) =>
                  setNotifications({
                    ...notifications,
                    emailFollowUpReminders: event.target.checked,
                  })
                }
              />
              Email me when follow-ups are due
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={notifications.emailMissedCustomerChat}
                onChange={(event) =>
                  setNotifications({
                    ...notifications,
                    emailMissedCustomerChat: event.target.checked,
                  })
                }
              />
              Email me about website enquiries waiting for a reply
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={notifications.inAppSound}
                onChange={(event) =>
                  setNotifications({ ...notifications, inAppSound: event.target.checked })
                }
              />
              Play a sound for new in-app notifications
            </label>
          </div>

          <p className="subtle small" style={{ marginTop: 12 }}>
            In-app notifications are always on - these settings only control email.
          </p>
        </Card>

        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={save} disabled={pending}>
            {pending && <span className="spinner" aria-hidden="true" />}
            <Save size={15} />
            Save changes
          </button>
        </div>
      </div>

      <div className="stack">
        <Card title="Photo">
          <div className="stack--sm stack" style={{ alignItems: "center", textAlign: "center" }}>
            <Avatar name={fullName || initial.email} src={avatarUrl} size="xl" />

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAvatar(file);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
            >
              <Upload size={14} />
              Change photo
            </button>

            <p className="subtle small">Appears in chats, activity and on your team page.</p>
          </div>
        </Card>

        <Card title="Appearance">
          <div className="stack--sm stack">
            {THEME_OPTIONS.map((option) => (
              <label key={option} className="checkbox-row">
                <input
                  type="radio"
                  name="theme"
                  checked={theme === option}
                  onChange={() => setTheme(option)}
                />
                {THEME_LABELS[option]}
              </label>
            ))}
          </div>
          <p className="subtle small" style={{ marginTop: 10 }}>
            System follows whatever your device is set to.
          </p>
        </Card>

        <Card title="Account">
          <dl className="definition-list">
            <div>
              <dt>Role</dt>
              <dd>{initial.role.replace(/_/g, " ").toLowerCase()}</dd>
            </div>
          </dl>
          <p className="subtle small" style={{ marginTop: 10 }}>
            Your role, team and account status are set by an administrator.
          </p>
        </Card>
      </div>
    </div>
  );
}
