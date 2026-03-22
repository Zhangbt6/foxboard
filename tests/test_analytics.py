"""
Analytics API 测试
"""
import pytest
from fastapi.testclient import TestClient
from foxboard_backend.app import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestEfficiency:
    def test_get_efficiency(self, client: TestClient):
        resp = client.get("/analytics/efficiency")
        assert resp.status_code == 200
        data = resp.json()
        assert "overall" in data
        assert "per_agent" in data
        assert "filters" in data
        assert "first_pass_rate" in data["overall"]
        assert "avg_completion_hours" in data["overall"]
        assert "total_done_tasks" in data["overall"]
        assert "rejection_hotspots" in data["overall"]

    def test_per_agent_structure(self, client: TestClient):
        resp = client.get("/analytics/efficiency")
        assert resp.status_code == 200
        data = resp.json()
        for agent in data["per_agent"]:
            assert "agent_id" in agent
            assert "total_tasks" in agent
            assert "done_tasks" in agent
            assert "avg_completion_hours" in agent
            assert "first_pass_rate" in agent

    def test_rejection_hotspots_structure(self, client: TestClient):
        resp = client.get("/analytics/efficiency")
        assert resp.status_code == 200
        data = resp.json()
        for spot in data["overall"]["rejection_hotspots"]:
            assert "agent_id" in spot
            assert "rejection_count" in spot

    def test_filters_default_to_none(self, client: TestClient):
        resp = client.get("/analytics/efficiency")
        assert resp.status_code == 200
        data = resp.json()
        assert data["filters"]["project_id"] is None
        assert data["filters"]["date_range"] is None

    def test_response_has_required_keys(self, client: TestClient):
        resp = client.get("/analytics/efficiency")
        assert resp.status_code == 200
        data = resp.json()
        # overall fields
        assert isinstance(data["overall"]["first_pass_rate"], (int, float))
        assert isinstance(data["overall"]["avg_completion_hours"], (int, float))
        assert isinstance(data["overall"]["total_done_tasks"], int)
        assert isinstance(data["overall"]["rejection_hotspots"], list)
        # per_agent is a list
        assert isinstance(data["per_agent"], list)
        # filters is a dict
        assert isinstance(data["filters"], dict)
