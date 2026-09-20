import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type Tone = "info" | "success" | "warning" | "error";

interface InlineAlertProps {
  tone: Tone;
  title?: string;
  children: ReactNode;
}

const styles: Record<Tone, { box: string; icon: string; title: string }> = {
  info: { box: "border-border bg-surface", icon: "text-muted", title: "text-text" },
  success: { box: "border-success/35 bg-success/10", icon: "text-success", title: "text-success" },
  warning: { box: "border-warning/35 bg-warning/10", icon: "text-warning", title: "text-warning" },
  error: { box: "border-error/40 bg-error/10", icon: "text-error", title: "text-error" },
};

const icons: Record<Tone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

export function InlineAlert({ tone, title, children }: InlineAlertProps) {
  const Icon = icons[tone];
  const s = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-container border px-4 py-3 ${s.box}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`mt-0.5 shrink-0 ${s.icon}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-body leading-relaxed">
          {title && <p className={`font-semibold ${s.title}`}>{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}