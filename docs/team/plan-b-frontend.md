# PLAN — PERSON B · FRONTEND

**Scope (spec §38):** React application, workflow graph, custom React Flow nodes,
animations, goal input, document upload, validation UI, approval modal, audit viewer,
progress UI, visual polish. Must be buildable against mocked APIs immediately.

Status legend: `[x] done`, `[/] in progress`, `[ ] pending`, `[~] blocked/stuck`.

Backend contract to build against (already defined in `backend/app/models/api.py`
and `backend/app/api/routes.py`):
- `POST /workflows` `{goal}` → `{workflow_id, status, workflow}`
- `GET  /workflows/{id}` → `{workflow_id, status, goal, current_state, last_message,
  needs, progress{completed,total,ratio}, states[], collected_documents[], validation}`
- `POST /workflows/{id}/advance` `{user_input?, approval?, acknowledge?, confirm?, document_id?}`
- `POST /workflows/{id}/documents` (multipart `file`) → `{document_id, classification,
  confidence, extracted_fields{field:{value,confidence,source_text}}, issues}`
- `GET  /workflows/{id}/audit` → `{events[]}`

---

## B1 · Scaffold (Phase 1)
- [x] `frontend/` Vite + React + TypeScript
- [x] Tailwind CSS + `tailwind.config` / theme tokens (restrained color system, strong typography)
- [x] `reactflow` (`@xyflow/react` v12) + `framer-motion` deps
- [x] TS types mirroring backend contract: `Workflow`, `State`, `Transition`, `AdvanceResult`,
      `AuditEvent`, `ValidationResult`, `DocumentUploadResult` → `src/types/`
- [x] `services/api.ts` (fetch wrapper) + `services/mock.ts` (offline mock of the API)

## B2 · Core layout (spec §19/§36)
- [x] App shell: header bar (FLOWFORGE · workflow status), left rail (user/AI panel),
      center (WORKFLOW GRAPH), bottom progress bar
- [x] Progress bar: completed/total, ratio, animated fill (spec §19 footer)
- [x] "GoalInput" view (initial state): textarea + submit (out-of-box example chips)

## B3 · Workflow graph (the visual centerpiece, spec §20)
- [x] React Flow instance wired to `states[]`
- [x] Custom nodes: icon, title, status, short description
- [x] Node status styling: pending · active · completed · warning · blocked
- [x] Edge animation; node creation animation (framer-motion) on goal submit
- [x] Layout: deterministic vertical auto-layout so the graph is readable
      (nodes appear in execution order under each path)
- [x] Highlight active node (pulse) + animated edge from active node

## B4 · User/AI interaction panel
- [x] Non-chat-bubble presentation: "GOAL → WORKFLOW → CURRENT ACTION → RESULT →
      NEXT STATE" (spec §36). Left panel shows current action and next step.
- [x] ChatPanel as a *companion* (secondary) showing system messages + audit highlights

## B5 · Document upload (`DocumentUpload`)
- [x] Upload dropzone bound to active `document_required` state; shows required doc categories
- [x] Processing animation (pipeline stages: store → extract → classify → validate)
- [x] Demo buttons: "Load demo transcript (conflict)" and "Load corrected transcript"
      → generate Blobs with matching filenames so the mock backend behaves deterministically
- [x] "DocumentDetails": extracted fields table with per-field confidence
- [x] "ValidationResults": conflict callout — the **wow moment** (spec §17/§22 step 5):
      flagged field, evidence source text, confidence, pass/warn/block banner

## B6 · Human approval (`ApprovalModal`, spec §22 step 8)
- [x] Modal when `needs === 'approval'`: summary (documents ✓, eligibility ✓, validation ✓)
- [x] `APPROVE` / `REJECT` → `acknowledge` (warning resolution) vs `approval` (final) mapped
      to the right advance payload
- [x] Warning-resolution variant: "Acknowledge and continue" / "Upload corrected document"

## B7 · Audit viewer (`AuditLog`)
- [x] Timestamped event feed; event-type icons; confidence display
- [x] Filterable by event type; auto-scrolls to latest

## B8 · Polish (spec §35)
- [x] Loading skeletons, empty states, error banner (backend failure fallback copy)
- [x] Submission simulation screen: "Submitting… → Application submitted → Confirmation ID
      FF-2026-xxx"
- [ ] Responsive: graph reflows on small screens
- [x] Final: `npm run build` clean + `npm run lint` clean

---

**Owner notes / risks**
- Build against `services/mock.ts` first; switch to `services/api.ts` when backend is live.
- Graph must stay visible through the entire demo (fixed center region).
- No Bootstrap look; use restrained color system + strong typography.
- The conversation interface is secondary — never make chat bubbles the main interaction.