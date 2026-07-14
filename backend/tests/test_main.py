from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db

# Isolated in-memory SQLite DB just for the test run
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_healthz():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_create_and_get_task():
    resp = client.post("/tasks", json={"title": "Set up CI/CD", "description": "GitHub Actions"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Set up CI/CD"
    assert body["completed"] is False

    task_id = body["id"]
    resp = client.get(f"/tasks/{task_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == task_id


def test_update_task():
    resp = client.post("/tasks", json={"title": "Deploy to k8s"})
    task_id = resp.json()["id"]

    resp = client.patch(f"/tasks/{task_id}", json={"completed": True})
    assert resp.status_code == 200
    assert resp.json()["completed"] is True


def test_delete_task():
    resp = client.post("/tasks", json={"title": "Temp task"})
    task_id = resp.json()["id"]

    resp = client.delete(f"/tasks/{task_id}")
    assert resp.status_code == 204

    resp = client.get(f"/tasks/{task_id}")
    assert resp.status_code == 404


def test_list_tasks():
    resp = client.get("/tasks")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
