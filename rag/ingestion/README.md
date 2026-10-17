# Approved-source ingestion

RAG is off by default. There are no bundled clinical sources. After obtaining institutional and license approval, place a reviewed `.jsonl` source file in the configured approved corpus directory. Each line must be a JSON object with at least:

```json
{"id":"source-001","title":"Source title","url":"https://example.org/item","identifier":"DOI or local identifier","date":"2026-01-01","license_status":"approved","approved":true,"content":"Reviewed text passage..."}
```

Do not ingest patient records, unlicensed text, or instructions from untrusted sources. The prototype uses transparent lexical overlap retrieval and displays retrieved excerpts verbatim; it does not run an LLM. Keep the source manifest, approval evidence, and corpus checksum under project governance. The feature must remain disabled until the source collection is approved.
