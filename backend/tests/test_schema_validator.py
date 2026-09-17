"""Tests for the workflow schema validator."""

from __future__ import annotations

import pytest

from app.workflow.schema_validator import validate

from .helpers import (
    approval_state,
    auto_state,
    doc_state,
    execution_state,
    make_workflow,
    terminal_state,
)


@pytest.fixture
def valid_states():
    return [
        auto_state("check", [("docs", "eligibility_passed")]),
        doc_state("docs", [("validate", "documents_ready")], ["transcript"]),
        auto_state("validate", [("approve", "validation_passed")]),
        approval_state("approve", [("submit", "approval_granted")]),
        execution_state("submit"),
        terminal_state("completed"),
    ]


def test_valid_workflow_passes(valid_states):
    wf = make_workflow(valid_states, initial="check", terminals=["completed", "cancelled"])
    report = validate(wf)
    assert report.valid, report.errors


def test_duplicate_state_ids_rejected():
    a = auto_state("x", [("y", "always")])
    b = auto_state("x", [("y", "always")])
    wf = make_workflow([a, b, terminal_state("y")], initial="x", terminals=["y"])
    assert not validate(wf).valid


def test_unknown_initial_state_rejected(valid_states):
    valid_states[0].id = "renamed"
    wf = make_workflow(valid_states, initial="missing", terminals=["completed"])
    report = validate(wf)
    assert not report.valid
    assert any("initial_state" in e for e in report.errors)


def test_unknown_transition_target_rejected(valid_states):
    valid_states[0].transitions[0].target = "nope"
    wf = make_workflow(valid_states, initial="check", terminals=["completed"])
    assert not validate(wf).valid


def test_unknown_condition_rejected(valid_states):
    valid_states[0].transitions[0].condition = "magic_condition"
    wf = make_workflow(valid_states, initial="check", terminals=["completed"])
    report = validate(wf)
    assert not report.valid
    assert any("condition" in e for e in report.errors)


def test_terminal_with_transitions_rejected_by_model():
    from app.models.workflow import State, Transition
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        State(
            id="end",
            label="end",
            type="terminal",
            transitions=[Transition(target="completed", condition="always")],
        )


def test_non_terminal_requires_transitions(valid_states):
    valid_states[1].transitions = []
    wf = make_workflow(valid_states, initial="check", terminals=["completed"])
    report = validate(wf)
    assert not report.valid
    assert any("no outgoing transitions" in e for e in report.errors)


def test_unreachable_state_rejected(valid_states):
    extra = auto_state("ghost", [("completed", "always")])
    valid_states.append(extra)
    wf = make_workflow(valid_states, initial="check", terminals=["completed"])
    report = validate(wf)
    assert not report.valid
    assert any("ghost" in e and "unreachable" in e for e in report.errors)


def test_no_reachable_terminal_rejected():
    wf = make_workflow([auto_state("a", [("b", "always")]), auto_state("b", [("a", "always")])], initial="a", terminals=["completed"])
    report = validate(wf)
    assert not report.valid


def test_execution_without_prior_approval_rejected():
    states = [
        auto_state("check", [("submit", "eligibility_passed")]),
        execution_state("submit"),
        terminal_state("completed"),
    ]
    wf = make_workflow(states, initial="check", terminals=["completed"])
    report = validate(wf)
    assert not report.valid
    assert any("execution state" in e for e in report.errors)


def test_automatic_only_cycle_rejected():
    states = [
        auto_state("a", [("b", "always")]),
        auto_state("b", [("a", "always")]),
        terminal_state("completed"),
    ]
    # add a dead-end route from a so terminal is reachable too
    states[1].transitions.append(transition_to("completed"))
    wf = make_workflow(states, initial="a", terminals=["completed"])
    report = validate(wf)
    assert not report.valid
    assert any("loop" in e for e in report.errors)


def transition_to(target: str):
    from app.models.workflow import Transition

    return Transition(target=target, condition="always")