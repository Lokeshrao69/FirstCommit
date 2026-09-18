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