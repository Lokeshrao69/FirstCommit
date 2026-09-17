"""Registered, deterministic transition conditions.

The executor evaluates these predicates at runtime to pick the next state. The set is
closed and finite: an LLM-generated workflow may only reference these exact condition
names. Anything else is rejected by the schema validator.

Conditions are pure functions of the execution context (collected data, per-state
results, and the current advance input). They never invoke the LLM.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Dict

from ..models.workflow import State

if TYPE_CHECKING:
    from .state_machine import ExecutionContext

Condition = Callable[["ExecutionContext", State], bool]

_REGISTRY: Dict[str, Condition] = {}


def condition(name: str) -> Callable[[Condition], Condition]:
    def deco(fn: Condition) -> Condition:
        _REGISTRY[name] = fn
        return fn

    return deco


@condition("always")
def _always(ctx: "ExecutionContext", state: State) -> bool:
    return True


@condition("eligibility_passed")
def _elig_passed(ctx: "ExecutionContext", state: State) -> bool:
    return bool(ctx.results.get(state.id, {}).get("eligible"))


@condition("eligibility_failed")
def _elig_failed(ctx: "ExecutionContext", state: State) -> bool:
    return ctx.results.get(state.id, {}).get("eligible") is False


@condition("documents_ready")
def _docs_ready(ctx: "ExecutionContext", state: State) -> bool:
    required = set(state.required_documents)
    return required.issubset(set(ctx.collected_documents))


@condition("documents_missing")
def _docs_missing(ctx: "ExecutionContext", state: State) -> bool:
    required = set(state.required_documents)
    return not required.issubset(set(ctx.collected_documents))


@condition("validation_passed")
def _val_passed(ctx: "ExecutionContext", state: State) -> bool:
    return ctx.results.get(state.id, {}).get("status") == "pass"


@condition("validation_needs_review")
def _val_review(ctx: "ExecutionContext", state: State) -> bool:
    return ctx.results.get(state.id, {}).get("status") == "needs_review"


@condition("validation_blocked")
def _val_blocked(ctx: "ExecutionContext", state: State) -> bool:
    return ctx.results.get(state.id, {}).get("status") == "block"


@condition("approval_granted")
def _approval_granted(ctx: "ExecutionContext", state: State) -> bool:
    return ctx.results.get(state.id, {}).get("approved") is True


@condition("approval_rejected")
def _approval_rejected(ctx: "ExecutionContext", state: State) -> bool:
    return ctx.results.get(state.id, {}).get("approved") is False


@condition("submission_complete")
def _submission_complete(ctx: "ExecutionContext", state: State) -> bool:
    return bool(ctx.results.get(state.id, {}).get("submitted"))


@condition("user_confirmed")
def _user_confirmed(ctx: "ExecutionContext", state: State) -> bool:
    if ctx.inputs is None:
        return False
    return bool(ctx.inputs.confirm or ctx.inputs.acknowledge)


def known_conditions() -> set[str]:
    return set(_REGISTRY)


def is_known_condition(name: str) -> bool:
    return name in _REGISTRY


def evaluate(condition_name: str, ctx: "ExecutionContext", state: State) -> bool:
    fn = _REGISTRY.get(condition_name)
    if fn is None:
        raise KeyError(f"unknown transition condition: {condition_name}")
    return fn(ctx, state)
