from __future__ import annotations

import re
from typing import Any

from rag.retrieval.engine import retrieve

_CLINICAL_ADVICE_RE = re.compile(
    r"\b(diagnos(?:e|is|ing)|prescrib\w*|dosage|dose|treat\w*|therapy|triage|emergency|medical advice|what should .* take)\b",
    re.IGNORECASE,
)


def build_research_report(question: str, corpus_dir, enabled: bool) -> dict[str, Any]:
    if not enabled:
        return {
            "status": "DISABLED",
            "text": "Evidence retrieval is disabled. Enable it only after reviewing the source corpus and its usage permissions.",
            "citations": [],
            "generator": "none",
            "retrieval_version": "lexical-overlap-v1",
            "warnings": ["No language model is configured; no generated medical advice is provided."],
        }

    if _CLINICAL_ADVICE_RE.search(question):
        return {
            "status": "ABSTAINED",
            "text": "This research prototype does not answer diagnosis, treatment, prescription, dosage, or emergency-triage questions.",
            "citations": [],
            "generator": "none",
            "retrieval_version": "lexical-overlap-v1",
            "warnings": ["Clinical advice requests are outside the prototype's scope."],
        }

    passages = retrieve(question, corpus_dir)
    if not passages or passages[0]["retrieval_score"] < 0.15:
        return {
            "status": "ABSTAINED",
            "text": "Evidence was insufficient: no sufficiently relevant, approved source passage was retrieved.",
            "citations": [],
            "generator": "none",
            "retrieval_version": "lexical-overlap-v1",
            "warnings": ["No claims or citations were generated without retrieved evidence."],
        }

    # A retrieval-backed excerpt list is deliberately used instead of free-form
    # model generation so every displayed passage is directly traceable.
    citation_ids = {item["source_id"] for item in passages}
    text = "Research context only — retrieved excerpts, not clinical recommendations.\n\n"
    text += "\n\n".join(f"[{item['source_id']}] {item['excerpt']}" for item in passages)
    citations = [
        {key: item.get(key) for key in ("source_id", "title", "url", "identifier", "date", "license_status")}
        for item in passages if item["source_id"] in citation_ids
    ]
    return {
        "status": "SUCCEEDED",
        "text": text,
        "citations": citations,
        "generator": "retrieval-only-no-llm",
        "retrieval_version": "lexical-overlap-v1",
        "warnings": [
            "Retrieved content is untrusted reference material and may be incomplete or incorrect.",
            "No diagnosis, treatment plan, prescription, dosage, or triage recommendation is produced.",
        ],
    }
