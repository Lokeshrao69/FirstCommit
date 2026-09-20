export type BadgeTone =
  | "neutral"
  | "ember"
  | "violet"
  | "success"
  | "warning"
  | "error";

/** Map a workflow/validation status onto the console's semantic palette.
 *  Status is never shown as color alone — always pair with icon + word. */
export function statusToneFor(status: string): BadgeTone {
  switch (status) {
    case "completed":
    case "pass":
      return "success";
    case "needs_review":
    case "warning":
    case "pending":
      return "warning";
    case "block":
    case "blocked":
    case "failed":
      return "error";
    case "active":
    case "in_progress":
      return "ember";
    default:
      return "neutral";
  }
}