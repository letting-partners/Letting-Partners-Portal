"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { saveSettingAction } from "./actions";

/** Company details, used on transactional email and public listings. */
export default function CompanySettings({
  initial,
}: {
  initial: { name: string; phone: string; email: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);

  function save() {
    startTransition(async () => {
      const results = await Promise.all([
        saveSettingAction("company.name", name),
        saveSettingAction("company.phone", phone),
        saveSettingAction("company.email", email),
      ]);

      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) {
        toast.error(failed.error);
        return;
      }

      toast.success("Company details saved.");
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="company-name">
            Company name
          </label>
          <input
            id="company-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="company-phone">
            Phone
          </label>
          <input
            id="company-phone"
            className="input numeric"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="company-email">
            Email
          </label>
          <input
            id="company-email"
            type="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          <Save size={14} />
          Save
        </button>
      </div>
    </div>
  );
}
