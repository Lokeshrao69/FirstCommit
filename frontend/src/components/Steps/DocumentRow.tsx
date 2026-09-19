import { useRef, type DragEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import type { DocumentUploadResult } from "@/types";
import { Button } from "@/components/ui/Button";
import { humanise } from "@/utils/workflow";

interface DocumentRowProps {
  label: string;
  checking: boolean;
  checked: boolean;
  problemText: string | null;
  apiResult: DocumentUploadResult | null;
  inputId: string;
  onFile: (file: File) => void;
}

export function DocumentRow({
  label,
  checking,
  checked,
  problemText,
  apiResult,
  inputId,
  onFile,
}: DocumentRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <li
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${
        checked ? "bg-success/5" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-control ${
            checking
              ? "bg-surface text-muted"
              : checked
                ? "bg-success/15 text-success"
                : "bg-surface text-muted"
          }`}
        >
          {checking ? (
            <Loader2 size={16} className="animate-spin" />
          ) : checked ? (
            <CheckCircle2 size={16} />
          ) : (
            <UploadCloud size={16} />
          )}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-text">{label}</p>
          <p aria-live="polite" className="text-small text-muted">
            {checking ? "Checking…" : checked ? "Checked" : problemText ? "" : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {problemText && (
          <span className="inline-flex items-center gap-1 text-small text-warning">
            <AlertTriangle size={14} aria-hidden="true" />
            {problemText}
          </span>
        )}
        {checked ? (
          <>
            {apiResult && Object.keys(apiResult.extracted_fields).length > 0 && (
              <details className="group">
                <summary className="list-none cursor-pointer rounded-control px-2 py-1 text-small font-medium text-primary transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden">
                  Show details
                </summary>
                <dl className="mt-1">
                  {Object.entries(apiResult.extracted_fields).map(([key, field]) => (
                    <div
                      key={key}
                      className="flex items-baseline justify-between gap-4 border-t border-border py-1.5"
                    >
                      <dt className="text-small text-muted">{humanise(key)}</dt>
                      <dd className="text-small font-medium text-text">
                        {field.value}
                        <span className="ml-1 text-muted">
                          {Math.round(field.confidence * 100)}%
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <Button variant="tertiary" size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={checking}
            onClick={() => inputRef.current?.click()}
          >
            Upload file
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="sr-only"
        aria-label={`Upload ${label}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </li>
  );
}