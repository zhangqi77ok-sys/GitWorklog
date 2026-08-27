from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "RunCabinet Vite Coding Studio"
    database_url: str = "sqlite:///./data/local_studio.db"
    default_provider: str = "antigravity"
    default_model: str = "antigravity-core"

settings = Settings()
