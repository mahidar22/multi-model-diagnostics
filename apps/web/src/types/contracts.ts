export type ArtifactIssue = { code: string; message: string }

export type ValidationResult = {
  valid: boolean
  status: 'VALID' | 'REJECTED' | 'PENDING' | string
  row_count?: number
  feature_count?: number
  issues: ArtifactIssue[]
}

export type Artifact = {
  id: string
  modality: string
  detected_type: string
  label: string
  sha256: string
  size_bytes: number
  schema_version: string
  validation_status: string
  validation_result?: ValidationResult | null
  created_at: string
  validated_at?: string
}

export type ResearchCase = {
  id: string
  task_id: string
  task_version: string
  owner_id: string
  pseudonymous_reference: string
  status: string
  created_at: string
  updated_at: string
  artifacts: Artifact[]
  run_ids: string[]
}

export type ClassScore = { label: string; score: number }

export type FeatureContribution = {
  feature: string
  label: string
  value: number
  contribution_to_positive_class_logit: number
}

export type Explanation = {
  method: string
  target_class: string
  positive_class: string
  positive_class_logit: number
  bias_contribution: number
  feature_contributions: FeatureContribution[]
  limitations: string
}

export type ResearchReport = {
  id?: string
  status: 'SUCCEEDED' | 'ABSTAINED' | 'DISABLED' | string
  text: string
  citations: Array<{
    source_id: string
    title: string
    url?: string | null
    identifier?: string | null
    date?: string | null
    license_status: string
  }>
  warnings: string[]
  generator: string
  retrieval_version: string
  created_at?: string
}

export type ResearchRun = {
  id: string
  case_id: string
  task_id: string
  model_version: string
  preprocessing_version: string
  status: string
  created_at: string
  completed_at: string
  processing_ms: number
  input_artifact_ids: string[]
  present_modalities: string[]
  unconfigured_modalities: string[]
  modality_status: Record<string, string>
  prediction: {
    label: string
    scores: ClassScore[]
    score_type: string
    model_version: string
    task_id: string
    decision_threshold: number
  }
  explanation?: Explanation | null
  reports: ResearchReport[]
  warnings: string[]
  provenance: Record<string, string | number | string[] | null>
}

export type EvaluationResult = {
  labels: string[]
  confusion_matrix: number[][]
  per_class: Array<{ label: string; precision: number; recall: number; f1: number; support: number }>
  macro_f1: number
  sample_count: number
  fixture: boolean
  warnings: string[]
}

export type TaskFeature = { name: string; label: string; type: string; minimum: number; maximum: number; unit: string }

export type Health = {
  status: string
  application: string
  version: string
  research_only: boolean
  task_id: string
  task_name: string
  task_version: string
  model_version: string
  configured_modality: string
  accepted_modalities: string[]
  preprocessing_version: string
  score_type: string
  class_labels: string[]
  features: TaskFeature[]
  max_upload_bytes: number
  max_artifacts_per_case: number
  rag_enabled: boolean
  retention_days: number
}
