"""Tests for the deterministic state machine executor."""

from __future__ import annotations

import pytest

from app.models.api import AdvanceWorkflowRequest
from app.models.enums import StateStatus, WorkflowStatus
from app.workflow.errors import ExecutionError, InvalidTransitionError, WorkflowAlreadyTerminalError
from app.workflow.state_machine import ExecutionContext, StepResult, advance_workflow

from .helpers import (
    approval_state,
    auto_state,
    doc_state,
    execution_state,
    make_workflow,
    terminal_state,
)


def build_full():
    states = [
        auto_state("check", [("docs", "eligibility_passed")]),
        doc_state("docs", [("validate", "documents_ready")], ["transcript"]),
        execution_state("submit"),
        terminal_state("completed"),
    ]
    # validate documents -> submission requires approval first
    return make_workflow(states, initial="check", terminals=["completed"])


def done_handler(data: dict | None = None):
    def execute(state, ctx):
        return StepResult(status="completed", data=data or {})

    return execute


def result_handler(make):
    def execute(state, ctx):
        return StepResult(status="completed", data=make(ctx))

    return execute


def run_once(workflow, handlers, ctx, inputs=None):
    return advance_workflow(workflow, handlers, ctx, inputs)


def test_user_input_waits_then_completes():
    states = [
        auto_state("start", [("ask", "always")]),
        user_ask([("end", "always")], ["email"]),
        terminal_state("end"),
    ]
    wf = make_workflow(states, initial="start", terminals=["end"])
    result = run_once(wf, {"start": done_handler()}, ExecutionContext())
    assert result.needs == "user_input"

    result2 = run_once(wf, {"start": done_handler()}, ExecutionContext(), AdvanceWorkflowRequest())
    assert result2.needs == "user_input"

    result3 = run_once(
        wf, {"start": done_handler()}, ExecutionContext(),
        AdvanceWorkflowRequest(user_input={"email": "a@b.c"}),
    )
    assert result3.completed
    assert result3.workflow.status == WorkflowStatus.COMPLETED
    assert result3.workflow.collected_data["email"] == "a@b.c"


def user_ask(targets, required_data):
    from .helpers import user_state

    return user_state("ask", targets, required_data)


def test_document_required_waits_for_documents():
    states = [
        auto_state("check", [("docs", "eligibility_passed")]),
        doc_state("docs", [("approve", "documents_ready")], ["transcript"]),
        approval_state("approve", [("submit", "approval_granted")]),
        execution_state("submit"),
        terminal_state("completed"),
    ]
    wf = make_workflow(states, initial="check", terminals=["completed"])
    ctx = ExecutionContext()
    check = done_handler({"eligible": True})
    result = run_once(wf, {"check": check, "submit": done_handler({"submitted": True})}, ctx)
    assert result.needs == "document_upload"
    assert wf.get_state("docs").status == StateStatus.ACTIVE

    ctx.collected_documents["transcript"] = {"meta": "x"}
    result2 = run_once(
        wf,
        {"check": check, "submit": done_handler({"submitted": True})},
        ctx,
    )
    assert result2.needs == "approval"
    assert wf.get_state("approve").status == StateStatus.ACTIVE
    assert wf.get_state("submit").status == StateStatus.PENDING


def test_human_approval_required_before_execution_runtime():
    """Even a hand-built workflow reaching execution without an approval record must be refused."""
    states = [
        auto_state("go", [("submit", "always")]),
        execution_state("submit"),
        terminal_state("completed"),
    ]
    # note: schema validator would reject this; the runtime guard is defense-in-depth
    wf = make_workflow(states, initial="go", terminals=["completed"])
    with pytest.raises(InvalidTransitionError, match="without prior human approval"):
        run_once(wf, {"go": done_handler()}, ExecutionContext())


def test_approval_then_execution():
    states = [
        auto_state("go", [("approve", "always")]),
        approval_state("approve", [("submit", "approval_granted")]),
        execution_state("submit"),
        terminal_state("completed"),
    ]
    wf = make_workflow(states, initial="go", terminals=["completed"])
    result = run_once(wf, {"go": done_handler()}, ExecutionContext())
    assert result.needs == "approval"

    def sub_handler(state, ctx):
        return StepResult(status="completed", data={"submitted": True})

    result2 = run_once(
        wf,
        {"go": done_handler(), "submit": sub_handler},
        ExecutionContext(),
        AdvanceWorkflowRequest(approval=True),
    )
    assert result2.completed
    assert result2.workflow.status == WorkflowStatus.COMPLETED


def test_approval_rejection_routes():
    states = [
        auto_state("go", [("approve", "always")]),
        approval_state("approve", [("cancelled", "approval_rejected")]),
        terminal_state("cancelled"),
    ]
    wf = make_workflow(states, initial="go", terminals=["cancelled"])
    ctx = ExecutionContext()
    run_once(wf, {"go": done_handler()}, ctx)
    user = wf.get_state("approve")
    assert user.status == StateStatus.ACTIVE
    result = run_once(
        wf, {"go": done_handler()}, ctx, AdvanceWorkflowRequest(approval=False)
    )
    assert result.workflow.status == WorkflowStatus.CANCELLED


def test_no_transition_satisfied_raises():
    states = [
        auto_state("go", [("submit", "approval_granted")]),
        execution_state("submit"),
        terminal_state("completed"),
    ]
    wf = make_workflow(states, initial="go", terminals=["completed"])
    with pytest.raises(ExecutionError, match="no outgoing transition condition"):
        run_once(wf, {"go": done_handler()}, ExecutionContext())


def test_cannot_skip_state_by_advancing_with_input():
    """User input at the wrong time must not skip gated states."""
    states = [
        auto_state("check", [("ask", "always")]),
        user_ask([("approve", "always")], ["email"]),
        approval_state("approve", [("end", "approval_granted")]),
        terminal_state("end"),
    ]
    wf = make_workflow(states, initial="check", terminals=["end"])
    ctx = ExecutionContext()
    result = run_once(wf, {"check": done_handler()}, ctx)
    assert result.needs == "user_input"
    # approval while at user_input has no effect; still needs input
    result2 = run_once(
        wf, {"check": done_handler()}, ctx, AdvanceWorkflowRequest(approval=True)
    )
    assert result2.needs == "user_input"
    assert wf.get_state("ask").status == StateStatus.ACTIVE
    assert wf.get_state("approve").status == StateStatus.PENDING


def test_terminal_is_end_state():
    states = [
        auto_state("go", [("end", "always")]),
        terminal_state("end"),
    ]
    wf = make_workflow(states, initial="go", terminals=["end"])
    result = run_once(wf, {"go": done_handler()}, ExecutionContext())
    assert result.completed
    assert result.workflow.status == WorkflowStatus.COMPLETED
    with pytest.raises(WorkflowAlreadyTerminalError):
        run_once(wf, {"go": done_handler()}, ExecutionContext())


def test_recovery_after_paused_state():
    """A workflow paused at a gated state can be resumed later."""
    states = [
        auto_state("check", [("ask", "always")]),
        user_ask([("end", "always")], ["email"]),
        terminal_state("end"),
    ]
    wf = make_workflow(states, initial="check", terminals=["end"])
    ctx = ExecutionContext()
    run_once(wf, {"check": done_handler()}, ctx)
    # simulate restart / recovery: same workflow, fresh context, but state is persisted
    ctx2 = ExecutionContext()
    result = run_once(
        wf,
        {"check": done_handler(), "ask": result_handler(lambda c: {"email": "r@e.c"})},
        ctx2,
        AdvanceWorkflowRequest(),
    )
    # ask still requires input because inputs lacked it
    assert result.needs == "user_input"
    res = run_once(
        wf, {"check": done_handler(), "ask": result_handler(lambda c: {"email": "r@e.c"})}, ctx2,
        AdvanceWorkflowRequest(user_input={"email": "r@e.c"}),
    )
    assert res.completed


def test_duplicate_execution_blocked():
    states = [
        auto_state("go", [("approve", "always")]),
        approval_state("approve", [("submit", "approval_granted")]),
        execution_state("submit", "completed"),
        terminal_state("completed"),
    ]
    wf = make_workflow(states, initial="go", terminals=["completed"])

    def sub(state, ctx):
        return StepResult(status="completed", data={"submitted": True})

    ctx = ExecutionContext()
    result = run_once(wf, {"go": done_handler(), "submit": sub}, ctx)
    assert result.needs == "approval"
    result = run_once(
        wf, {"go": done_handler(), "submit": sub}, ctx, AdvanceWorkflowRequest(approval=True)
    )
    assert result.completed
    assert wf.status == WorkflowStatus.COMPLETED
    # already-terminal workflows must refuse further execution
    with pytest.raises(WorkflowAlreadyTerminalError):
        run_once(wf, {"go": done_handler(), "submit": sub}, ctx, AdvanceWorkflowRequest(approval=True))


def test_state_hierarchy_persisted():
    """Workflow state is mutated on the workflow object so it can be persisted."""
    states = [
        auto_state("go", [("approve", "always")]),
        approval_state("approve", [("submit", "approval_granted")]),
        execution_state("submit", "completed"),
        terminal_state("completed"),
    ]
    wf = make_workflow(states, initial="go", terminals=["completed"])
    run_once(wf, {"go": done_handler()}, ExecutionContext())
    assert wf.get_state("go").status == StateStatus.COMPLETED
    assert wf.get_state("approve").status == StateStatus.ACTIVE
    assert wf.current_state == "approve"
