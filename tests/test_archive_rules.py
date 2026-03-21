"""
test_archive_rules.py — 归档规则接口行为验证
FB-057: 归档规则文档化 + 接口行为验证

覆盖场景：
1. DONE 任务归档成功
2. DONE 任务重复归档（幂等）
3. 非 DONE 任务归档 → 400
4. 不存在任务归档 → 404
5. 归档后任务不在默认看板查询中
"""
import pytest
from fastapi.testclient import TestClient


def _make_project(client: TestClient, name="归档测试项目") -> str:
    """在测试中创建项目并返回其 ID"""
    resp = client.post(
        "/projects/",
        json={"id": f"proj-test-{__import__('time').time():.0f}", "name": name},
    )
    assert resp.status_code == 201, f"project creation failed: {resp.status_code} {resp.text}"
    return resp.json()["id"]


class TestArchiveRules:
    def test_archive_done_task_succeeds(self, client: TestClient):
        """规则1：只有 DONE 任务才能归档"""
        project_id = _make_project(client)

        # 1. 创建一个 DONE 任务
        task_resp = client.post(
            "/tasks",
            json={
                "id": "FB-ARCHIVE-001",
                "title": "归档测试任务",
                "project_id": project_id,
                "assignee_id": "black_fox",
                "priority": 6,
                "status": "DONE",
            },
        )
        assert task_resp.status_code == 200, f"task create failed: {task_resp.status_code} {task_resp.text}"
        task_id = task_resp.json()["id"]

        # 2. 归档该任务
        archive_resp = client.post(
            f"/tasks/{task_id}/archive",
            json={
                "phase_label": "PHASE8",
                "operator_id": "black_fox",
                "note": "FB-057 验证归档",
            },
        )
        assert archive_resp.status_code == 200
        data = archive_resp.json()
        assert data["ok"] is True
        assert data["archived"] == task_id
        assert data["phase"] == "PHASE8"

        # 3. 验证 archived_at 已设置
        task_get = client.get(f"/tasks/{task_id}")
        assert task_get.json()["archived_at"] is not None
        assert task_get.json()["archive_phase"] == "PHASE8"

    def test_archive_idempotent(self, client: TestClient):
        """规则2：已归档任务重复归档返回幂等成功（不报错）"""
        project_id = _make_project(client)

        task_resp = client.post(
            "/tasks",
            json={
                "id": "FB-ARCHIVE-002",
                "title": "幂等归档测试",
                "project_id": project_id,
                "assignee_id": "black_fox",
                "priority": 6,
                "status": "DONE",
            },
        )
        assert task_resp.status_code == 200, f"task create failed: {task_resp.status_code} {task_resp.text}"
        task_id = task_resp.json()["id"]

        client.post(
            f"/tasks/{task_id}/archive",
            json={"phase_label": "PHASE8", "operator_id": "black_fox"},
        )

        # 再次归档 — 应该幂等返回
        archive_resp2 = client.post(
            f"/tasks/{task_id}/archive",
            json={"phase_label": "PHASE8", "operator_id": "black_fox"},
        )
        assert archive_resp2.status_code == 200
        assert archive_resp2.json()["ok"] is True

    def test_archive_non_done_task_fails(self, client: TestClient):
        """规则3：非 DONE 状态任务归档 → HTTP 400"""
        project_id = _make_project(client)

        task_resp = client.post(
            "/tasks",
            json={
                "id": "FB-ARCHIVE-003",
                "title": "未完成任务",
                "project_id": project_id,
                "assignee_id": "black_fox",
                "priority": 6,
                "status": "DOING",
            },
        )
        assert task_resp.status_code == 200, f"task create failed: {task_resp.status_code} {task_resp.text}"
        task_id = task_resp.json()["id"]

        archive_resp = client.post(
            f"/tasks/{task_id}/archive",
            json={"phase_label": "PHASE8", "operator_id": "black_fox"},
        )
        assert archive_resp.status_code == 400
        assert "只有 DONE 任务才能归档" in archive_resp.json()["detail"]

    def test_archive_nonexistent_task_fails(self, client: TestClient):
        """规则4：不存在任务归档 → HTTP 404"""
        resp = client.post(
            "/tasks/FB-NONEXISTENT/archive",
            json={"phase_label": "PHASE8", "operator_id": "black_fox"},
        )
        assert resp.status_code == 404

    def test_archived_task_excluded_from_default_kanban(self, client: TestClient):
        """规则5：归档后任务不在默认看板查询中"""
        project_id = _make_project(client)

        task_resp = client.post(
            "/tasks",
            json={
                "id": "FB-ARCHIVE-004",
                "title": "看板排除测试",
                "project_id": project_id,
                "assignee_id": "black_fox",
                "priority": 6,
                "status": "DONE",
            },
        )
        assert task_resp.status_code == 200, f"task create failed: {task_resp.status_code} {task_resp.text}"
        task_id = task_resp.json()["id"]

        client.post(
            f"/tasks/{task_id}/archive",
            json={"phase_label": "PHASE8", "operator_id": "black_fox"},
        )

        # 获取看板 — 不应包含已归档任务
        kanban_resp = client.get(f"/tasks/kanban?project_id={project_id}")
        assert kanban_resp.status_code == 200
        all_task_ids = []
        for col in kanban_resp.json().get("columns", []):
            for t in col.get("tasks", []):
                all_task_ids.append(t["id"])
        assert task_id not in all_task_ids
