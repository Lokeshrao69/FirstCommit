# FlowForge Architecture

## Design principle

> **The LLM plans. The state machine executes. The human stays in control.**

FlowForge is not "an AI chatbot that answers questions." It is a **domain-agnostic
agentic workflow engine**. The scholarship flow is only the demo use case. The same
engine can drive insurance claims, reimbursements, college applications, government
services, visa processes, and more — without rewriting the core.

## Separation of concerns

| Layer | Responsibility | Who "thinks"? |
| --- | --- | --- |
| Workflow Planning LLM | Turns a natural-language goal into structured workflow JSON | AI (non-deterministic) |
| Schema Validator | Rejects malformed/unsafe workflows | Deterministic |
| State Machine | Executes transitions, enforces ordering and approval gates | Deterministic (intentionally dumb) |
| Document Pipeline | Classify + extract fields + cross-validate | AI for analysis, rules for gates |
| Human Approval | Approves consequential actions | Human |
| Audit Log | Records every meaningful event | Deterministic |

The LLM produces a **plan only**. It never decides runtime transitions. Execution is a
pure function of `(current_state, execution_result) -> next_state`.

## Components

```
backend/app/
  api/          FastAPI routes (thin HTTP layer)
  core/         config, enums, security helpers
  models/       Pydantic schemas (workflow, documents, audit, API)
  services/     orchestration: workflow planner, doc pipeline
  ai/           providers: BedrockProvider, MockLLMProvider (interface: LLMProvider)
  storage/      DynamoRepository, InMemoryRepository (interface: WorkflowRepository)
  documents/    document ingestion + processors (Textract / Mock)
  workflow/     schema_validator, state_machine, audit, executor
```

## The workflow contract

A workflow is a validated JSON document (see `docs/workflow-engine.md`):

```
workflow_id, goal, initial_state, terminal_states, states[]
  each state: id, label, type, description, required_data,
              required_documents, validation_rules, transitions, status
  each transition: target, condition
```

Every workflow must pass:

1. JSON parsing
2. Pydantic validation
3. Structural validation (unique ids, existing targets)
4. Transition validation (valid conditions)
5. Reachability validation (path to a terminal state)
6. Safety validation (no uncontrolled execution; human approval precedes consequential
   execution)

An invalid generated workflow is **never executed**. It triggers exactly one retry, then
a terminal `workflow_generation_failed` state.

## State machine

The executor supports these state types:

- `automatic` — deterministic logic
- `user_input` — awaits user data
- `document_required` — awaits document upload
- `validation` — runs validation rules
- `human_approval` — requires explicit human consent
- `execution` — simulated (or real, approval-gated) consequential action
- `terminal` — workflow end

The executor prevents: skipping states, jumping to submission, execution without
approval, invalid/unknown transitions, duplicate execution, and corrupted state.

## Confidence gating

Every AI output carries confidence.

| Confidence | Behavior |
| --- | --- |
| >= 0.85 | auto pass |
| 0.60 – 0.849 | warning / user review |
| < 0.60 | block |

`human_approval` always requires explicit approval regardless of confidence.

## AWS integration

Real AWS wiring exists behind interfaces:

- **S3** — private, encrypted, server-side, generated keys, MIME + size validation
- **Textract** — document text extraction
- **Bedrock** — workflow generation, classification, field extraction, cross-validation
- **DynamoDB** — `Workflows`, `Documents`, `AuditLog` logical tables
- **Lambda + API Gateway** — serverless deployment (see `infrastructure/template.yaml`)

Local development uses `DEMO_MODE=true` with the same interfaces backed by an
in-memory repository and mock providers. See `docs/ai-architecture.md`.

## Security stance

- Document text is heterogenous data, never instructions. It is wrapped in explicit
  delimiters and flagged as untrusted.
- LLM-generated workflows must pass schema validation; the LLM cannot introduce
  arbitrary executable actions.
- No real external submission. Execution is simulated; any future real action requires
  human approval.
- No real personal data in the demo. All demo documents are fictional.

## Data model (DynamoDB logical tables)

```
Workflows   PK: workflowId            userId, goal, status, currentState, states,
                                      collectedData, createdAt, updatedAt
Documents   PK: workflowId / SK: documentId
                                      s3Key, filename, mimeType, classification,
                                      classificationConfidence, extractedFields,
                                      validationStatus, validationIssues,
                                      uploadedAt, processedAt
AuditLog    PK: workflowId / SK: timestamp
                                      eventType, fromState, toState, confidence, details
```