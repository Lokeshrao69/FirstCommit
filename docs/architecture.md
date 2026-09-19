# FlowForge Architecture

> **The LLM plans. The state machine executes. The human stays in control.**

FlowForge is a **domain-agnostic agentic workflow engine**. The Merit Excellence
Scholarship is only the demo use case: the same engine can drive insurance claims,
reimbursements, college applications, or government services without changing the core.
This document is the technical reference for the backend. For the top-level overview see
[`ARCHITECTURE.md`](../ARCHITECTURE.md); for the AI layer see
[`ai-architecture.md`](./ai-architecture.md); for the execution contract see
[`workflow-engine.md`](./workflow-engine.md); for the HTTP surface see
[`api-reference.md`](./api-reference.md).

## 1. Design principle

FlowForge is not "an AI chatbot that answers questions". It separates the
non-deterministic part of the problem (understanding a goal, reading documents) from the
deterministic part (deciding what happens next, enforcing order, gating consequential
actions). The LLM produces a **plan only**; it never selects a runtime transition.

| Layer | Responsibility | Determinism |
| --- | --- | --- |
| Workflow Planning LLM | goal → structured workflow JSON | non-deterministic |
| Schema Validator | reject malformed/unsafe plans before execution | deterministic |
| State Machine | execute transitions, enforce order and approval gates | deterministic |
| Document Pipeline | classify, extract fields, cross-validate | AI analysis + rule gates |
| Human Approval | approve/deny consequential actions | human |
| Audit Log | record every meaningful event | deterministic |

## 2. Runtime topology

```
                        ┌─────────────────────────────┐
   browser (React)  ───▶ │  FastAPI app (backend/main) │
                        │  app/api/routes.py          │
                        └──────────────┬──────────────┘
                                       │ Depends(get_services)
                        ┌──────────────▼──────────────┐
                        │  app/api/deps.py (root)     │
                        │  DEMO_MODE ? mock : AWS     │
                        └──────┬───────────────┬──────┘
                               │               │
                 ┌─────────────▼──┐     ┌──────▼───────────────┐
                 │ WorkflowService│     │ DocumentService      │
                 │ state machine  │     │ upload→classify→extract│
                 └───┬────────┬───┘     └───────┬──────────────┘
                     │        │                 │
        ┌────────────▼──┐  ┌──▼─────────┐  ┌────▼─────────────┐
        │ LLMProvider    │  │ Repository │  │ Store + Processor│
        │ Bedrock / Mock │  │ Dynamo/InMem│ │ S3/Textract/Mock │
        └────────────────┘  └────────────┘  └──────────────────┘
```

`app/api/deps.py` is the composition root. It inspects `DEMO_MODE` and constructs either
the mock stack (no AWS, deterministic, used for the demo and tests) or the AWS stack.
The interface boundaries (`LLMProvider`, `WorkflowRepository`, `DocumentObjectStore`,
`DocumentProcessor`) are identical in both, so the application code is portable.

## 3. Component map

| Path | Responsibility |
| --- | --- |
| `backend/main.py` | FastAPI app, CORS, `/health`, `/`, logging setup |
| `backend/app/api/routes.py` | Thin HTTP layer: validation, error mapping, response models |
| `backend/app/api/deps.py` | Composition root; provider/repository selection |
| `backend/app/services/workflow_service.py` | Orchestrates generation + state machine + handlers |
| `backend/app/services/document_service.py` | Upload → store → extract text → classify → extract fields |
| `backend/app/services/eligibility.py` | Deterministic eligibility rule evaluation |
| `backend/app/workflow/state_machine.py` | Deterministic executor (`advance_workflow`) |
| `backend/app/workflow/conditions.py` | Closed registry of transition predicates |
| `backend/app/workflow/schema_validator.py` | Structural + safety validation of generated plans |
| `backend/app/ai/*` | `LLMProvider`, `BedrockProvider`, `MockLLMProvider`, prompts |
| `backend/app/models/*` | Pydantic contracts (workflow, document, audit, API, enums) |
| `backend/app/storage/*` | `WorkflowRepository` + DynamoDB / in-memory implementations |
| `backend/app/documents/*` | `DocumentObjectStore` / `DocumentProcessor` + AWS / mock implementations |
| `backend/app/core/*` | Config, logging, confidence gating |

## 4. Request lifecycle

### 4.1 Create

```
POST /workflows {goal}
  → workflow_service.create_workflow(goal)
      → audit: workflow_created
      → WorkflowGenerator.generate(goal, knowledge)
          → LLMProvider.generate_workflow()          (Bedrock or canonical mock)
          → Workflow.model_validate()                (strict pydantic)
          → schema_validator.validate_or_raise()     (structural + safety)
          → retry exactly once on failure
      → audit: workflow_generated
      → repository.save_workflow()
  → 200 {workflow_id, status, workflow}
```

An invalid plan is **never executed**. If generation + one retry fail the request returns
`409` and a terminal `workflow_generation_failed` outcome is recorded.

### 4.2 Advance

```
POST /workflows/{id}/advance {approval|acknowledge|user_input|confirm}
  → workflow_service.advance(id, inputs)
      → repository.get_workflow(id)            (404 if missing)
      → build ExecutionContext (collected docs + persisted collected_data)
      → build handlers for automatic/validation/execution states
      → state_machine.advance_workflow(...)     (pure, deterministic)
      → persist workflow + emitted audit events
  → 200 AdvanceWorkflowResponse {…detail, message, completed, events}
```

`GET /workflows/{id}` returns the same `WorkflowDetailResponse` shape, including the
normalized `needs` label, so the frontend can render from either endpoint identically.

### 4.3 Upload

```
POST /workflows/{id}/documents (multipart file)
  → size checked while streaming (413 if over MAX_DOCUMENT_SIZE_MB)
  → MIME validated (415 in non-demo mode)
  → DocumentService.process_upload()
      → object store put (S3 or mock)
      → processor extract_text (Textract or mock)
      → LLMProvider.classify_document()
      → LLMProvider.extract_fields()
  → 200 DocumentUploadResponse
```

## 5. State machine

The executor advances one logical step, auto-chaining deterministic states
(`automatic`, `validation`, `execution`) and pausing at any gated state
(`user_input`, `document_required`, `human_approval`). Details and the full contract live
in [`workflow-engine.md`](./workflow-engine.md).

Safety guarantees enforced at runtime (in addition to static validation):

- execution states cannot be entered without a prior `human_approval` in the same run;
- an execution state cannot be executed twice;
- terminal workflows reject further `advance` calls;
- a completed state with no satisfied transition is an error, never a silent stall;
- the automatic chain is bounded (`MAX_AUTOMATIC_CHAIN = 20`).

## 6. Persistence

`WorkflowRepository` is the only storage abstraction. `InMemoryRepository` is used in
demo/test mode and is thread-safe with copy-on-read/write value isolation, so it behaves
like a serialization boundary. `DynamoRepository` maps the same model to three logical
tables.

```
Workflows   PK: workflowId                    goal, status, currentState, states,
                                              collectedData, createdAt, updatedAt
Documents   PK: workflowId / SK: documentId   s3Key, storageKey, filename, mimeType,
                                              classification, extractedFields,
                                              validation*, uploadedAt, processedAt,
                                              purgedAt
AuditLog    PK: workflowId / SK: timestamp    eventId, eventType, fromState, toState,
                                              confidence, details
```

Environment: `AWS_DYNAMODB_TABLE_WORKFLOWS`, `AWS_DYNAMODB_TABLE_DOCUMENTS`,
`AWS_DYNAMODB_TABLE_AUDIT`, `AWS_S3_BUCKET`, `BEDROCK_REGION`.

### Document storage and retention

Every upload records two locators: `storage_key` (the raw object key, generated
server-side as `uploads/{workflow_id}/{random}_{sanitized basename}`) and `s3_key`
(the storage URI, `mock://key` in demo or `s3://bucket/key` in prod). The
`record_key()` helper unwraps both, including legacy URI rows, so deletions always
target the object itself (see `backend/app/services/document_service.py`).

Hardening stacked on top of the happy-path upload:

- **Size and content checks** are enforced before anything is persisted: oversized
  files get `413`, empty files get `400` (in *all* modes), and outside `DEMO_MODE`
  a magic-byte sniff (`app/documents/content_sniff.py`) rejects declared-type
  mismatches with `415`. Only the signature/type check is relaxed in demo mode so
  the frontend demo shortcut buttons keep working.
- **Fail-closed composition** (`app/api/deps.py`): outside `DEMO_MODE` a service
  that cannot be initialized raises `ServiceConfigurationError` rather than
  silently degrading to mocks. `ALLOW_MOCK_FALLBACK=true` re-enables the legacy
  fallback; `MOCK_LLM=true` remains an explicit opt-in. The resolved
  `storage_mode` (`demo` | `aws` | `aws_fallback`) is logged at startup.
- **Processing failure cleanup**: if upload→extract→classify fails, the stored
  bytes are deleted best-effort before the record is marked `failed`.
- **Retention purge**: reaching any terminal status (`completed`, `cancelled`,
  `blocked`, `failed`, `generation_failed`) fires a purge callback that deletes
  stored bytes best-effort, stamps `purged_at` on each record, and emits a
  `documents_purged` audit event. Controlled by
  `PURGE_DOCUMENTS_ON_COMPLETION` (default `true`).
- **S3 lifecycle**: the bucket denies non-TLS access, denies unencrypted uploads,
  aborts incomplete multipart uploads after 1 day, and enforces
  `BucketOwnerEnforced` with server-side AES256 encryption
  (`infrastructure/template.yaml`).
- **Bounded demo store**: `MockObjectStore` mirrors the S3 lifecycle with a 50 MB /
  500-object budget and oldest-first eviction, so demo memory stays bounded.

## 7. Configuration

All configuration is environment-driven (`app/core/config.py`) and read once via a
cached `get_settings()`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEMO_MODE` | `true` | Use mock LLM/repository/document stack (no AWS needed) |
| `ALLOW_MOCK_FALLBACK` | `false` | Allow silent mock fallback outside DEMO_MODE |
| `PURGE_DOCUMENTS_ON_COMPLETION` | `true` | Purge stored documents on terminal statuses |
| `ENVIRONMENT` | `development` | Reported by `/health` |
| `LOG_LEVEL` | `INFO` | Root logger level |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed browser origins |
| `MAX_DOCUMENT_SIZE_MB` | `10` | Upload size limit |
| `ALLOWED_MIME_TYPES` | pdf/png/jpeg | Upload MIME allow-list |
| `CONFIDENCE_PASS` / `CONFIDENCE_WARN` | `0.85` / `0.60` | Confidence gates |
| `BEDROCK_MODEL_ID` | Claude Sonnet 4.5 | Workflow generation + cross-validation |
| `BEDROCK_FAST_MODEL_ID` | Claude Haiku 4.5 | Classification + field extraction |
| `BEDROCK_MAX_RETRIES` / `BEDROCK_RETRY_BASE_SECONDS` | `3` / `1.0` | Throttle backoff |

**Fail-safe behavior:** outside `DEMO_MODE` the composition root fails closed — a
provider or repository that cannot be initialized raises `ServiceConfigurationError`
so a misconfigured deployment never silently serves a degraded mock stack. Set
`ALLOW_MOCK_FALLBACK=true` to restore the legacy degrade-to-mock behavior; the
resolved storage mode is always logged at startup.

## 8. Errors and observability

- Domain errors live in `app/workflow/errors.py`. Routes map them to HTTP status
  (`404` not found, `409` terminal/generation failure, `422` invalid transition,
  `413` oversize upload, `415` bad MIME).
- Unexpected exceptions become a generic `500 {"detail": "Internal server error"}`;
  the internal message is logged, never returned to the client.
- Structured stdout logging is configured once in `app/core/logging_config.py`.
- Every meaningful action emits an `AuditEvent` with a unique `event_id`, exposed via
  `GET /workflows/{id}/audit`.

## 9. Security stance

- **Prompt injection:** document text is treated as data, wrapped in explicit
  `<document_content>` delimiters, and marked untrusted (`ai/prompt_utils.py`).
- **No arbitrary actions:** an LLM can only reference the closed condition registry;
  unknown conditions fail schema validation.
- **Human in the loop:** no consequential action executes without a prior approval gate;
  demo submission is simulated.
- **Least privilege:** S3 objects are private and server-side encrypted; keys are
  generated server-side; uploads are MIME- and size-checked and magic-byte checked
  in non-demo mode; TLS is required and incomplete multipart uploads are aborted.
- **No real data:** all demo documents and profiles are fictional.

## 10. Deployment

Target is serverless: API Gateway + Lambda running the same FastAPI app, S3 for
documents, DynamoDB for state, Bedrock for model calls (see `infrastructure/` and
[`plan-c-infrastructure.md`](./team/plan-c-infrastructure.md)). Because storage and AI
are behind interfaces, the identical application code runs locally with `DEMO_MODE=true`.

## 11. References

- [`workflow-engine.md`](./workflow-engine.md) — contract, conditions, executor
- [`ai-architecture.md`](./ai-architecture.md) — controlled AI components
- [`api-reference.md`](./api-reference.md) — generated HTTP reference
- [`evaluation.md`](./evaluation.md) — metrics and methodology
