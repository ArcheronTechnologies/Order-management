"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql://j2tracker:j2tracker@localhost:5432/j2_tracker"

    # Microsoft Graph API
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""
    graph_user_email: str = ""
    graph_target_folder: str = "Supplier Orders"

    # App
    secret_key: str = "dev-secret-key-change-in-production"
    api_host: str = "localhost"
    api_port: int = 8000
    streamlit_port: int = 8501

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
