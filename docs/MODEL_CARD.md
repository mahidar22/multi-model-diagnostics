# Model card — `synthetic-tabular-demo-v1`

## Summary

| Field | Value |
|---|---|
| Task | Synthetic cohort group classification demonstration |
| Model type | Fixed, transparent linear rule with sigmoid transform |
| Inputs | `marker_a`, `marker_b`, `marker_c` (arbitrary synthetic values only) |
| Labels | `Group A`, `Group B` (no clinical meaning) |
| Training | No clinical training data; no training step in this project |
| Calibration | None; scores are illustrative, not clinical probabilities |
| Intended users | Developers evaluating the local software workflow |
| Intended use | Demonstrate upload, validation, provenance, output, and UI behavior |

## Rule

For validated feature values, the positive-class logit is `-0.1 + 0.28*marker_a - 0.24*marker_b + 0.18*marker_c`. A sigmoid maps this to a synthetic score. `Group B` is selected at score ≥ 0.5; otherwise `Group A`. The scores are not calibrated and must not be interpreted as likelihoods or risk.

The exact feature list, ranges, weights, labels, preprocessing version, threshold, and intended-use note are stored in `ml/manifests/synthetic-tabular-demo-v1.json`.

## Explainability

The UI reports each fixed weight-times-value contribution to the `Group B` logit. This is a property of the demonstration formula. It is **not** SHAP, Grad-CAM, a causal explanation, evidence of feature relevance, or a medical explanation.

## Evaluation

`data/synthetic_demo_evaluation.csv` is an intentionally small, fabricated software fixture; one synthetic label is deliberately inconsistent with the fixed rule so error metrics are exercised. The API and `scripts/evaluate.py` compute a confusion matrix, per-class precision/recall/F1, and macro-F1 on that file. The metrics only verify code paths; they do not estimate real-world performance, generalization, subgroup fairness, robustness, or clinical utility.

## Risks and limitations

- No patient data, clinical labels, learned model, external validation, or clinical performance claim is included.
- Input ranges are arbitrary and do not correspond to measurement units.
- One structured modality is configured; image, signal and text inputs are not handled.
- The output must not be used for diagnosis, triage, prognosis, treatment selection, prescriptions, or patient communication.
- The prototype is not a medical device and is not evidence of regulatory compliance.

## Change control before real research

Select a permitted dataset/task, data dictionary, patient-level split, leakage controls, versioned preprocessing, label mapping, model weights/checksum, validation plan, missing-modality policy, qualified review, and institution-approved deployment and privacy controls. Replace this model card rather than reusing its synthetic metrics.
