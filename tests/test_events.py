"""
test_events.py - events 路由测试
覆盖：POST /events, GET /events
"""
import pytest
from fastapi.testclient import TestClient


class TestCreateEvent:
    def test_create_event(self, client: TestClient):
        """创建事件应返回 200"""
        resp = client.post("/events/", json={
            "event_type": "task_created",
            "task_id": "FB-001",
            "agent_id": "fox_001",
            "message": "任务已创建"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["event_type"] == "task_created"
        assert data["task_id"] == "FB-001"
        assert data["agent_id"] == "fox_001"
        assert data["message"] == "任务已创建"
        assert "id" in data
        assert "created_at" in data

    def test_create_event_minimal(self, client: TestClient):
        """仅传必填字段"""
        resp = client.post("/events/", json={
            "event_type": "agent_heartbeat"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["event_type"] == "agent_heartbeat"
        assert data["task_id"] is None
        assert data["agent_id"] is None

    def test_create_event_invalid_type(self, client: TestClient):
        """无效 event_type 应返回 422"""
        resp = client.post("/events/", json={
            "event_type": "invalid_type"
        })
        assert resp.status_code == 422


class TestListEvents:
    def test_list_events_empty(self, client: TestClient):
        """无事件时返回空列表"""
        resp = client.get("/events")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_events_returns_created(self, client: TestClient):
        """列出已创建的事件"""
        client.post("/events/", json={
            "event_type": "task_created", "task_id": "T1"
        })
        client.post("/events/", json={
            "event_type": "agent_heartbeat", "agent_id": "fox_001"
        })
        resp = client.get("/events")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_list_events_filter_by_task_id(self, client: TestClient):
        """按 task_id 过滤"""
        client.post("/events/", json={
            "event_type": "task_created", "task_id": "FB-filter"
        })
        client.post("/events/", json={
            "event_type": "task_completed", "task_id": "FB-filter"
        })
        client.post("/events/", json={
            "event_type": "task_created", "task_id": "FB-other"
        })
        resp = client.get("/events?task_id=FB-filter")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        for ev in data:
            assert ev["task_id"] == "FB-filter"

    def test_list_events_filter_by_agent_id(self, client: TestClient):
        """按 agent_id 过滤"""
        client.post("/events/", json={
            "event_type": "agent_heartbeat", "agent_id": "fox_heart"
        })
        client.post("/events/", json={
            "event_type": "agent_heartbeat", "agent_id": "fox_other"
        })
        resp = client.get("/events?agent_id=fox_heart")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["agent_id"] == "fox_heart"

    def test_list_events_filter_by_event_type(self, client: TestClient):
        """按 event_type 过滤"""
        client.post("/events/", json={
            "event_type": "task_created"
        })
        client.post("/events/", json={
            "event_type": "agent_heartbeat"
        })
        resp = client.get("/events?event_type=agent_heartbeat")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["event_type"] == "agent_heartbeat"

    def test_list_events_limit(self, client: TestClient):
        """limit 参数限制返回数量"""
        for i in range(5):
            client.post("/events/", json={
                "event_type": "task_created", "task_id": f"T{i}"
            })
        resp = client.get("/events?limit=3")
        assert resp.status_code == 200
        assert len(resp.json()) == 3
