"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
import { uploadImageAction } from "@/app/actions/images";
import { useToast } from "@/components/ui/Toast";

/**
 * The article editor.
 *
 * Built on contenteditable rather than an editor library: the formatting an
 * article needs is a short list, and a dependency that owns the document model
 * is a large thing to take on for it.
 *
 * The value is only pushed into the element when it differs from what is
 * already there. Writing it on every render would move the caret to the end on
 * every keystroke.
 */

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const toast = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  useEffect(() => {
    const element = editorRef.current;
    if (element && element.innerHTML !== value) {
      element.innerHTML = value;
      setIsEmpty(!element.textContent?.trim());
    }
  }, [value]);

  const emit = useCallback(() => {
    const element = editorRef.current;
    if (!element) return;
    setIsEmpty(!element.textContent?.trim());
    onChange(element.innerHTML);
  }, [onChange]);

  /*
   * execCommand is deprecated but is still the only thing every browser
   * implements for contenteditable formatting, and there is no replacement.
   */
  function run(command: string, argument?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emit();
  }

  function insertLink() {
    const url = window.prompt("Link address", "https://");
    if (!url) return;
    if (!/^(https?:\/\/|\/|mailto:|tel:|#)/i.test(url)) {
      toast.error("Enter a full link, starting with https://");
      return;
    }
    run("createLink", url);
  }

  async function insertImage(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadImageAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const alt = (result.data?.altText ?? "").replace(/"/g, "&quot;");
      // Inserted as a figure so a caption can be typed underneath it.
      run(
        "insertHTML",
        `<figure><img src="${result.data!.url}" alt="${alt}" loading="lazy"><figcaption>Add a caption, or delete this line.</figcaption></figure><p><br></p>`,
      );
    } finally {
      setUploading(false);
    }
  }

  /* Pasting from Word or a web page brings styles and scripts with it. */
  function onPaste(event: React.ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  }

  return (
    <div className="editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
        <ToolbarButton label="Bold" onClick={() => run("bold")}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => run("italic")}>
          <Italic size={15} />
        </ToolbarButton>

        <span className="editor-toolbar-divider" />

        <ToolbarButton label="Heading" onClick={() => run("formatBlock", "<h2>")}>
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Subheading" onClick={() => run("formatBlock", "<h3>")}>
          <Heading3 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Paragraph" onClick={() => run("formatBlock", "<p>")}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>P</span>
        </ToolbarButton>

        <span className="editor-toolbar-divider" />

        <ToolbarButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => run("insertOrderedList")}>
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton label="Quote" onClick={() => run("formatBlock", "<blockquote>")}>
          <Quote size={15} />
        </ToolbarButton>

        <span className="editor-toolbar-divider" />

        <ToolbarButton label="Insert link" onClick={insertLink}>
          <Link2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          label={uploading ? "Uploading image" : "Insert image"}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <span className="spinner" aria-hidden="true" /> : <ImagePlus size={15} />}
        </ToolbarButton>

        <span className="editor-toolbar-divider" />

        <ToolbarButton label="Undo" onClick={() => run("undo")}>
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => run("redo")}>
          <Redo2 size={15} />
        </ToolbarButton>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void insertImage(file);
        }}
      />

      <div
        ref={editorRef}
        className="editor-surface prose"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Article body"
        data-placeholder={placeholder ?? "Write the article..."}
        data-empty={isEmpty || undefined}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="editor-tool"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Keeps the selection: a mousedown on the button would blur the editor
      // first, and the command would then have nothing to act on.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
