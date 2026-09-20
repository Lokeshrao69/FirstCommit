"""Deterministic cross-document validation engine.

This engine owns the *hard* pass/review/block decision for an application. The AI
provider is an advisory layer on top: it can add warnings (prompting a review) but
can never turn a blocked application into a passing one, and never invents
evidence. All values used here were extracted from the documents themselves.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from ..models.document import CrossValidationResult, ExtractedField, ValidationIssue
from ..models.enums import ValidationSeverity, ValidationStatus
from .amounts import inr_grouped, parse_inr
from .dates import age_from, days_between, is_expired, parse_date
from .names import names_match, similarity, unrelated_names

_ERROR = ValidationSeverity.ERROR
_WARNING = ValidationSeverity.WARNING


def _fields_of(doc: Any) -> dict[str, ExtractedField]:
    if isinstance(doc, dict):
        return dict(doc.get("extracted_fields") or {})
    return dict(getattr(doc, "extracted_fields", None) or {})


def _value_of(field: Any) -> Any:
    return field.value if isinstance(field, ExtractedField) else field


def _evidence_of(field: Any) -> list[str]:
    if isinstance(field, ExtractedField) and field.source_text:
        return [field.source_text]
    return [str(field)] if field is not None else []


def _fill(template: str, **kwargs: Any) -> str:
    out = template
    for key, value in kwargs.items():
        out = out.replace("{" + key + "}", str(value))
    return out


def _issue(
    severity: ValidationSeverity,
    field: str,
    message: str,
    evidence: list[str] | None = None,
    suggestion: str | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        severity=severity, field=field, message=message,
        evidence=evidence or [], suggestion=suggestion,
    )


def validate_application(
    service: dict[str, Any],
    doc_types: dict[str, dict[str, Any]],
    collected: dict[str, Any],
    today: date | None = None,
) -> CrossValidationResult:
    """Validate a complete application bundle against a service definition.

    `collected`: mapping of classification -> DocumentRecord-like object exposing
    `.classification` and `.extracted_fields` (dict of str -> ExtractedField); plain
    dicts with those keys are accepted too.
    """
    issues: list[ValidationIssue] = []
    process = service.get("process", {})
    required_docs = list(process.get("required_documents", []))
    requirements = list(process.get("requirements", []))
    base = today or date.today()

    # ---- 1. required documents are present ----
    for doc_id in required_docs:
        if doc_id not in collected:
            label = (doc_types.get(doc_id) or {}).get("name") or doc_id
            issues.append(
                _issue(
                    _ERROR, doc_id,
                    f"Missing required document: {label}.",
                    suggestion=f"Upload the {label}.",
                )
            )

    # ---- 2. required fields are present in each document ----
    for cls, doc in collected.items():
        type_def = doc_types.get(cls)
        if not type_def:
            continue
        fields = _fields_of(doc)
        for req_field in type_def.get("required_fields", []):
            if req_field in fields:
                continue
            labels = {f["key"]: f["label"] for f in type_def.get("fields", [])}
            field_label = labels.get(req_field, req_field)
            type_name = type_def.get("name", cls)
            issues.append(
                _issue(
                    _ERROR, req_field,
                    f"We could not read the {field_label} from the {type_name}.",
                    suggestion=f"Upload a clear copy of the {type_name} that shows the {field_label}.",
                )
            )

    # ---- 3. deterministic scheme requirements ----
    for rule in requirements:
        kind = rule.get("kind")
        doc = collected.get(rule.get("document"))
        if doc is None:
            continue  # missing-document error already reported
        fields = _fields_of(doc)
        field = fields.get(rule.get("field"))
        if kind in {"max_amount", "min_amount"}:
            value = parse_inr(_value_of(field)) if field is not None else None
            wanted = float(rule.get("value"))
            amount_text = inr_grouped(wanted) if wanted == int(wanted) else f"{wanted:,.2f}"
            fails = value is None or (
                value > wanted if kind == "max_amount" else value < wanted
            )
            if field is None:
                fails = True
            if field is not None and value is None:
                issues.append(
                    _issue(
                        _WARNING, rule.get("field"),
                        _fill(rule.get("message", ""), value="an unreadable amount"),
                        _evidence_of(field), rule.get("suggestion"),
                    )
                )
                continue
            if fails:
                shown = inr_grouped(value) if value is not None else "unknown"
                issues.append(
                    _issue(
                        _ERROR, rule.get("field"),
                        _fill(rule.get("message", ""), value=shown, required=amount_text),
                        _evidence_of(field), rule.get("suggestion"),
                    )
                )
        elif kind == "eq":
            actual = _value_of(field) if field is not None else None
            wanted = rule.get("value")
            mismatch = actual is None or str(actual).strip().lower() != str(wanted).strip().lower()
            if mismatch:
                issues.append(
                    _issue(
                        _ERROR, rule.get("field"),
                        _fill(rule.get("message", ""), value=actual or "missing"),
                        _evidence_of(field), rule.get("suggestion"),
                    )
                )
        elif kind == "not_expired":
            expired = is_expired(_value_of(field) if field is not None else None, base)
            if expired is True:
                issues.append(
                    _issue(
                        _ERROR, rule.get("field"),
                        _fill(rule.get("message", "")),
                        _evidence_of(field), rule.get("suggestion"),
                    )
                )
            elif expired is None and field is not None:
                issues.append(
                    _issue(
                        _WARNING, rule.get("field"),
                        "We could not read the document's expiry date.",
                        _evidence_of(field),
                    )
                )
        elif kind == "min_age":
            age = age_from(_value_of(field) if field is not None else None, base)
            if age is None:
                if field is not None:
                    issues.append(
                        _issue(
                            _WARNING, rule.get("field"),
                            _fill(rule.get("message", ""), age="an unreadable age"),
                            _evidence_of(field), rule.get("suggestion"),
                        )
                    )
            elif age < int(rule.get("value")):
                issues.append(
                    _issue(
                        _ERROR, rule.get("field"),
                        _fill(rule.get("message", ""), age=age),
                        _evidence_of(field), rule.get("suggestion"),
                    )
                )
        elif kind == "within_days":
            needs_recent = field is not None
            if needs_recent:
                span = days_between(_value_of(field), base)
                if span is None:
                    issues.append(
                        _issue(
                            _WARNING, rule.get("field"),
                            "We could not read the declaration date.",
                            _evidence_of(field),
                        )
                    )
                elif span > int(rule.get("days")):
                    issues.append(
                        _issue(
                            _WARNING, rule.get("field"),
                            _fill(rule.get("message", ""), days=span),
                            _evidence_of(field), rule.get("suggestion"),
                        )
                    )

    # ---- 4. name consistency across documents ----
    anchors = ["aadhaar", "income_certificate", "income_self_declaration", "bonafide_certificate"]
    name_holders: dict[str, tuple[str, ExtractedField]] = {}
    for cls, doc in collected.items():
        fields = _fields_of(doc)
        for name_field in ("full_name", "household_head_name"):
            if fields.get(name_field) is not None:
                name_holders[cls] = (name_field, fields[name_field])
                break
    if len(name_holders) >= 2:
        anchor_cls = next((c for c in anchors if c in name_holders), None) or max(
            name_holders, key=lambda c: len(str(_value_of(name_holders[c][1])))
        )
        anchor_field, anchor = name_holders[anchor_cls]
        anchor_type = (doc_types.get(anchor_cls) or {}).get("name", anchor_cls)
        for cls, (field_name, candidate) in name_holders.items():
            if cls == anchor_cls:
                continue
            if names_match(_value_of(candidate), _value_of(anchor)):
                continue
            doc_type = (doc_types.get(cls) or {}).get("name", cls)
            if unrelated_names(_value_of(candidate), _value_of(anchor)):
                issues.append(
                    _issue(
                        _ERROR, field_name,
                        (
                            f"The name on the {doc_type} does not match the name on the "
                            f"{anchor_type}. These documents appear to belong to different people."
                        ),
                        [*_evidence_of(candidate), *_evidence_of(anchor)],
                        "Check that every document belongs to the same applicant.",
                    )
                )
            else:
                sim = similarity(_value_of(candidate), _value_of(anchor))
                issues.append(
                    _issue(
                        _WARNING, field_name,
                        (
                            f"The name on the {doc_type} ('{_value_of(candidate)}') differs from the "
                            f"name on the {anchor_type} ('{_value_of(anchor)}')."
                            + (f" The spelling is close ({sim:.0%} similar) — please verify." if sim >= 0.6 else "")
                        ),
                        [*_evidence_of(candidate), *_evidence_of(anchor)],
                        "Name written as an initial, reordered or misspelled — confirm it refers to the same person.",
                    )
                )

    # ---- 5. overall status ----
    if any(i.severity == _ERROR for i in issues):
        status = ValidationStatus.BLOCK
        confidence = 0.5
    elif any(i.severity == _WARNING for i in issues):
        status = ValidationStatus.NEEDS_REVIEW
        confidence = 0.72
    else:
        status = ValidationStatus.PASS
        confidence = 0.92

    return CrossValidationResult(
        status=status,
        confidence=confidence,
        issues=issues,
        suggestions=[i.suggestion for i in issues if i.suggestion],
        checked_documents=sorted(collected),
    )