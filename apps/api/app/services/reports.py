from rag.generation.report import build_research_report
from apps.api.app.core.config import settings


def create_report(question: str) -> dict:
    return build_research_report(question, settings.rag_root, settings.rag_enabled)
