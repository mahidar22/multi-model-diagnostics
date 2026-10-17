from typing import Annotated

from fastapi import APIRouter, Depends

from apps.api.app.core.security import get_current_actor

router = APIRouter(prefix="/auth", tags=["authentication"])
Actor = Annotated[str, Depends(get_current_actor)]


@router.get("/session")
def read_session(actor_id: Actor):
    return {
        "actor_id": actor_id,
        "authenticated": True,
        "notice": "Local prototype token authentication; not a production identity provider.",
    }
