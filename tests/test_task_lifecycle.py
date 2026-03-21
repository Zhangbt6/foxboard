"""
test_task_lifecycle.py - Task lifecycle API 测试
覆盖：POST /tasks/{id}/claim, /submit, /review, /reject, /bulk
"""
import pytest
from fastapi.testclient import TestClient


def _create_agent(client: TestClient, agent_id: str, name: str = None):
    """快捷创建 agent"""
    if name is None:
        name = agent_id
    resp = client.post("/agents/register", json={"agent_id": agent_id, "name": name, "role": "worker"})
    assert resp.status_code == 200
    return resp.json()


def _create_task(client: TestClient, task_id: str, title: str, status: str = "TODO", **kwargs):
    """快捷创建任务"""
    payload = {"id": task_id, "title": title, "status": status, "priority": 5}
    payload.update(kwargs)
    resp = client.post("/tasks/", json=payload)
    assert resp.status_code == 200
    return resp.json()


class TestClaimTask:
    """POST /tasks/{id}/claim — 领取任务"""

    def test_claim_todo_task(self, client: TestClient):
        """TODO → DOING，started_at 应被设置"""
        _create_agent(client, "fox_001")
        _create_task(client, "FB-CLM-1", "待领取任务")
        resp = client.post("/tasks/FB-CLM-1/claim", json={"agent_id": "fox_001"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["task"]["status"] == "DOING"
        assert data["task"]["started_at"] is not None
        assert data["task"]["assignee_id"] == "fox_001"

    def test_claim_updates_agent_current_task(self, client: TestClient):
        """claim 后 agent.current_task_id 应被更新"""
        _create_agent(client, "fox_002")
        _create_task(client, "FB-CLM-2", "更新current_task")
        client.post("/tasks/FB-CLM-2/claim", json={"agent_id": "fox_002"})
        resp = client.get("/agents/fox_002")
        assert resp.json()["current_task_id"] == "FB-CLM-2"

    def test_claim_non_todo_returns_400(self, client: TestClient):
        """非 TODO 状态的任务不能被领取"""
        _create_agent(client, "fox_003")
        _create_task(client, "FB-CLM-3", "非TODO任务", status="DOING")
        resp = client.post("/tasks/FB-CLM-3/claim", json={"agent_id": "fox_003"})
        assert resp.status_code == 400
        assert "TODO" in resp.json()["detail"]

    def test_claim_nonexistent_task_returns_404(self, client: TestClient):
        """领取不存在的任务返回 404"""
        resp = client.post("/tasks/FB-NOOP/claim", json={"agent_id": "fox_001"})
        assert resp.status_code == 404


class TestSubmitTask:
    """POST /tasks/{id}/submit — 提交任务"""

    def test_submit_doing_task(self, client: TestClient):
        """DOING → REVIEW，agent.current_task_id 应被清除"""
        _create_agent(client, "fox_010")
        _create_task(client, "FB-SUB-1", "待提交任务", status="DOING", assignee_id="fox_010")
        # 先 claim
        client.post("/tasks/FB-SUB-1/claim", json={"agent_id": "fox_010"})
        resp = client.post("/tasks/FB-SUB-1/submit", json={"agent_id": "fox_010"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["task"]["status"] == "REVIEW"

    def test_submit_non_doing_returns_400(self, client: TestClient):
        """非 DOING 状态不能提交"""
        _create_agent(client, "fox_011")
        _create_task(client, "FB-SUB-2", "TODO状态", status="TODO")
        resp = client.post("/tasks/FB-SUB-2/submit", json={"agent_id": "fox_011"})
        assert resp.status_code == 400
        assert "DOING" in resp.json()["detail"]

    def test_submit_with_message(self, client: TestClient):
        """submit 可附带 message"""
        _create_agent(client, "fox_012")
        _create_task(client, "FB-SUB-3", "带附言", status="DOING")
        client.post("/tasks/FB-SUB-3/claim", json={"agent_id": "fox_012"})
        resp = client.post("/tasks/FB-SUB-3/submit", json={
            "agent_id": "fox_012",
            "message": "已完成核心功能"
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


class TestReviewTask:
    """POST /tasks/{id}/review — 审核通过"""

    def test_review_review_task(self, client: TestClient):
        """REVIEW → DONE，completed_at 应被设置"""
        _create_agent(client, "fox_020")
        _create_task(client, "FB-REV-1", "待审核任务", status="REVIEW")
        resp = client.post("/tasks/FB-REV-1/review", json={"auditor_id": "fox_020"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["task"]["status"] == "DONE"
        assert data["task"]["completed_at"] is not None

    def test_review_non_review_returns_400(self, client: TestClient):
        """非 REVIEW 状态不能审核"""
        _create_agent(client, "fox_021")
        _create_task(client, "FB-REV-2", "DOING状态", status="DOING")
        resp = client.post("/tasks/FB-REV-2/review", json={"auditor_id": "fox_021"})
        assert resp.status_code == 400
        assert "REVIEW" in resp.json()["detail"]

    def test_review_nonexistent_returns_404(self, client: TestClient):
        resp = client.post("/tasks/FB-NOOP/review", json={"auditor_id": "fox_001"})
        assert resp.status_code == 404


class TestRejectTask:
    """POST /tasks/{id}/reject — 审核打回"""

    def test_reject_review_task(self, client: TestClient):
        """REVIEW → DOING，保留 started_at"""
        _create_agent(client, "fox_030")
        _create_task(client, "FB-REJ-1", "待打回任务", status="REVIEW", started_at="2026-03-21T00:00:00")
        resp = client.post("/tasks/FB-REJ-1/reject", json={
            "auditor_id": "fox_030",
            "reason": "代码不规范，需重写"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["task"]["status"] == "DOING"
        assert "代码不规范" in data["message"]

    def test_reject_non_review_returns_400(self, client: TestClient):
        """非 REVIEW 状态不能打回"""
        _create_agent(client, "fox_031")
        _create_task(client, "FB-REJ-2", "TODO状态", status="TODO")
        resp = client.post("/tasks/FB-REJ-2/reject", json={
            "auditor_id": "fox_031",
            "reason": "test"
        })
        assert resp.status_code == 400

    def test_reject_reason_required(self, client: TestClient):
        """reject 必须提供 reason"""
        _create_agent(client, "fox_032")
        _create_task(client, "FB-REJ-3", "待打回任务", status="REVIEW")
        resp = client.post("/tasks/FB-REJ-3/reject", json={"auditor_id": "fox_032"})
        assert resp.status_code == 422  # Pydantic validation error


class TestBulkCreate:
    """POST /tasks/bulk — 批量创建"""

    def test_bulk_create_all_success(self, client: TestClient):
        """批量创建全部成功"""
        resp = client.post("/tasks/bulk", json={
            "tasks": [
                {"id": "FB-BLK-1", "title": "批量任务1", "priority": 5},
                {"id": "FB-BLK-2", "title": "批量任务2", "priority": 3},
                {"id": "FB-BLK-3", "title": "批量任务3", "priority": 1},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert len(data["created"]) == 3
        assert len(data["failed"]) == 0

    def test_bulk_create_partial_failure(self, client: TestClient):
        """部分失败时返回 failed 列表，其余仍成功"""
        # 先创建一个
        _create_task(client, "FB-BLK-4", "已存在", status="TODO")
        resp = client.post("/tasks/bulk", json={
            "tasks": [
                {"id": "FB-BLK-5", "title": "新任务5", "priority": 1},
                {"id": "FB-BLK-4", "title": "重复ID", "priority": 2},  # 会失败
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert len(data["created"]) == 1
        assert len(data["failed"]) == 1
        assert data["failed"][0]["id"] == "FB-BLK-4"

    def test_bulk_create_empty_list(self, client: TestClient):
        """空列表应返回空 created"""
        resp = client.post("/tasks/bulk", json={"tasks": []})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert resp.json()["created"] == []

    def test_bulk_idempotent_after_partial(self, client: TestClient):
        """部分失败后重新提交成功的 ID 应该可以成功"""
        resp = client.post("/tasks/bulk", json={
            "tasks": [
                {"id": "FB-BLK-6", "title": "新任务6", "priority": 1},
                {"id": "FB-BLK-7", "title": "新任务7", "priority": 1},
            ]
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert len(resp.json()["created"]) == 2


class TestStateTransitionIllegal:
    """异常状态转换验证"""

    def test_cannot_review_from_todo(self, client: TestClient):
        """TODO 不能直接 review"""
        _create_agent(client, "fox_040")
        _create_task(client, "FB-ILL-1", "非法review", status="TODO")
        resp = client.post("/tasks/FB-ILL-1/review", json={"auditor_id": "fox_040"})
        assert resp.status_code == 400

    def test_cannot_reject_from_todo(self, client: TestClient):
        """TODO 不能 reject"""
        _create_agent(client, "fox_041")
        _create_task(client, "FB-ILL-2", "非法reject", status="TODO")
        resp = client.post("/tasks/FB-ILL-2/reject", json={
            "auditor_id": "fox_041",
            "reason": "test"
        })
        assert resp.status_code == 400

    def test_cannot_claim_done_task(self, client: TestClient):
        """DONE 不能 claim"""
        _create_agent(client, "fox_042")
        _create_task(client, "FB-ILL-3", "已完成", status="DONE")
        resp = client.post("/tasks/FB-ILL-3/claim", json={"agent_id": "fox_042"})
        assert resp.status_code == 400
