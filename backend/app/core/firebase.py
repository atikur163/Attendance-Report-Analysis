"""Firebase Admin SDK and Cloud Firestore Client Initialization."""
import os
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from app.config import settings
from app.core.logging import logger

_firestore_client = None
_firebase_initialized = False


def initialize_firebase():
    global _firebase_initialized, _firestore_client
    if _firebase_initialized and _firestore_client is not None:
        return _firestore_client

    try:
        if not firebase_admin._apps:
            cred_path = settings.GOOGLE_APPLICATION_CREDENTIALS or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path and os.path.exists(cred_path):
                logger.info("Initializing Firebase Admin with Service Account JSON: %s", cred_path)
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {
                    "projectId": settings.FIREBASE_PROJECT_ID
                })
            else:
                logger.info("Initializing Firebase Admin with Application Default Credentials (ADC) for project: %s", settings.FIREBASE_PROJECT_ID)
                # Cloud Run automatically injects ambient Google Cloud credentials
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {
                    "projectId": settings.FIREBASE_PROJECT_ID
                })

        # Connect to specific named Firestore database
        _firestore_client = firestore.client(database=settings.FIRESTORE_DATABASE_ID)
        _firebase_initialized = True
        logger.info("Cloud Firestore Client connected to database: %s", settings.FIRESTORE_DATABASE_ID)
        return _firestore_client
    except Exception as e:
        logger.warning(
            "Firebase Admin auto-initialization deferred (ADC / credentials pending): %s. "
            "FastAPI running in standalone mode until service credentials are provided.",
            e
        )
        _firebase_initialized = False
        return None


def get_firestore_db():
    global _firestore_client
    if _firestore_client is None:
        initialize_firebase()
    return _firestore_client


def verify_firebase_token(id_token: str) -> dict:
    """Verifies Firebase Authentication JWT ID Token and returns user payload."""
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logger.error("Firebase ID Token verification failure: %s", e)
        raise ValueError(f"Invalid or expired Firebase Auth token: {str(e)}")
