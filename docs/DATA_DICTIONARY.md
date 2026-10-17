# Data dictionary — synthetic tabular demo

This schema exists only to exercise the upload-to-inference workflow. It is **not a clinical data dictionary**, has no real units, and must not be mapped to patient measurements.

| Column | Type | Required | Range | Unit | Meaning |
|---|---|---:|---:|---|---|
| `marker_a` | float | yes | -5 to 5 inclusive | arbitrary | Synthetic marker A |
| `marker_b` | float | yes | -5 to 5 inclusive | arbitrary | Synthetic marker B |
| `marker_c` | float | yes | -5 to 5 inclusive | arbitrary | Synthetic marker C |

Each case accepts exactly one UTF-8 CSV data row with exactly these three columns (column order may vary). Values must be numeric and finite. Empty cells, duplicate/missing/extra headers, additional rows, NaN/Inf, corrupt content and values outside the configured range are rejected.

The case reference is metadata, not a CSV column. Use a pseudonymous reference only; do not enter names, dates of birth, medical record numbers, contact information, or other direct identifiers. The server cannot reliably detect all personal or sensitive content, so approved de-identification remains the user's responsibility.

Evaluation data use the same three synthetic features plus `label` (`Group A` or `Group B`). The included evaluation CSV is a toy fixture, not an external or patient-level validation set.
