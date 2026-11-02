"""Structured Application Logging Configuration."""
import logging
import sys
from app.config import settings


def setup_logging():
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = [handler]

    # Suppress verbose third-party logs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    logger = logging.getLogger("uniattend")
    logger.info("UniAttend Logging initialized at level: %s", logging.getLevelName(log_level))
    return logger


logger = setup_logging()
