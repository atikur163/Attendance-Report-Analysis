"""Application Configuration using Pydantic Settings."""
import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "UniAttend-Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Firebase & Firestore Configuration
    FIREBASE_PROJECT_ID: str = "gen-lang-client-0312401566"
    FIRESTORE_DATABASE_ID: str = "ai-studio-uniattendunivers-c5e1918d-4a9e-4935-a356-3195f6c33ea5"
    GOOGLE_APPLICATION_CREDENTIALS: str = Field(default="", description="Path to GCP credentials file")

    # CORS
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Statutory Academic Regulations
    LATE_THRESHOLD_MINUTES: int = 20
    EXAM_ELIGIBILITY_PERCENTAGE: float = 60.0
    THREE_LATE_PENALTY_ENABLED: bool = True
    FACE_SIMILARITY_THRESHOLD: float = 0.78

    # SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    EMAIL_FROM: str = "noreply@mbstu.ac.bd"

    # Hardware Device Security
    HARDWARE_SECRET_KEY: str = "mbstu-hardware-secret-2026"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
