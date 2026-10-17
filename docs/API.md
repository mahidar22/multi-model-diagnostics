# API reference (local prototype)

Base prefix: `/api/v1`. All endpoints except health require `Authorization: Bearer <token>`. Error envelope:

```json
{"error":{"code":"SCHEMA_MISMATCH","message":"Input columns do not match this task.","retryable":false},"request_id":"..."}
```

No endpoint logs request bodies. The API returns `X-Request-ID` and `Cache-Control: no-store` headers.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Public health/configuration summary |
| GET | `/auth/session` | Verify token and return actor ID |
| GET | `/cases` | List only the authenticated actor's cases |
| POST | `/cases` | Create pseudonymous case; body `{ "pseudonymous_reference": "CASE-001" }` (optional) |
| GET | `/cases/{case_id}` | Read own case metadata |
| POST | `/cases/{case_id}/artifacts` | Multipart CSV upload (`file`) |
| POST | `/cases/{case_id}/validate` | Validate `{ "artifact_id": "..." }` |
| POST | `/cases/{case_id}/runs` | Synchronous inference; body includes artifact ID, model version, and requested outputs |
| GET | `/runs/{run_id}` | Read own run and provenance |
| GET | `/runs/{run_id}/explanations` | Read supported explanation artifact |
| POST | `/runs/{run_id}/report` | Optional report/excerpt workflow; body `{ "question": "..." }`; RAG off by default |
| GET | `/evaluation/demo` | Metrics for bundled synthetic fixture only |
| GET | `/cases/{case_id}/export` | Download owner-authorized ZIP |
| DELETE | `/cases/{case_id}` | Delete case, uploaded artifact and derived run files |

Interactive OpenAPI docs: `/docs` on the API host. The prototype is synchronous; it does not run a job queue. The API is intentionally local-only by default and not a hardened production service.
