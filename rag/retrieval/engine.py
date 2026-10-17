from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_TOKEN_RE = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)


def _tokens(text: str) -> set[str]:
    return {token.lower() for token in _TOKEN_RE.findall(text)}


def load_approved_sources(corpus_dir: Path) -> list[dict[str, Any]]:
    """Load only explicitly approved JSONL source records; ignore malformed records."""
    sources: list[dict[str, Any]] = []
    if not corpus_dir.is_dir():
        return sources
    for path in sorted(corpus_dir.glob("*.jsonl")):
        try:
            with path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(item, dict):
                        continue
                    if item.get("approved") is not True or item.get("license_status") != "approved":
                        continue
                    required = ("id", "title", "content")
                    if not all(isinstance(item.get(key), str) and item[key].strip() for key in required):
                        continue
                    sources.append(item)
        except OSError:
            continue
    # Stable de-duplication avoids accidental duplicate citations across files.
    by_id: dict[str, dict[str, Any]] = {}
    for item in sources:
        by_id.setdefault(item["id"], item)
    return list(by_id.values())


def retrieve(question: str, corpus_dir: Path, top_k: int = 3) -> list[dict[str, Any]]:
    query_tokens = _tokens(question)
    if not query_tokens:
        return []
    ranked: list[tuple[float, dict[str, Any]]] = []
    for source in load_approved_sources(corpus_dir):
        content_tokens = _tokens(source["content"])
        overlap = query_tokens & content_tokens
        if not overlap:
            continue
        # Transparent lexical baseline; not semantic search or a clinical evidence grade.
        score = len(overlap) / max(1, len(query_tokens))
        ranked.append((score, source))
    ranked.sort(key=lambda pair: (-pair[0], pair[1]["id"]))
    matches = []
    for score, source in ranked[:top_k]:
        excerpt = " ".join(source["content"].split())[:700]
        matches.append({
            "source_id": source["id"],
            "title": source["title"],
            "url": source.get("url"),
            "identifier": source.get("identifier"),
            "date": source.get("date"),
            "license_status": source["license_status"],
            "retrieval_score": round(score, 4),
            "excerpt": excerpt,
        })
    return matches
