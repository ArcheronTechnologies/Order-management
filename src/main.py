"""FastAPI main application."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.suppliers import router as suppliers_router
from src.api.customers import router as customers_router
from src.api.orders import router as orders_router
from src.api.emails import router as emails_router
from src.api.dashboard import router as dashboard_router
from src.api.communications import router as communications_router

app = FastAPI(
    title="J2 Order Tracker",
    description="Order tracking and management tool for J2",
    version="1.0.0",
)

# CORS middleware - configurable via environment
# In production, set CORS_ORIGINS to specific allowed origins
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:8501,http://localhost:3000")
allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dashboard_router)
app.include_router(suppliers_router)
app.include_router(customers_router)
app.include_router(orders_router)
app.include_router(emails_router)
app.include_router(communications_router)


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "name": "J2 Order Tracker API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    from src.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
