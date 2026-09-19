"""Unit tests for DynamoRepository and DynamoDB serialization."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.models.audit import AuditEvent
from app.models.document import DocumentRecord
from app.models.enums import AuditEventType, DocumentStatus, StateStatus, StateType, WorkflowStatus
from app.models.workflow import State, Transition, Workflow
from app.storage.dynamo import DynamoRepository, _dumps, _loads, _unconvert


def test_convert_and_unconvert_primitives():
    data = {
        "str_val": "hello",
        "int_val": 42,
        "float_val": 3.85,
        "bool_val": True,
        "none_val": None,
        "list_val": [1, "two", 3.0, False],
        "dict_val": {"nested_num": 99.9, "nested_str": "world"},
    }
    dumped = _dumps(data)
    loaded = _loads(dumped)
    assert loaded == data
    assert isinstance(loaded["float_val"], float)
    assert isinstance(loaded["int_val"], int)


def test_backward_compatibility_numeric_string():
    # If older rows stored numbers as strings {"S": "3.85"}
    attr = {"S": "3.85"}
    val = _unconvert(attr)
    assert val == "3.85"


def test_dynamo_repository_workflow_crud():
    mock_client = MagicMock()
    repo = DynamoRepository(
        table_workflows="test-workflows",
        table_documents="test-documents",
        table_audit="test-audit",
        client=mock_client,
    )

    workflow = Workflow(
        workflow_id="wf_test_123",
        goal="Test Goal",
        initial_state="start",
        terminal_states=["end"],
        status=WorkflowStatus.IN_PROGRESS,
        states=[
            State(
                id="start",
                label="Start",
                type=StateType.USER_INPUT,
                description="Input data",
                status=StateStatus.ACTIVE,
                transitions=[Transition(target="end", condition="always")],
            ),
            State(
                id="end",
                label="End",
                type=StateType.TERMINAL,
                description="Finished",
                status=StateStatus.PENDING,
            ),
        ],
    )

    # Save
    repo.save_workflow(workflow)
    mock_client.put_item.assert_called_once()
    call_args = mock_client.put_item.call_args[1]
    assert call_args["TableName"] == "test-workflows"
    assert call_args["Item"]["workflowId"]["S"] == "wf_test_123"

    # Get
    mock_client.get_item.return_value = {
        "Item": call_args["Item"]
    }
    retrieved = repo.get_workflow("wf_test_123")
    assert retrieved is not None
    assert retrieved.workflow_id == "wf_test_123"
    assert retrieved.goal == "Test Goal"
    assert len(retrieved.states) == 2


def test_dynamo_repository_document_crud():
    mock_client = MagicMock()
    repo = DynamoRepository(
        table_workflows="test-workflows",
        table_documents="test-documents",
        table_audit="test-audit",
        client=mock_client,
    )

    doc = DocumentRecord(
        workflow_id="wf_test_123",
        document_id="doc_abc_456",
        filename="transcript.pdf",
        mime_type="application/pdf",
        status=DocumentStatus.CLASSIFIED,
        classification="academic_transcript",
        classification_confidence=0.95,
    )

    # Save
    repo.save_document(doc)
    call_args = mock_client.put_item.call_args[1]
    assert call_args["TableName"] == "test-documents"
    assert call_args["Item"]["workflowId"]["S"] == "wf_test_123"
    assert call_args["Item"]["documentId"]["S"] == "doc_abc_456"

    # Get
    mock_client.get_item.return_value = {
        "Item": call_args["Item"]
    }
    retrieved = repo.get_document("wf_test_123", "doc_abc_456")
    assert retrieved is not None
    assert retrieved.document_id == "doc_abc_456"
    assert retrieved.classification == "academic_transcript"
    assert retrieved.classification_confidence == 0.95

    # List
    mock_client.query.return_value = {
        "Items": [call_args["Item"]]
    }
    docs = repo.list_documents("wf_test_123")
    assert len(docs) == 1
    assert docs[0].document_id == "doc_abc_456"


def test_dynamo_repository_document_maps_storage_and_purge_fields():
    mock_client = MagicMock()
    repo = DynamoRepository(
        table_workflows="test-workflows",
        table_documents="test-documents",
        table_audit="test-audit",
        client=mock_client,
    )

    doc = DocumentRecord(
        workflow_id="wf_test_123",
        document_id="doc_abc_456",
        filename="transcript.pdf",
        mime_type="application/pdf",
        status=DocumentStatus.EXTRACTED,
        storage_key="uploads/wf_test_123/abc.pdf",
        s3_key="mock://uploads/wf_test_123/abc.pdf",
        purged_at="2026-09-19T00:00:00+00:00",
    )

    repo.save_document(doc)
    call_args = mock_client.put_item.call_args[1]
    assert call_args["Item"]["storage_key"]["S"] == doc.storage_key
    assert call_args["Item"]["purged_at"]["S"] == doc.purged_at

    mock_client.get_item.return_value = {"Item": call_args["Item"]}
    retrieved = repo.get_document("wf_test_123", "doc_abc_456")
    assert retrieved is not None
    assert retrieved.storage_key == doc.storage_key
    assert retrieved.purged_at == doc.purged_at


def test_dynamo_document_read_handles_legacy_rows_without_new_fields():
    mock_client = MagicMock()
    repo = DynamoRepository(
        table_workflows="test-workflows",
        table_documents="test-documents",
        table_audit="test-audit",
        client=mock_client,
    )
    legacy_item = {
        "workflowId": {"S": "wf_test_123"},
        "documentId": {"S": "doc_old"},
        "filename": {"S": "old.pdf"},
        "mime_type": {"S": "application/pdf"},
        "status": {"S": "extracted"},
        "s3_key": {"S": "mock://uploads/wf_test_123/old.pdf"},
    }
    mock_client.get_item.return_value = {"Item": legacy_item}
    retrieved = repo.get_document("wf_test_123", "doc_old")
    assert retrieved is not None
    assert retrieved.storage_key is None
    assert retrieved.purged_at is None
    assert retrieved.s3_key == "mock://uploads/wf_test_123/old.pdf"


def test_dynamo_repository_audit_crud_and_backward_compat():
    mock_client = MagicMock()
    repo = DynamoRepository(
        table_workflows="test-workflows",
        table_documents="test-documents",
        table_audit="test-audit",
        client=mock_client,
    )

    event = AuditEvent(
        workflow_id="wf_test_123",
        event_type=AuditEventType.STATE_TRANSITION,
        from_state="start",
        to_state="end",
        confidence=0.88,
        details={"step": 1},
    )

    repo.append_audit(event)
    call_args = mock_client.put_item.call_args[1]
    assert call_args["TableName"] == "test-audit"
    assert call_args["Item"]["workflowId"]["S"] == "wf_test_123"

    # Test reading with backward-compatibility for "None" strings
    item_with_none_strings = {
        "workflowId": {"S": "wf_test_123"},
        "timestamp": {"S": "2026-09-18T12:00:00Z"},
        "event_id": {"S": "evt_123"},
        "event_type": {"S": "workflow_created"},
        "from_state": {"S": "None"},
        "to_state": {"S": "None"},
        "confidence": {"S": "None"},
        "details": {"M": {}},
    }
    mock_client.query.return_value = {"Items": [item_with_none_strings]}
    events = repo.list_audit("wf_test_123")
    assert len(events) == 1
    assert events[0].from_state is None
    assert events[0].to_state is None
    assert events[0].confidence is None
