import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _envelope(request: Request, code: str, message: str, retryable: bool = False) -> dict[str, Any]:
    return {
        "error": {"code": code, "message": message, "retryable": retryable},
        "request_id": _request_id(request),
    }


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(request, exc.code, exc.message, exc.retryable),
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_envelope(request, "REQUEST_VALIDATION_FAILED", "Request did not match the API schema."),
    )


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status = exc.status_code
    if status == 404:
        code, message = "NOT_FOUND", "The requested endpoint or resource was not found."
    elif status == 405:
        code, message = "METHOD_NOT_ALLOWED", "This HTTP method is not supported for the requested endpoint."
    else:
        code, message = "HTTP_ERROR", "The request could not be completed."
    return JSONResponse(status_code=status, content=_envelope(request, code, message))


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API exception (request_id=%s)", _request_id(request))
    return JSONResponse(
        status_code=500,
        content=_envelope(request, "INTERNAL_ERROR", "The request could not be completed. No input data was written to the application log."),
    )
