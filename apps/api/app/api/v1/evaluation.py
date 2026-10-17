from typing import Annotated

from fastapi import APIRouter, Depends

from apps.api.app.core.security import get_current_actor
from apps.api.app.services.evaluation import evaluate_demo_fixture

router = APIRouter(prefix="/evaluation", tags=["evaluation"])
Actor = Annotated[str, Depends(get_current_actor)]


@router.get("/demo")
def demo_evaluation(_actor_id: Actor):
    return evaluate_demo_fixture()
