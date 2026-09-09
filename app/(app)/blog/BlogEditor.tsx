"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ExternalLink, ImagePlus, Save, Send, Trash2 } from "lucide-react";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Modal";
import { uploadImageAction } from "@/app/actions/images";
import { createBlogPostAction, setBlogStatusAction, updateBlogPostAction } from "./actions";

/**
 * Write and publish an article.
 *
 * Everything an article needs to go live sits on one screen: the writing, the
 * banner, and the search fields. Splitting SEO onto a second step is how it
 * ends up never being filled in.
 */

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  bannerImageUrl: string | null;
  bannerImageAlt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  schemaJson: string | null;
  status: string;
  publishedAt: string | null;
};

/** A datetime-local value, which wants local time with no zone suffix. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function slugPreview(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.lettingpartners.co.uk";

export default function BlogEditor({ post }: { post?: Post }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const bannerRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [banner, setBanner] = useState(post?.bannerImageUrl ?? "");
  const [bannerAlt, setBannerAlt] = useState(post?.bannerImageAlt ?? "");
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [focusKeyword, setFocusKeyword] = useState(post?.focusKeyword ?? "");
  const [schemaJson, setSchemaJson] = useState(post?.schemaJson ?? "");
  const [publishedAt, setPublishedAt] = useState(toLocalInput(post?.publishedAt ?? null));
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);

  // Untouched, the URL follows the title. Once edited by hand it stops moving.
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const effectiveSlug = slugTouched ? slug : slugPreview(title);

  const plainBody = useMemo(() => body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), [body]);
  const wordCount = plainBody ? plainBody.split(" ").length : 0;

  /*
   * The SEO checks a writer actually needs. Deliberately advisory: an article
   * is not blocked for a long title, it is just told.
   */
  const seoChecks = useMemo(() => {
    const keyword = focusKeyword.trim().toLowerCase();
    const effectiveMetaTitle = metaTitle || title;
    const effectiveMetaDescription = metaDescription || excerpt;

    return [
      {
        label: "Meta title is 30-60 characters",
        ok: effectiveMetaTitle.length >= 30 && effectiveMetaTitle.length <= 60,
        detail: `${effectiveMetaTitle.length}`,
      },
      {
        label: "Meta description is 70-160 characters",
        ok: (effectiveMetaDescription?.length ?? 0) >= 70 && (effectiveMetaDescription?.length ?? 0) <= 160,
        detail: `${effectiveMetaDescription?.length ?? 0}`,
      },
      {
        label: "Focus keyword set",
        ok: keyword.length > 0,
        detail: keyword ? "" : "none",
      },
      {
        label: "Keyword in the title",
        ok: Boolean(keyword) && title.toLowerCase().includes(keyword),
        detail: "",
      },
      {
        label: "Keyword in the article",
        ok: Boolean(keyword) && plainBody.toLowerCase().includes(keyword),
        detail: "",
      },
      { label: "Banner image added", ok: Boolean(banner), detail: "" },
      { label: "At least 300 words", ok: wordCount >= 300, detail: `${wordCount}` },
    ];
  }, [focusKeyword, metaTitle, metaDescription, title, excerpt, plainBody, banner, wordCount]);

  function payload(status?: "DRAFT" | "PUBLISHED") {
    return {
      title,
      slug: effectiveSlug || null,
      excerpt: excerpt || null,
      body,
      bannerImageUrl: banner || null,
      bannerImageAlt: bannerAlt || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      focusKeyword: focusKeyword || null,
      schemaJson: schemaJson || null,
      status,
      // datetime-local has no zone, so it is read as the writer's own time.
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
    };
  }

  function save(status?: "DRAFT" | "PUBLISHED") {
    if (!title.trim()) {
      toast.error("Give the article a title.");
      return;
    }

    startTransition(async () => {
      const result = post
        ? await updateBlogPostAction(post.id, payload(status))
        : await createBlogPostAction(payload(status));

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        status === "PUBLISHED" ? "Article published." : "Saved.",
      );

      if (!post && "data" in result && result.data && "id" in result.data) {
        router.push(`/blog/${result.data.id}`);
        return;
      }
      router.refresh();
    });
  }

  function trash() {
    if (!post) return;
    startTransition(async () => {
      const result = await setBlogStatusAction(post.id, "TRASHED");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Moved to trash.");
      router.push("/blog");
    });
  }

  async function uploadBanner(file: File) {
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadImageAction(formData);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBanner(result.data!.url);
      if (!bannerAlt) setBannerAlt(result.data!.altText ?? "");
    } finally {
      setUploadingBanner(false);
    }
  }

  const isPublished = post?.status === "PUBLISHED";

  return (
    <div className="blog-editor">
      <div className="blog-editor-main">
        <div className="field">
          <label className="field-label" htmlFor="post-title">
            Title<span className="required">*</span>
          </label>
          <input
            id="post-title"
            className="input input--title"
            value={title}
            placeholder="What is the article about?"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="post-slug">
            URL
          </label>
          <div className="blog-slug-row">
            <span className="subtle small">/blog/</span>
            <input
              id="post-slug"
              className="input"
              value={effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="post-excerpt">
            Excerpt
          </label>
          <textarea
            id="post-excerpt"
            className="input"
            rows={2}
            placeholder="One or two sentences for the article card and search results."
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">Article</span>
          <RichTextEditor value={body} onChange={setBody} />
          <span className="field-hint">{wordCount} words</span>
        </div>
      </div>

      <aside className="blog-editor-side">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Publish</span>
            <span className={`badge ${isPublished ? "badge--positive" : "badge--neutral"}`}>
              {post?.status ?? "DRAFT"}
            </span>
          </div>
          <div className="card-body stack--sm stack">
            <div className="field">
              <label className="field-label" htmlFor="post-date">
                Article date
              </label>
              <input
                id="post-date"
                type="datetime-local"
                className="input"
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.target.value)}
              />
              <span className="field-hint">
                A future date holds the article back until then. Leave empty to date it on publish.
              </span>
            </div>

            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => save(isPublished ? "PUBLISHED" : "DRAFT")}
                disabled={pending}
              >
                {pending && <span className="spinner" aria-hidden="true" />}
                <Save size={14} />
                Save
              </button>

              {!isPublished && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => save("PUBLISHED")}
                  disabled={pending}
                >
                  <Send size={14} />
                  Publish
                </button>
              )}

              {isPublished && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => save("DRAFT")}
                  disabled={pending}
                >
                  Revert to draft
                </button>
              )}
            </div>

            {isPublished && post && (
              <a
                className="btn btn--ghost btn--sm"
                href={`${SITE_URL}/blog/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} />
                View on the website
              </a>
            )}

            {post && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmTrash(true)}
                disabled={pending}
              >
                <Trash2 size={14} />
                Move to trash
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Banner image</span>
          </div>
          <div className="card-body stack--sm stack">
            {banner ? (
              <div className="blog-banner-preview">
                <Image src={banner} alt={bannerAlt || "Banner"} fill className="lp-cover-img" sizes="360px" />
              </div>
            ) : (
              <p className="subtle small">Required before an article can be published.</p>
            )}

            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadBanner(file);
              }}
            />

            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => bannerRef.current?.click()}
                disabled={uploadingBanner}
              >
                {uploadingBanner ? <span className="spinner" aria-hidden="true" /> : <ImagePlus size={14} />}
                {banner ? "Replace" : "Upload"}
              </button>
              {banner && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setBanner("")}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-banner-alt">
                Image alt text
              </label>
              <input
                id="post-banner-alt"
                className="input"
                value={bannerAlt}
                onChange={(event) => setBannerAlt(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Search</span>
          </div>
          <div className="card-body stack--sm stack">
            <div className="field">
              <label className="field-label" htmlFor="post-keyword">
                Focus keyword
              </label>
              <input
                id="post-keyword"
                className="input"
                placeholder="e.g. renting out a property"
                value={focusKeyword}
                onChange={(event) => setFocusKeyword(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-meta-title">
                SEO title
              </label>
              <input
                id="post-meta-title"
                className="input"
                placeholder={title || "Defaults to the article title"}
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-meta-description">
                Meta description
              </label>
              <textarea
                id="post-meta-description"
                className="input"
                rows={3}
                placeholder="Defaults to the excerpt."
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
              />
            </div>

            <ul className="seo-checks">
              {seoChecks.map((check) => (
                <li key={check.label} data-ok={check.ok || undefined}>
                  <span className="seo-check-dot" aria-hidden="true" />
                  {check.label}
                  {check.detail && <span className="subtle small"> ({check.detail})</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Custom schema</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label className="field-label" htmlFor="post-schema">
                Extra JSON-LD
              </label>
              <textarea
                id="post-schema"
                className="input code"
                rows={5}
                spellCheck={false}
                placeholder='{"@context":"https://schema.org","@type":"FAQPage"}'
                value={schemaJson}
                onChange={(event) => setSchemaJson(event.target.value)}
              />
              <span className="field-hint">
                Added alongside the article schema the website already generates. Must be valid JSON.
              </span>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmTrash}
        title="Move this article to trash?"
        message="It comes off the website straight away. The article is kept and can be restored from the trash."
        confirmLabel="Move to trash"
        danger
        pending={pending}
        onClose={() => setConfirmTrash(false)}
        onConfirm={trash}
      />
    </div>
  );
}
