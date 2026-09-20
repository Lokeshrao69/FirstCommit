"""Deterministic rule engine.

Finance/eligibility decisions are made here with plain arithmetic, not by the LLM.
The AI provider only *advisories* on top; it can never reverse a hard rule. This
module has no I/O and no side effects, so it is trivial to unit test.
"""
