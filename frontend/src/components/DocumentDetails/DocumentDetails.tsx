import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import type { DocumentUploadResult } from "@/types";
import { DOC_LABELS } from "@/types";
import { fmtConfidence } from "@/utils/format";

interface DocumentDetailsProps {
  documents: DocumentUploadResult[];
}

export function DocumentDetails({ documents }: DocumentDetailsProps) {
  if (documents.length === 0) {
    return (
      <p className="px-1 text-xs text-paper-100/40">
        No documents uploaded yet — extracted fields will appear here.
      </p>
    );
  }

  const byClassification = new Map(
    documents
      .slice()
      .reverse()
      .map((d) => [d.classification ?? d.document_id, d]),
  );

  return (
    <div className="space-y-2">
      {[...byClassification.values()].map((doc, i) => (
        <motion.div
          key={doc.document_id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-paper-50">
              <FileText size={13} className="text-accent-soft" />
              {DOC_LABELS[doc.classification ?? ""] ?? doc.filename}
            </span>
            <span className="font-mono text-[10px] text-ok">{fmtConfidence(doc.confidence)}</span>
          </div>

          <div className="mt-2 overflow-hidden rounded-lg border border-ink-700/50">
            <table className="w-full text-left text-xs">
              <tbody>
                {Object.entries(doc.extracted_fields).map(([field, val]) => (
                  <tr key={field} className="border-t border-ink-700/40 first:border-t-0">
                    <td className="px-2.5 py-1.5 font-mono text-paper-100/50">{field}</td>
                    <td className="px-2.5 py-1.5 text-paper-50">
                      <span className="font-medium">{val.value}</span>
                      <span className="ml-2 font-mono text-[10px] text-paper-100/40">
                        {fmtConfidence(val.confidence)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ))}
    </div>
  );
}