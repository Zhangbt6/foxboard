"""
test_agents.py - agents 路由测试
覆盖：/agents/register, /agents/heartbeat, GET /agents, GET /agents/{agent_id}
"""
import pytest
from fastapi.testclient import TestClient


class TestAgentRegister:
    def test_register_new_agent(self, client: TestClient):
        """注册新成员应返回 200 且字段完整"""
        resp = client.post("/agents/register", json={
            "agent_id": "fox_001",
            "name": "黑狐",
            "role": "auditor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "fox_001"
        assert data["name"] == "黑狐"
        assert data["role"] == "auditor"
        assert data["status"] == "idle"

    def test_register_duplicate_id_updates(self, client: TestClient):
        """重复注册同一 ID 不应覆盖 name/role（防止心跳污染）"""
        client.post("/agents/register", json={
            "agent_id": "fox_002",
            "name": "青狐",
            "role": "worker"
        })
        resp = client.post("/agents/register", json={
            "agent_id": "fox_002",
            "name": "青狐（更新后）",
            "role": "commander"
        })
        assert resp.status_code == 200
        data = resp.json()
        # 已存在的 agent，name/role 保持首次注册值不变
        assert data["name"] == "青狐"
        assert data["role"] == "worker"

    def test_register_missing_fields(self, client: TestClient):
        """缺少必填字段应返回 422"""
        resp = client.post("/agents/register", json={"agent_id": "fox_003"})
        assert resp.status_code == 422


class TestAgentHeartbeat:
    def test_heartbeat_existing_agent(self, client: TestClient):
        """已注册成员发送心跳应返回 200 并更新状态"""
        # 先注册
        client.post("/agents/register", json={
            "agent_id": "fox_heartbeat_test",
            "name": "TestAgent",
            "role": "worker"
        })
        resp = client.post("/agents/heartbeat", json={
            "agent_id": "fox_heartbeat_test",
            "status": "busy",
            "task_id": "FB-009",
            "priority": 80
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "busy"
        assert data["current_task_id"] == "FB-009"
        assert data["priority"] == 80

    def test_heartbeat_unknown_agent_returns_404(self, client: TestClient):
        """未知成员发送心跳应返回 404"""
        resp = client.post("/agents/heartbeat", json={
            "agent_id": "unknown_fox",
            "status": "idle"
        })
        assert resp.status_code == 404

    def test_heartbeat_default_values(self, client: TestClient):
        """心跳可不带可选字段（使用默认值）"""
        client.post("/agents/register", json={
            "agent_id": "fox_default_test",
            "name": "DefaultTest",
            "role": "worker"
        })
        resp = client.post("/agents/heartbeat", json={
            "agent_id": "fox_default_test"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "idle"
        assert data["priority"] == 0


class TestListAgents:
    def test_list_agents_empty(self, client: TestClient):
        """无成员时返回空列表"""
        resp = client.get("/agents")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_agents_returns_registered(self, client: TestClient):
        """列出已注册成员"""
        client.post("/agents/register", json={
            "agent_id": "fox_list_1", "name": "A", "role": "worker"
        })
        client.post("/agents/register", json={
            "agent_id": "fox_list_2", "name": "B", "role": "worker"
        })
        resp = client.get("/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2


class TestGetAgent:
    def test_get_existing_agent(self, client: TestClient):
        """获取已存在的成员详情"""
        client.post("/agents/register", json={
            "agent_id": "fox_get_test", "name": "GetTest", "role": "auditor"
        })
        resp = client.get("/agents/fox_get_test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "fox_get_test"
        assert data["name"] == "GetTest"

    def test_get_unknown_agent_returns_404(self, client: TestClient):
        """获取不存在的成员返回 404"""
        resp = client.get("/agents/unknown_agent")
        assert resp.status_code == 404
