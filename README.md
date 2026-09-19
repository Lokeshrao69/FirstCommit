# FlowForge

**From intent to execution.**

> FlowForge converts natural-language goals into validated, executable workflows and guides users through those workflows using AI-powered document intelligence and human-in-the-loop approval.

## The core concept

```
Natural Language Goal
        |
        v
Workflow Planning LLM
        |
        v
Structured Workflow JSON
        |
        v
JSON Schema Validation
        |
        v
Deterministic State Machine
        |
        +---- Document Processing
        |
        +---- Validation
        |
        +---- User Input
        |
        +---- Human Approval
        |
        +---- Simulated Execution
        |
        v
Workflow Completion
```

**The LLM plans. The state machine executes. The human stays in control.**

## Quick start

### Backend (local, demo mode — no AWS needed)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp ../.env.example .env        # DEMO_MODE=true
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The guided flow walks you through each step:

1. Describe your goal (e.g. **Apply for the Merit Excellence Scholarship**)
2. Review the generated plan, or view it as a diagram
3. Upload your documents (pick or drag & drop) — each is checked as you add it
4. Review the application and resolve any warnings
5. Submit — nothing is sent until you click **Submit application**

Use the **Activity** panel to follow progress. To run against the real backend
instead of the offline mock:

```bash
# Windows PowerShell / cmd
set VITE_USE_MOCK=false
npm run dev
```

## Demo mode

`DEMO_MODE=true` (the default local config) runs the entire path against:

- a pre-generated, schema-valid workflow
- deterministic mock document extraction
- simulated submission

The real **Amazon Bedrock**, **S3**, **Textract**, **DynamoDB** and **Lambda** implementations
exist behind the same interfaces and are used when AWS credentials are available
(`DEMO_MODE=false`). See `docs/ai-architecture.md` and `docs/architecture.md`.

## What is in the repo

- `frontend/` — React + TypeScript + Vite + Tailwind + React Flow application
- `backend/` — FastAPI application; business logic is isolated from HTTP and AWS
- `infrastructure/` — AWS SAM template for serverless deployment
- `evaluation/` — ground-truth datasets and evaluation scripts
- `docs/` — architecture, AI, workflow-engine, API and evaluation notes

## Architectural limitations & security boundaries

FlowForge is designed and implemented as an **anonymous, single-tenant proof-of-concept / demo workflow engine**. To prevent misinterpretation of its security boundaries:

1. **Access Control & Multi-Tenancy:** Workflows and documents are keyed by high-entropy UUIDs (`wf_<12 hex>`). The API does **not** feature user authentication (Cognito/JWT/OIDC) or user-level ownership isolation (`owner_id`). Production multi-tenant adoption strictly requires provisioning an API Gateway authorizer, user-level tenancy partitions in DynamoDB and S3, and role-based access control.
2. **Deterministic Evaluation vs. Live AWS:** The test suite and evaluation metrics (`evaluation/run_evaluation.py`) evaluate the deterministic pipeline mechanics and schema compliance under `DEMO_MODE=true`. They do not claim live Bedrock or Textract accuracy benchmarks, which require live AWS deployment and active model subscriptions.

## Definition of done

The project is complete when this full path works end to end:

```
User enters goal -> Workflow generated -> Workflow validated -> Graph rendered
-> State machine starts -> Document uploaded -> Document classified
-> Fields extracted -> Requirements validated -> Conflict detected
-> User reviews -> Human approves -> Submission simulated
-> Workflow completed -> Audit trail available
```

## License

MIT — see `LICENSE`.