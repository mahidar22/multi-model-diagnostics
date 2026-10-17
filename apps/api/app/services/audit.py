from apps.api.app.storage.local import LocalFileStore, store


def record_event(actor_id: str, action: str, object_id: str, outcome: str, request_id: str, file_store: LocalFileStore = store) -> None:
    file_store.append_audit(actor_id, action, object_id, outcome, request_id)
