import type { ReactNode } from "react";
import { UIButton } from "./button";

type Props = {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  confirmDisabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function UIConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  confirmDisabled = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <strong>{title}</strong>
        </div>
        <div className="modal-body">{body}</div>
        <div className="modal-foot">
          <UIButton variant="secondary" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </UIButton>
          <UIButton
            variant={confirmVariant}
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? "Working..." : confirmLabel}
          </UIButton>
        </div>
      </div>
    </div>
  );
}
