import { useEffect, useRef } from "react";
import { ArrowLeft, Trash2, X } from "lucide-react";
import fontLicense from "../assets/fonts/OFL.txt?raw";

export function LicenseDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog license-dialog"
      onCancel={onClose}
      aria-labelledby="license-title"
    >
      <div className="card-heading">
        <h2 id="license-title">Noto font licenses</h2>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close font licenses"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p>
        Noto Sans and Noto Serif are bundled locally and used in your exported
        PDFs.
      </p>
      <pre>{fontLicense}</pre>
    </dialog>
  );
}

export function DeleteDialog({
  title,
  onCancel,
  onDelete,
}: {
  title: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      onCancel={onCancel}
      aria-labelledby="delete-title"
    >
      <span className="dialog-icon">
        <Trash2 size={23} />
      </span>
      <h2 id="delete-title">Delete this chapter?</h2>
      <p>
        “{title}” will be removed from this device. This cannot be undone.
        Export a backup first if you want to keep a copy.
      </p>
      <div className="button-row">
        <button autoFocus className="button secondary" onClick={onCancel}>
          <ArrowLeft size={15} /> Keep resume
        </button>
        <button className="button destructive" onClick={onDelete}>
          Delete resume
        </button>
      </div>
    </dialog>
  );
}
