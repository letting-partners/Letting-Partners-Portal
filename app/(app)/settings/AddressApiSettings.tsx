"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { saveSettingAction } from "./actions";

/**
 * The address lookup key.
 *
 * Keys of this kind come with a monthly allowance that runs out mid-call, so
 * an administrator can paste a replacement here rather than waiting on a
 * deploy. The key itself is never sent back to the browser - only whether one
 * is set and its last few characters, which is enough to tell two apart.
 */

export const ADDRESS_API_KEY_SETTING = "integrations.address_api_key";

export default function AddressApiSettings({
  configured,
  hint,
  fromEnvironment,
}: {
  configured: boolean;
  /** Last few characters, so one key can be told from another. */
  hint: string | null;
  /** True when the key in use comes from the environment, not this screen. */
  fromEnvironment: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  function save(next: string, message: string) {
    startTransition(async () => {
      const result = await saveSettingAction(ADDRESS_API_KEY_SETTING, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="stack--sm stack">
      <p className="subtle small">
        Fills the address step of the property wizard from a postcode. Without a key the address
        is simply typed by hand, so the portal keeps working either way.
      </p>

      <div className="row row--between" style={{ alignItems: "center" }}>
        <span className="row" style={{ gap: 8, alignItems: "center" }}>
          <KeyRound size={15} />
          {configured ? (
            <span className="badge badge--positive">
              Key set{hint ? ` • ends ${hint}` : ""}
            </span>
          ) : (
            <span className="badge badge--warning">No key - lookup disabled</span>
          )}
        </span>

        {fromEnvironment && configured && (
          <span className="subtle small">From the environment. A key saved here overrides it.</span>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="address-api-key">
          {configured ? "Replace the key" : "Add a key"}
        </label>
        <input
          id="address-api-key"
          className="input"
          type="password"
          autoComplete="off"
          placeholder="Paste a goaddress.io API token"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <span className="field-hint">
          From goaddress.io, under API tokens. Stored in the portal, never shown again.
        </span>
      </div>

      <div className="row row--wrap">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => save(value.trim(), "Address lookup key saved.")}
          disabled={pending || !value.trim()}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          Save key
        </button>

        {configured && !fromEnvironment && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => save("", "Address lookup key removed.")}
            disabled={pending}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
