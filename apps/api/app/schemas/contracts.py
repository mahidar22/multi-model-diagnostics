from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CaseCreate(StrictModel):
    pseudonymous_reference: str | None = Field(
        default=None,
        min_length=3,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$",
        description="A non-identifying reference; do not enter a person's name or other direct identifier.",
    )


class ArtifactValidationRequest(StrictModel):
    artifact_id: str = Field(min_length=8, max_length=64)


class RunCreate(StrictModel):
    artifact_id: str = Field(min_length=8, max_length=64)
    model_version: str = Field(default="synthetic-tabular-demo-v1", min_length=1, max_length=100)
    requested_outputs: list[Literal["prediction", "explanation"]] = Field(
        default_factory=lambda: ["prediction", "explanation"],
        max_length=2,
    )


class ReportCreate(StrictModel):
    question: str = Field(min_length=4, max_length=500)


class FeatureValue(StrictModel):
    name: str
    value: float


class ClassScore(StrictModel):
    label: str
    score: float


class EvaluationResult(StrictModel):
    labels: list[str]
    confusion_matrix: list[list[int]]
    per_class: list[dict[str, float | int | str]]
    macro_f1: float
    sample_count: int
    fixture: bool
    warnings: list[str]
