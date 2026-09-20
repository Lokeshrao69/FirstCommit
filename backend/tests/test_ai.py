"""Tests for the AI providers, knowledge templates, the deterministic rules
engine, and the advisory validation handler."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pytest

from app.ai.mock_llm_provider import MockLLMProvider
from app.core.config import Settings
from app.documents.mock_processor import MockDocumentProcessor
from app.models.document import CrossValidationResult, DocumentRecord, ExtractedField
from app.models.enums import ValidationStatus
from app.rules.engine import validate_application
from app.services.catalog import ServiceCatalog
from app.services.eligibility import check_eligibility
from app.services.workflow_service import _validation_handler
from app.workflow.schema_validator import validate
from app.workflow.state_machine import ExecutionContext

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "knowledge"
SERVICES_DIR = KNOWLEDGE_DIR / "services"


@pytest.fixture
def catalog() -> ServiceCatalog:
    return ServiceCatalog(KNOWLEDGE_DIR / "document_types.json", SERVICES_DIR)


@pytest.fixture
def provider() -> MockLLMProvider:
    return MockLLMProvider()


def catalog_for(service_id: str) -> tuple[dict, dict]:
    catalog = ServiceCatalog(KNOWLEDGE_DIR / "document_types.json", SERVICES_DIR)
    return catalog.get_service(service_id), catalog.doc_types()


def make_doc(classification: str, **fields) -> DocumentRecord:
    return DocumentRecord(
        workflow_id="wf_test",
        document_id=f"doc_{classification}",
        filename=f"{classification}.pdf",
        mime_type="application/pdf",
        classification=classification,
        extracted_fields={
            k: ExtractedField(value=v, confidence=0.95, source_text=f"{k}: {v}") for k, v in fields.items()
        },
    )


# ---------------------------------------------------------------- templates


def test_every_service_template_is_schema_valid(catalog):
    for service in catalog.services():
        tmpl = service["workflow"]
        from app.models.enums import StateType, WorkflowStatus
        from app.models.workflow import State, Transition, Workflow

        states = [
            State(
                id=s["id"],
                label=s["label"],
                type=StateType(s["type"]),
                description=s.get("description", ""),
                required_documents=list(s.get("required_documents", [])),
                transitions=[Transition(target=t["target"], condition=t["condition"]) for t in s.get("transitions", [])],
            )
            for s in tmpl["states"]
        ]
        workflow = Workflow(
            workflow_id="wf_x",
            goal=service["name"],
            initial_state=tmpl["initial_state"],
            terminal_states=tmpl["terminal_states"],
            states=states,
            status=WorkflowStatus.IN_PROGRESS,
        )
        report = validate(workflow)
        assert report.valid, (service["id"], report.errors)


def test_default_service_is_the_flagship_demo(catalog):
    svc = catalog.default_service()
    assert svc["id"] == "post_matric_scholarship"


def test_service_match_uses_keywords(catalog):
    assert catalog.match("I want to apply for the post matric scholarship").get("id") == "post_matric_scholarship"
    assert catalog.match("old age pension for my father").get("id") == "old_age_pension"
    assert catalog.match("apply for an income certificate").get("id") == "income_certificate"
    assert catalog.match("completely unrelated gibberish").get("id") == "post_matric_scholarship"


# ---------------------------------------------------------------- classifier


def test_mock_classifier_aadhaar(provider):
    text = MockDocumentProcessor().extract_text(b"", "aadhaar.pdf", "application/pdf")
    res = provider.classify_document(text)
    assert res.classification == "aadhaar"
    assert res.confidence > 0.8


def test_mock_classifier_income_certificate(provider):
    text = MockDocumentProcessor().extract_text(b"", "income_certificate_valid.pdf", "application/pdf")
    assert provider.classify_document(text).classification == "income_certificate"


def test_mock_classifier_ration_card(provider):
    text = MockDocumentProcessor().extract_text(b"", "ration_card.pdf", "application/pdf")
    assert provider.classify_document(text).classification == "ration_card"


# ---------------------------------------------------------------- extraction


def test_aadhaar_extraction(provider):
    text = MockDocumentProcessor().extract_text(b"", "aadhaar.pdf", "application/pdf")
    fields = provider.extract_fields(text, "aadhaar")
    assert fields["full_name"].value == "S. Priya"
    assert fields["aadhaar_number"].value == "2345 6789 0123"
    assert fields["date_of_birth"].value == "18-06-2005"


def test_income_certificate_extraction(provider):
    text = MockDocumentProcessor().extract_text(b"", "income_certificate_valid.pdf", "application/pdf")
    fields = provider.extract_fields(text, "income_certificate")
    assert fields["full_name"].value == "S. Priya"
    assert fields["annual_family_income"].value == "Rs. 1,80,000"
    assert fields["valid_until"].value == "31-03-2027"


def test_income_certificate_expired_variant(provider):
    text = MockDocumentProcessor().extract_text(b"", "income_certificate_expired.pdf", "application/pdf")
    fields = provider.extract_fields(text, "income_certificate")
    assert fields["valid_until"].value == "31-12-2025"


def test_marks_memo_extraction(provider):
    text = MockDocumentProcessor().extract_text(b"", "marks_memo.pdf", "application/pdf")
    fields = provider.extract_fields(text, "marks_memo")
    assert fields["full_name"].value == "S. Priya"
    assert fields["percentage"].value.startswith("82%")


def test_marks_memo_missing_percentage_variant_omits_field(provider):
    text = MockDocumentProcessor().extract_text(b"", "marks_memo_no_percentage.pdf", "application/pdf")
    fields = provider.extract_fields(text, "marks_memo")
    assert "percentage" not in fields


def test_self_declaration_extraction(provider):
    text = MockDocumentProcessor().extract_text(b"", "income_self_declaration.pdf", "application/pdf")
    fields = provider.extract_fields(text, "income_self_declaration")
    assert fields["full_name"].value == "S. Priya"
    assert fields["declaration_date"].value == "15-08-2026"


# ---------------------------------------------------- deterministic rules engine


def test_engine_blocks_when_required_document_missing():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester", percentage="82"),
        "income_certificate": make_doc(
            "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-03-2027"
        ),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "bonafide_certificate" for i in result.issues)


def test_engine_blocks_when_income_certificate_expired():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester", percentage="82"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="S. Priya", institution="Uni", course="BSc", issued_date="10-07-2026"),
"income_certificate": make_doc(
            "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-12-2025"
        ),
        "bank_passbook": make_doc("bank_passbook", full_name="S. Priya", account_number="9988776655443322", ifsc_code="FICB0001234"),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "valid_until" for i in result.issues)


def test_engine_blocks_when_income_exceeds_ceiling():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester", percentage="82"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="S. Priya", institution="Uni", course="BSc", issued_date="10-07-2026"),
        "income_certificate": make_doc(
            "income_certificate", full_name="S. Priya", annual_family_income="Rs. 3,20,000", valid_until="31-03-2027"
        ),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "annual_family_income" for i in result.issues)


def test_engine_blocks_when_field_unreadable():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="S. Priya", institution="Uni", course="BSc", issued_date="10-07-2026"),
        "income_certificate": make_doc(
            "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-03-2027"
        ),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "percentage" for i in result.issues)


def test_engine_passes_clean_application():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester", percentage="82"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="S. Priya", institution="Uni", course="BSc", issued_date="10-07-2026"),
        "income_certificate": make_doc(
            "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-03-2027"
        ),
        "bank_passbook": make_doc("bank_passbook", full_name="S. Priya", account_number="9988776655443322", ifsc_code="FICB0001234"),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.PASS


def test_engine_blocks_on_unrelated_name_mismatch():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester", percentage="82"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="S. Priya", institution="Uni", course="BSc", issued_date="10-07-2026"),
        "income_certificate": make_doc(
            "income_certificate", full_name="Sita Raju", annual_family_income="Rs. 1,50,000", valid_until="31-03-2027"
        ),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "full_name" and i.severity.value == "error" for i in result.issues)


def test_engine_warns_on_close_spelling_name_mismatch():
    service, doc_types = catalog_for("post_matric_scholarship")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="Alex Rivera", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="Alexander Rivera", examination="VI Semester", percentage="82"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="Alexander Rivera", institution="Uni", course="BSc", issued_date="10-07-2026"),
        "income_certificate": make_doc(
            "income_certificate", full_name="Alexander Rivera", annual_family_income="Rs. 1,80,000", valid_until="31-03-2027"
        ),
        "bank_passbook": make_doc("bank_passbook", full_name="Alexander Rivera", account_number="9988776655443322", ifsc_code="FICB0001234"),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.NEEDS_REVIEW
    assert any(i.field == "full_name" and i.severity.value == "warning" for i in result.issues)


def test_engine_blocks_pension_applicant_below_age_floor():
    service, doc_types = catalog_for("old_age_pension")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="K. Subba Rao", aadhaar_number="456789012345", date_of_birth="15-04-1998"),
        "ration_card": make_doc("ration_card", ration_card_number="RC-1", household_head_name="K. Subba Rao", category="BPL"),
        "bank_passbook": make_doc("bank_passbook", full_name="K. Subba Rao", account_number="1042568877914560", ifsc_code="FICB0001234"),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "date_of_birth" for i in result.issues)


def test_engine_blocks_pension_applicant_wrong_category():
    service, doc_types = catalog_for("old_age_pension")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="K. Subba Rao", aadhaar_number="456789012345", date_of_birth="15-04-1958"),
        "ration_card": make_doc("ration_card", ration_card_number="RC-1", household_head_name="K. Subba Rao", category="APL"),
        "bank_passbook": make_doc("bank_passbook", full_name="K. Subba Rao", account_number="1042568877914560", ifsc_code="FICB0001234"),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.BLOCK
    assert any(i.field == "category" for i in result.issues)


def test_engine_passes_pension_applicant():
    service, doc_types = catalog_for("old_age_pension")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="K. Subba Rao", aadhaar_number="456789012345", date_of_birth="15-04-1958"),
        "ration_card": make_doc("ration_card", ration_card_number="RC-1", household_head_name="K. Subba Rao", category="BPL"),
        "bank_passbook": make_doc("bank_passbook", full_name="K. Subba Rao", account_number="1042568877914560", ifsc_code="FICB0001234"),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.PASS


def test_engine_needs_review_for_stale_income_declaration():
    service, doc_types = catalog_for("income_certificate")
    stale = (date.today() - timedelta(days=120)).strftime("%d-%m-%Y")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "income_self_declaration": make_doc(
            "income_self_declaration", full_name="S. Priya", annual_family_income="Rs. 1,80,000", declaration_date=stale
        ),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.NEEDS_REVIEW
    assert any(i.field == "declaration_date" for i in result.issues)


def test_engine_passes_fresh_income_declaration():
    service, doc_types = catalog_for("income_certificate")
    fresh = date.today().strftime("%d-%m-%Y")
    collected = {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "income_self_declaration": make_doc(
            "income_self_declaration", full_name="S. Priya", annual_family_income="Rs. 1,80,000", declaration_date=fresh
        ),
    }
    result = validate_application(service, doc_types, collected)
    assert result.status == ValidationStatus.PASS


# ------------------------------------------------- advisory validation handler


def _handler(provider, settings, service_id: str):
    catalog = ServiceCatalog(KNOWLEDGE_DIR / "document_types.json", SERVICES_DIR)
    service = catalog.get_service(service_id)
    return _validation_handler(provider, settings, catalog, service)


def _clean_post_matric_docs() -> dict[str, DocumentRecord]:
    return {
        "aadhaar": make_doc("aadhaar", full_name="S. Priya", aadhaar_number="234567890123", date_of_birth="18-06-2005"),
        "marks_memo": make_doc("marks_memo", full_name="S. Priya", examination="VI Semester", percentage="82"),
        "bonafide_certificate": make_doc("bonafide_certificate", full_name="S. Priya", institution="Uni", course="BSc", issued_date="10-07-2026"),
        "income_certificate": make_doc(
            "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-03-2027"
        ),
        "bank_passbook": make_doc("bank_passbook", full_name="S. Priya", account_number="9988776655443322", ifsc_code="FICB0001234"),
    }


def test_handler_passes_clean_documents(provider):
    settings = Settings({"DEMO_MODE": "true"})
    step = _handler(provider, settings, "post_matric_scholarship")(
        _state(), ExecutionContext(collected_documents=_clean_post_matric_docs())
    )
    assert step.data["status"] == "pass"
    assert step.data["confidence"] >= 0.9


def test_handler_blocks_on_hard_rule(provider):
    settings = Settings({"DEMO_MODE": "true"})
    docs = _clean_post_matric_docs()
    docs["income_certificate"] = make_doc(
        "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-12-2025"
    )
    step = _handler(provider, settings, "post_matric_scholarship")(
        _state(), ExecutionContext(collected_documents=docs)
    )
    assert step.data["status"] == "block"


def test_advisory_confidence_downgrades_pass_to_review(provider):
    low = CrossValidationResult(status=ValidationStatus.PASS, confidence=0.4)

    class Low(provider.__class__):
        def run_cross_validation(self, requirements, extracted):
            return low

    settings = Settings({"DEMO_MODE": "true"})
    step = _handler(Low(), settings, "post_matric_scholarship")(
        _state(), ExecutionContext(collected_documents=_clean_post_matric_docs())
    )
    assert step.data["status"] == "needs_review"


def test_advisory_cannot_unblock_a_deterministic_block(provider):
    low = CrossValidationResult(status=ValidationStatus.PASS, confidence=0.4)

    class Low(provider.__class__):
        def run_cross_validation(self, requirements, extracted):
            return low

    settings = Settings({"DEMO_MODE": "true"})
    docs = _clean_post_matric_docs()
    docs["income_certificate"] = make_doc(
        "income_certificate", full_name="S. Priya", annual_family_income="Rs. 1,80,000", valid_until="31-12-2025"
    )
    step = _handler(Low(), settings, "post_matric_scholarship")(
        _state(), ExecutionContext(collected_documents=docs)
    )
    assert step.data["status"] == "block"


def _state():
    from app.models.workflow import State

    return State(id="document_validation", label="Check documents", type="validation")


# ------------------------------------------------------------- legacy utility


def test_eligibility_is_deterministic():
    reqs = {
        "cumulative_gpa": {"operator": "gte", "value": 3.0},
        "current_semester_gpa": {"operator": "gte", "value": 3.0},
        "enrollment_status": {"operator": "eq", "value": "full-time"},
        "expected_graduation": {"operator": "gte", "value": 2025},
    }
    ok, _ = check_eligibility(
        {"cumulative_gpa": 3.72, "current_semester_gpa": 3.7, "enrollment_status": "full-time", "expected_graduation": 2027},
        reqs,
    )
    assert ok
    bad, _ = check_eligibility(
        {"cumulative_gpa": 2.8, "current_semester_gpa": 3.7, "enrollment_status": "full-time", "expected_graduation": 2027},
        reqs,
    )
    assert not bad
