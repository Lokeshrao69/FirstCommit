# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + TypeScript + Vite + Tailwind v3 + @xyflow/react, FastAPI backend. Mock-first frontend (`services/mock.ts`) with a live-mode API client behind the same contract. Build: `npm run build` (tsc + vite), lint: `npm run lint`.

## Users

Two audiences. Primary demo audience: **hackathon judges** — non-specialists who must grasp a complex system in ~90 seconds: judge understands it is a workflow engine, then that they can type a natural-language goal and watch it build and execute a structured workflow, then that the system catches real document problems before submission while keeping a human in control. Secondary audience: **end users** (e.g. a student applying for a post-matric scholarship) who need to assemble documents, understand results, and make confident decisions without understanding state machines, DAGs, LLMs, or AWS services.

## Product Purpose

FlowForge turns a natural-language intent into a runnable, validated, human-supervised execution. "From intent to execution." The LLM plans, the state machine executes, the human stays in control. The scholarship/document-validation workflow is the hero demonstration; the product itself is a domain-agnostic workflow engine.

## Positioning

A system where the LLM proposes the blueprint but never acts uncontrolled: every consequential step is bounded by a deterministic state machine, validated against real documents, gated by human approval, and fully auditable. The decisive demo proof is catching a document problem (name mismatch, expired certificate, over-limit income) *before* submission — and never letting the AI make the final call.

## Operating Context

- Goal intake is free text; the engine resolves a service (post-matric scholarship, old-age pension, income certificate) from the goal.
- Documents are uploaded and classified; fields are extracted; cross-document validation produces a verdict: pass, needs_review, or block.
- Human approval gates exist for warnings and for final submission; nothing submits without explicit consent.
- Everything is recorded as an audit trail (workflow created, state activations/transitions, uploads, extraction, human approval, execution, completion).
- Demo harness: `npm run dev` (Vite :5173 with /api proxy to :8000); DEMO_MODE backend; deterministic mock corpus in `frontend/src/services/mock.ts` and `evaluation/test_documents/`.

## Capabilities and Constraints

- Deep-linkable workflow via `?workflow=<id>`; goal/plan/document/approval/termination phases.
- Backend contract must not change: `POST /workflows`, `POST /workflows/{id}/advance`, `POST /workflows/{id}/documents`, `GET /workflows/{id}`, `GET /workflows/{id}/audit`.
- Demo shortcuts must keep working and be hidden in production: "Load demo documents", "Load a variant that gets blocked", and the scholarship / pension / income-certificate example goals.
- UI must distinguish mock vs live mode honestly (dev-only). No invented APIs, no hardcoded visual states that fake real app state; mock data comes from the real mock corpus.
- Documentation must not expose internal architecture terminology to end users.

## Brand Commitments

- Name: FlowForge ("forge"). Tagline: "From intent to execution." Core principle: "The LLM plans. The state machine executes. The human stays in control."
- Identity: premium, intentional, engineered — explicitly NOT a generic Bootstrap/Tailwind dashboard, CRUD admin, chatbot, or purple-gradient AI SaaS look. Treated as a serious product that must feel award-worthy. Human-in-the-loop is a differentiator and must feel deliberate, never like an error.

## Evidence on Hand

- Real demo corpus: `evaluation/test_documents/` and the filename-keyed verdicts in `frontend/src/services/mock.ts`.
- Backend OpenAPI in `docs/openapi.json`; `docs/` architecture notes; prior frontend audit in `docs/team/frontend-audit-2026-09.md`.
- No pending claims to fabricate: no real testimonials, customers, prices, or benchmarks.

## Product Principles

1. Intent comes first; the interface must make the intent → plan → validate → execute → human-control arc legible at a glance.
2. The user always knows where they are, what FlowForge is doing, what is done, what needs attention, why something is blocked, and what happens next.
3. The human approval moment and the conflict-detection moment are the product's defining experiences and must feel intentional and trustworthy.
4. AI is infrastructure, not magic: show operations being performed, never fake "thinking".
5. Every asynchronous operation has a deliberate state; failures are product surfaces, never crashes.

## Accessibility & Inclusion

Keyboard navigable, visible focus, sufficient contrast on dark surfaces (body and placeholder ≥4.5:1), status never conveyed by color alone (icon + text), `prefers-reduced-motion` respected, screen-reader status announcements for async work.