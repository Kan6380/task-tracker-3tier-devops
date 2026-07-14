import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# In real deployment this comes from a K8s Secret env var.
# Locally (docker-compose) it points at the postgres container.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://taskuser:taskpass@localhost:5432/taskdb",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
