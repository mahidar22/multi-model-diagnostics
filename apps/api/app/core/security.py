import hmac
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from apps.api.app.core.config import settings
from apps.api.app.core.errors import ApiError

_bearer = HTTPBearer(auto_error=False)


def get_current_actor(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "AUTHENTICATION_REQUIRED", "Provide a valid bearer token.")

    token = credentials.credentials
    for actor_id, expected in settings.user_tokens.items():
        if hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
            return actor_id
    raise ApiError(401, "INVALID_CREDENTIALS", "The supplied bearer token is not recognized.")
