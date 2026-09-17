"""Shared test helpers."""

from __future__ import annotations

from app.models.workflow import State, Transition, Workflow

TERMINALS = {"completed", "cancelled"}


def transition(target: str, condition: str = "always") -> Transition:
    return Transition(target=target, condition=condition)


def auto_state(
    sid: str,
    targets: list[tuple[str, str]],
    label: str = "",
    description: str = "",
    confidence_threshold: float = 0.85,
    required_documents: list[str] | None = None,
) -> State:
    return State(
        id=sid,
        label=label or sid,
        type="automatic",
        description=description,
        transitions=[transition(t, c) for t, c in targets],
        confidence_threshold=confidence_threshold,
        required_documents=required_documents or [],
    )


def user_state(sid: str, targets: list[tuple[str, str]], required_data: list[str]) -> State:
    return State(
        id=sid,
        label=sid,
        type="user_input",
        description="",
        required_data=required_data,
        transitions=[transition(t, c) for t, c in targets],
    )


def doc_state(sid: str, targets: list[tuple[str, str]], required_documents: list[str]) -> State:
    return State(
        id=sid,
        label=sid,
        type="document_required",
        description="",
        required_documents=required_documents,
        transitions=[transition(t, c) for t, c in targets],
    )


def approval_state(sid: str, targets: list[tuple[str, str]]) -> State:
    return State(
        id=sid,
        label=sid,
        type="human_approval",
        description="",
        transitions=[transition(t, c) for t, c in targets],
    )


def execution_state(sid: str, target: str = "completed") -> State:
    return State(
        id=sid,
        label=sid,
        type="execution",
        description="",
        transitions=[transition(target, "submission_complete")],
    )


def terminal_state(sid: str, label: str | None = None) -> State:
    return State(id=sid, label=label or sid, type="terminal", description="")


def make_workflow(states: list[State], initial: str, terminals: list[str] | None = None) -> Workflow:
    return Workflow(
        workflow_id="wf_test",
        goal="test goal",
        initial_state=initial,
        terminal_states=terminals or list(TERMINALS),
        states=states,
    )


def always_handler(*args, **kwargs):
    from app.workflow.state_machine import StepResult

    def execute(state, ctx):
        return StepResult(status="completed", data={})

    return execute
