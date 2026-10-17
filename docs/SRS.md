# Simplified SRS baseline and implementation notes

## Purpose and boundary

Implement a small, local, research-only vertical slice from the supplied visual SRS. It demonstrates a configurable task manifest, case/artifact/run lifecycle, input validation, prediction and explanation display, offline metrics, optional evidence retrieval, provenance, export and deletion. No clinical use is in scope.

## Explicit first-release decisions

The supplied SRS leaves the dataset/task/modalities/hardware/deployment choices open and supplies no dataset. This project therefore uses synthetic tabular values only. It does not claim to satisfy a real clinical task. The following must be replaced/confirmed before applying this scaffold to a research cohort:

| Decision | Prototype assumption |
|---|---|
| Dataset and prediction task | Synthetic cohort group demo; labels have no medical meaning |
| Modality | Structured CSV only |
| Input schema | Three arbitrary floats; one row per pseudonymous case |
| Model | Fixed linear demonstration rule; not trained or calibrated |
| RAG corpus / LLM | None; RAG off by default; no LLM |
| Deployment | Local development, synchronous, single process |
| Storage | Local private directory; JSON metadata and raw artifact files |
| Retention | 30-day policy target documented; manual cleanup in this prototype |

## Requirement traceability

| SRS ID | Implementation |
|---|---|
| R-01 | Bearer token auth; owner checks before all case/run/artifact/report/export/delete reads or writes. The default token is demo-only. |
| R-02 | Pseudonymous case references; CSV-only configured task. |
| R-03 | Upload byte cap, UTF-8/text check, checksum, exact headers, single-row limit, finite values and manifest ranges before inference. |
| R-04 | Versioned manifest identifies the demo's `identity-v1` preprocessing. This prototype has no learned transforms. |
| R-05 | Run records/UI distinguish `structured: present` from other modalities `not_configured_for_task`. |
| R-06 | Class label, class scores, score meaning, model version, warnings, provenance and run status in run response. |
| R-07 | No Grad-CAM or SHAP is claimed. A task-specific linear contribution demonstration is supported and named accurately. |
| R-08 | Explanation limitations visible in run response and UI; no causal claims. |
| R-09 | Optional approved-local-source retrieval, source metadata citations, citation set derived only from retrieved passages, clinical-advice guard and abstention. Disabled by default; no corpus is bundled. |
| R-10 | Provenance in run JSON and minimal append-only audit events; no raw content or filename in audit events. |
| R-11 | Owner-controlled ZIP export and deletion of case directory, source file and derived run artifacts; retention/backup policy documented. |
| R-12 | Offline evaluation with confusion matrix, per-class precision/recall/F1 and macro-F1; only a synthetic fixture is included. |

## Architecture and non-goals

React + TypeScript + Vite communicates with FastAPI. The API validates and authorizes each operation, stores data under `.local-data/` (not exposed as static content), and calls a small independent manifest-driven model adapter synchronously. Optional retrieval is a separate feature-flagged module. No database, Docker, queue, automated test framework, image/signal/text encoder, real model weights, hosted LLM, production authentication, or clinical validation is included.

## Acceptance checks

Manual acceptance flow: create case → upload `data/sample_case.csv` → validate → run → review warnings and explanation → export → delete. Negative checks: wrong extension, invalid encoding, wrong columns, multiple rows, non-numeric/non-finite value, out-of-range value, request without a token, and cross-actor access using a second configured token. Verify audit JSONL does not contain file contents or feature values. API reference is available at `/docs` while the local API is running.
