"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Save } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { publishAction, savePublicDetailsAction } from "../actions";

/**
 * The public listing editor.
 *
 * Saving details and publishing are two separate actions on purpose: writing
 * copy should never put a property on the website as a side effect.
 */
export default function ListingEditor({
  propertyId,
  initial,
  canPublish,
  readiness,
  isPublished,
}: {
  propertyId: string;
  initial: {
    title: string;
    description: string;
    metaTitle: string;
    metaDescription: string;
  };
  canPublish: boolean;
  readiness: { ready: boolean; missing: string[] };
  isPublished: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle);
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription);
  const [showSeo, setShowSeo] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await savePublicDetailsAction({
        propertyId,
        title,
        description,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.listingStatus === "READY_TO_PUBLISH"
          ? "Saved. This listing is ready to publish."
          : "Listing details saved.",
      );
      router.refresh();
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishAction(propertyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Published to the website.");
      router.refresh();
    });
  }

  return (
    <div className="stack">
      {!readiness.ready && (
        <div className="alert alert--warning">
          <span>
            Still needed before this can go on the website:{" "}
            <strong>{readiness.missing.join(", ")}</strong>.
          </span>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="listing-title">
          Property title<span className="required">*</span>
        </label>
        <input
          id="listing-title"
          className="input"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Bright furnished double room in a shared house, Rusholme"
        />
        <span className="field-hint">{title.length}/200 characters</span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="listing-description">
          Description<span className="required">*</span>
        </label>
        <textarea
          id="listing-description"
          className="textarea"
          rows={10}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the property naturally: the rooms, what is included, transport links and who it would suit."
        />
        <span className="field-hint">
          Write for a person, not a search engine. Keyword stuffing reads badly and does not help.
        </span>
      </div>

      <div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setShowSeo((value) => !value)}
          aria-expanded={showSeo}
        >
          {showSeo ? "Hide" : "Show"} search engine settings
        </button>
      </div>

      {showSeo && (
        <div className="stack">
          <div className="field">
            <label className="field-label" htmlFor="meta-title">
              Meta title
            </label>
            <input
              id="meta-title"
              className="input"
              value={metaTitle}
              maxLength={200}
              onChange={(event) => setMetaTitle(event.target.value)}
              placeholder="Generated from the title and location if left blank"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="meta-description">
              Meta description
            </label>
            <textarea
              id="meta-description"
              className="textarea"
              rows={3}
              maxLength={320}
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
              placeholder="Generated from the description if left blank"
            />
            <span className="field-hint">
              Around 155 characters is shown in search results.
            </span>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={save}
          disabled={pending || !title.trim() || !description.trim()}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          <Save size={15} />
          Save details
        </button>

        {canPublish && !isPublished && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={publish}
            disabled={pending || !readiness.ready}
            title={readiness.ready ? undefined : `Still needed: ${readiness.missing.join(", ")}`}
          >
            <Globe size={15} />
            Publish to web
          </button>
        )}
      </div>
    </div>
  );
}
