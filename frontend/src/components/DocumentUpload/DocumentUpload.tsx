import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import type { WorkflowDetail } from "@/types";
import { DOC_LABELS } from "@/types";

interface DocumentUploadProps {
  detail: WorkflowDetail | null;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onContinue: () => void;
}

const PIPELINE_STAGES = ["store", "extract", "classify", "validate"];

export function DocumentUpload({ detail, busy, onUpload, onContinue }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const required =
    detail?.states.find((s) => s.id === "document_collection")?.required_documents ?? [];
  const collected = new Set(detail?.collected_documents ?? []);
  const allPresent = required.length > 0 && required.every((d) => collected.has(d));

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setLastError(null);
      try {
        await onUpload(file);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void uploadFile(file);
  };

  const demoTranscript = async (conflict: boolean) => {
    const name = conflict ? "transcript.pdf" : "transcript_corrected.pdf";
    const blob = new Blob(
      [conflict ? "demo transcript" : "corrected transcript"],
      { type: "application/pdf" },
    );
    await uploadFile(new File([blob], name, { type: "application/pdf" }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-paper-50">
          <UploadCloud size={16} className="text-accent-soft" />
          Required documents
        </h3>
        <p className="mt-1 text-xs text-paper-100/60">
          Four documents are required. The pipeline stores, extracts, classifies and validates each upload.
        </p>

        <div className="mt-4 grid gap-2">
          {required.map((doc) => {
            const done = collected.has(doc);
            return (
              <div
                key={doc}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                  done ? "border-ok/40 bg-ok/5" : "border-ink-700 bg-ink-900/40"
                }`}
              >
                <span className={`text-sm ${done ? "text-paper-50" : "text-paper-100/60"}`}>
                  {DOC_LABELS[doc] ?? doc}
                </span>
                {done ? (
                  <CheckCircle2 size={16} className="text-ok" />
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-paper-100/30">pending</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          disabled={uploading || busy}
          className={`mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors disabled:opacity-50 ${
            dragging ? "border-accent bg-accent/5" : "border-ink-700 hover:border-accent/50"
          }`}
        >
          <FileUp size={20} className="text-accent-soft" />
          <span className="text-sm font-medium text-paper-100">
            {uploading ? "Processing…" : "Drop a document here or click to browse"}
          </span>
          <span className="text-[11px] text-paper-100/40">
            filename drives deterministic demo classification
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => onFiles(e.target.files)}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost !py-1.5 !text-xs"
            disabled={uploading || busy}
            onClick={() => void demoTranscript(true)}
          >
            Load demo transcript (conflict)
          </button>
          <button
            type="button"
            className="btn-ghost !py-1.5 !text-xs"
            disabled={uploading || busy}
            onClick={() => void demoTranscript(false)}
          >
            Load corrected transcript
          </button>
        </div>

        {uploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-paper-100/70">
              <Loader2 size={14} className="animate-spin text-accent-soft" />
              Processing document…
            </div>
            <div className="flex items-center gap-1.5">
              {PIPELINE_STAGES.map((stage, i) => (
                <motion.span
                  key={stage}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.25 }}
                  className="rounded-md bg-ink-700 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-paper-100/70"
                >
                  {stage}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {lastError && (
          <p className="mt-3 text-xs text-err">Couldn't reliably process this document. Please retry.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!allPresent || busy}
        className="btn-primary w-full"
      >
        {allPresent ? "Continue with validation" : "Upload all documents to continue"}
        <ArrowRight size={16} />
      </button>
    </motion.div>
  );
}