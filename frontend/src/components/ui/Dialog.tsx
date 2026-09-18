import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

/** Accessible modal dialog: focus trap, Escape to close, focus restored on
 *  close. Used for the "View as diagram" view. */
export function Dialog({ open, onClose, title, children, wide }: DialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-backdrop fixed inset-0 z-50 grid place-items-center bg-text/40 p-4"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`animate-dialog flex w-full flex-col rounded-container border border-border bg-white shadow-overlay-lg outline-none ${
          wide ? "h-[80vh] max-w-[90vw] sm:max-w-[1200px]" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-section font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={title ? `Close ${title}` : "Close dialog"}
            className="rounded-control p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 ${wide ? "h-[calc(80vh-53px)]" : "overflow-y-auto p-5"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}