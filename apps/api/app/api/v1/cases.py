from __future__ import annotations

import io
import json
import zipfile
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse

from apps.api.app.core.security import get_current_actor
from apps.api.app.schemas.contracts import CaseCreate
from apps.api.app.services.cases import create_case, get_case, list_cases
from apps.api.app.storage.local import store, utc_now

router = APIRouter(prefix="/cases", tags=["cases"])
Actor = Annotated[str, Depends(get_current_actor)]


@router.get("")
def list_user_cases(actor_id: Actor):
    records = list_cases(actor_id)
    return {"items": records, "count": len(records)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_research_case(payload: CaseCreate, request: Request, actor_id: Actor):
    return create_case(payload, actor_id, request.state.request_id)


@router.get("/{case_id}")
def read_case(case_id: str, actor_id: Actor):
    return get_case(case_id, actor_id)


@router.get("/{case_id}/export")
def export_case(case_id: str, request: Request, actor_id: Actor):
    case_record, related_files = store.export_case_files(case_id, actor_id)
    export_manifest = {
        "exported_at": utc_now(),
        "case_id": case_record["id"],
        "note": "Research-only export. Contains only this owner's case metadata, uploaded artifact(s), and run records.",
    }
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("case.json", json.dumps(case_record, indent=2, ensure_ascii=False))
        archive.writestr("export_manifest.json", json.dumps(export_manifest, indent=2, ensure_ascii=False))
        for name, content in related_files:
            archive.writestr(name, content)
    stream.seek(0)
    store.append_audit(actor_id, "case.export", case_id, "succeeded", request.state.request_id)
    return StreamingResponse(
        stream,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="research-case-{case_id[:8]}.zip"'},
    )


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(case_id: str, request: Request, actor_id: Actor):
    store.delete_case(case_id, actor_id, request.state.request_id)
    return None
