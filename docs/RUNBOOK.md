# Local runbook and data-handling policy

## Start and stop

See the Quick start in `README.md`. Run exactly one API process against a local `.local-data/` directory. Start the web dev server separately. Stop both with Ctrl+C. The Vite proxy is configured for the local API at `127.0.0.1:8000`.

## Local access control

- `.env.example` contains a demo-only token. Copy it to `.env` and replace the token(s) before sharing access.
- `RESEARCH_USERS_JSON` maps actor IDs to tokens. Keep `.env` out of Git; it is ignored.
- The API checks case ownership on each case, artifact, run, explanation, report, export, and delete path. Unknown and foreign-owned IDs intentionally return the same not-found response.
- Token auth does not provide SSO, password reset, rotation workflows, session revocation, or enterprise identity. It is a local development hook only.

## File and log handling

- Uploads are capped at 5 MiB by default and stored under `.local-data/cases/<random-id>/artifacts/`, outside the public web directory.
- The user-supplied filename is not persisted or used as a filesystem path. Artifacts are identified by random IDs; metadata records SHA-256, detected type, size, validation status and schema version.
- The application audit log is `.local-data/audit/events.jsonl`; it records actor, action, object ID, time, outcome and request ID. It must not contain raw inputs, feature values, tokens, report queries, or file names.
- Inference run JSON contains output, explanation, checksums and provenance. Treat run records and exports as sensitive derived research data.
- The code does not encrypt files at rest. Restrict OS account and directory access; use encrypted storage and backups for any approved research deployment.

## Retention and deletion

`RETENTION_DAYS=30` is a policy target only. This prototype has no scheduler or automated purging. An owner-triggered deletion removes the case directory, uploaded original files, run metadata, explanations and reports. The minimal audit event is retained. Any backup copies must have a separately defined expiry and deletion procedure. Operators must manually review and clean expired local data; avoid retaining unapproved data.

## Safe use

- Use only approved, de-identified research inputs.
- Do not upload patient data to the synthetic demo.
- Do not expose the API directly to the internet; use TLS, managed identity/secrets, least privilege, rate limits, network controls, encrypted storage and institutional review before any deployment.
- Keep model weights, datasets, source corpora and secrets out of Git unless redistribution is explicitly approved.
- Do not enable RAG without an approved and versioned source corpus. The included retrieval code returns excerpt lists only and does not call an LLM.

## Troubleshooting

- API fails to start: confirm Python 3.11+, `python -m pip install -e .`, valid `.env` JSON, and port 8000 available.
- UI cannot reach API: confirm API is running on port 8000, then restart Vite. Set `API_PROXY_TARGET` if the local API uses another host/port.
- Upload rejected: use a UTF-8 `.csv` with the exact three feature headers and one row; values must be finite and within -5..5.
- No evidence report: RAG is intentionally off. If authorized, configure `RAG_ENABLED=true`, populate the approved JSONL corpus, restart API, and test weak-evidence abstention first.
