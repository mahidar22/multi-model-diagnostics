# Research Multimodal Decision-Support Prototype

A complete local-first software prototype built against the supplied SRS. It demonstrates one end-to-end research workflow: pseudonymous case creation → private CSV upload → schema/range validation → synchronous inference → transparent explanation → export or deletion.

> **Safety boundary:** research/software demonstration only. It is not a medical device, diagnostic tool, risk calculator, treatment aid, or clinical decision-support system. The included model rule and evaluation rows are synthetic examples. Do not use them to make decisions about a person.

## Scope chosen for this runnable first milestone

The SRS leaves the first dataset, task, and modalities open. No dataset was attached, so this project makes a deliberately narrow, replaceable assumption:

- **One task:** synthetic cohort group classification (`synthetic-tabular-demo`).
- **One modality:** structured CSV with one row and three arbitrary synthetic values: `marker_a`, `marker_b`, `marker_c`.
- **Labels:** `Group A` and `Group B`; they have no clinical meaning.
- **Model:** a fixed, transparent linear demonstration rule—not trained clinical weights. Scores are explicitly uncalibrated.
- **RAG:** disabled by default, no sources or LLM bundled. If enabled, the prototype retrieves approved local excerpts only and abstains when evidence is weak; it does not generate medical advice.
- **Deployment:** one local FastAPI process, one Vite frontend, private filesystem storage and JSON metadata. No database, Docker, queue, automated testing framework, or clinical dataset is included, following the SRS's requested exclusions.

Use the included CSVs to verify the workflow. Before adapting this to real research, confirm the dataset, label mapping, task, permitted use, feature schema/ranges, split plan, and institution's security requirements.

## Features

- Bearer-token authentication and per-case owner checks on case, artifact, run, report, export, and delete operations.
- Random IDs, pseudonymous references, private file storage outside the web root, upload byte limit, checksum, strict CSV schema, finite-number and range checks.
- Synchronous, versioned task/model manifest and reproducible preprocessing contract.
- Explicit modality status; modalities not configured for this task are labelled **not configured**, never represented as observed or imputed.
- Scores, score meaning, model version, warnings, processing time, checksums and provenance in each run.
- A supported linear-contribution visualization; the UI explains that contributions are not causal explanations or SHAP.
- Optional evidence excerpt retrieval with citation metadata, approval checks, a clinical-advice guard, and abstention. Disabled unless explicitly configured.
- Controlled ZIP export; case deletion removes the original artifact and derived run files. Minimal audit events contain actor/action/object/time/outcome/request ID, not input contents.
- Offline evaluation script and UI metrics for a clearly marked synthetic fixture: confusion matrix, class precision/recall/F1 and macro-F1.

## Requirements

- Python 3.11+
- Node.js 20.19+ or 22.12+
- npm

## Quick start

From the project root:

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1

python -m pip install -e .
cp .env.example .env                 # PowerShell: Copy-Item .env.example .env
cd apps/web
npm install
cd ../..
```

Start the API and web UI in **two terminals** from the project root:

```bash
# Terminal 1
.venv/bin/python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000

# Terminal 2
cd apps/web && npm run dev -- --host 0.0.0.0
```

On Windows, use `.venv\\Scripts\\python.exe` for the API command. The browser opens the Vite URL printed in the terminal (normally `http://localhost:5173`). Vite proxies `/api` to the local FastAPI service. API documentation is at `http://localhost:8000/docs`.

For a POSIX convenience launcher, `scripts/run_local.sh` starts both processes. The Windows notes are in `scripts/run_local.ps1`.

### Local demo login

The example `.env` maps actor `demo-researcher` to token `local-research-demo-token`. Enter that token on the sign-in screen. This is a public, development-only example credential. Change it in `.env` before sharing the app or exposing it beyond the local machine. The UI keeps the token in session storage only.

To configure more actors, set `RESEARCH_USERS_JSON` to a JSON object mapping actor IDs to distinct random bearer tokens, for example:

```dotenv
RESEARCH_USERS_JSON='{"researcher-a":"replace-with-a-long-random-token","researcher-b":"another-long-random-token"}'
```

The built-in token mechanism is an authorization hook for a local prototype—not an identity provider. Use institutional SSO, managed secrets, TLS, rate limits, encrypted storage, backup controls and a security review before any shared/hosted deployment.

## Demo workflow

1. Sign in with the configured local token.
2. Create a case using a **pseudonymous** reference such as `CASE-001`; never use a name, MRN, email, or other direct identifier.
3. Upload `data/sample_case.csv` (or download it from the case screen).
4. Validate the artifact, then run the synthetic demonstration model.
5. Review the prediction, uncalibrated scores, modality status, warnings and linear contributions.
6. Optionally export the case as a ZIP or delete it.
7. Open **Evaluation** to view metrics on the included synthetic fixture. These are software-demo metrics only—not clinical validation.

The CSV contract is exact: one header row with `marker_a,marker_b,marker_c`, followed by exactly one data row. Values must be finite numbers between -5 and 5. See `docs/DATA_DICTIONARY.md`.

## Offline evaluation

```bash
python scripts/evaluate.py
python scripts/evaluate.py path/to/an-already-separated-evaluation.csv
```

The CSV must contain exactly the manifest feature columns plus `label`. This fixed demonstration rule is not fitted from that file. For real research, create and document a patient-level fixed split, fit all preprocessing on training data only, record checksums and code/model versions, and report class-wise metrics and limitations.

## Configuration

See `.env.example` and `docs/RUNBOOK.md`.

| Setting | Default | Purpose |
|---|---|---|
| `RESEARCH_USERS_JSON` | local demo actor/token | Actor-to-token map |
| `DATA_DIR` | `.local-data` | Private local metadata/artifact store |
| `MAX_UPLOAD_BYTES` | `5242880` | Upload cap (5 MiB) |
| `MAX_ARTIFACTS_PER_CASE` | `5` | Local artifact count cap per case |
| `RETENTION_DAYS` | `30` | Documented local cleanup target; no automatic purge runs |
| `RAG_ENABLED` | `false` | Feature flag for approved-source excerpt retrieval |
| `RAG_CORPUS_DIR` | `rag/corpus/approved` | Directory of explicitly approved `.jsonl` sources |
| `ALLOWED_ORIGINS` | localhost Vite origins | CORS allowlist |

## Project map

```text
apps/api/app/       FastAPI routes, validation, orchestration, local storage
apps/web/           React + TypeScript + Vite browser UI
ml/manifests/       Versioned task/model/input contract
ml/inference.py     Transparent synthetic baseline inference
ml/evaluation/      Confusion matrix, per-class and macro-F1 metrics
rag/                Optional approved-source lexical retrieval; off by default
data/               Synthetic demo and fixed synthetic evaluation fixture
docs/               SRS source PDF, requirements, data dictionary, model card, API and runbook
scripts/            Local launch and offline evaluation helpers
```

## Important prototype limits

This is a modular-monolith **software prototype**, not a production security architecture. Filesystem JSON metadata is single-process and not safe for concurrent multi-worker deployment. Files are not encrypted at rest by this code. The default token is not secret. Retention is documented but not automatically enforced. No image, signal, or text encoders are implemented because the SRS says to confirm the paired dataset before adding modalities. No real clinical data, approved corpus, LLM, model weights, pretrained network, or medical claims are included.

Read `docs/SRS.md`, `docs/MODEL_CARD.md`, and `docs/RUNBOOK.md` before adapting or deploying.
