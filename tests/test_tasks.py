"""
test_tasks.py - tasks 路由测试
覆盖：GET /tasks, GET /tasks/kanban, POST /tasks,
     GET /tasks/{task_id}, PATCH /tasks/{task_id}, DELETE /tasks/{task_id}
"""
import pytest
from fastapi.testclient import TestClient


class TestCreateTask:
    def test_create_task(self, client: TestClient):
        """创建任务应返回 200 且字段完整"""
        resp = client.post("/tasks/", json={
            "id": "FB-001",
            "title": "测试任务",
            "description": "这是一条测试",
            "priority": 5
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "FB-001"
        assert data["title"] == "测试任务"
        assert data["status"] == "TODO"
        assert data["priority"] == 5

    def test_create_duplicate_id_returns_400(self, client: TestClient):
        """重复 ID 应返回 400"""
        client.post("/tasks/", json={
            "id": "FB-dup", "title": "Task 1", "priority": 1
        })
        resp = client.post("/tasks/", json={
            "id": "FB-dup", "title": "Task 2", "priority": 2
        })
        assert resp.status_code == 400

    def test_create_task_missing_title(self, client: TestClient):
        """缺少 title 应返回 422"""
        resp = client.post("/tasks/", json={
            "id": "FB-no-title"
        })
        assert resp.status_code == 422


class TestListTasks:
    def test_list_tasks_empty(self, client: TestClient):
        """无任务时返回空列表"""
        resp = client.get("/tasks")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_tasks_filter_by_status(self, client: TestClient):
        """按 status 过滤"""
        client.post("/tasks/", json={
            "id": "FB-filter-1", "title": "Task 1", "status": "TODO", "priority": 1
        })
        client.post("/tasks/", json={
            "id": "FB-filter-2", "title": "Task 2", "status": "DOING", "priority": 2
        })
        resp = client.get("/tasks?status=TODO")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "FB-filter-1"

    def test_list_tasks_filter_by_assignee(self, client: TestClient):
        """按 assignee_id 过滤"""
        client.post("/tasks/", json={
            "id": "FB-assign-1", "title": "Task 1", "assignee_id": "fox_001", "priority": 1
        })
        client.post("/tasks/", json={
            "id": "FB-assign-2", "title": "Task 2", "assignee_id": "fox_002", "priority": 2
        })
        resp = client.get("/tasks?assignee_id=fox_001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["assignee_id"] == "fox_001"


class TestGetTask:
    def test_get_existing_task(self, client: TestClient):
        """获取已存在的任务"""
        client.post("/tasks/", json={
            "id": "FB-get", "title": "Get Test Task", "priority": 3
        })
        resp = client.get("/tasks/FB-get")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "FB-get"
        assert data["title"] == "Get Test Task"

    def test_get_unknown_task_returns_404(self, client: TestClient):
        """获取不存在的任务返回 404"""
        resp = client.get("/tasks/FB-nonexistent")
        assert resp.status_code == 404


class TestUpdateTask:
    def test_update_task_status(self, client: TestClient):
        """更新任务状态"""
        client.post("/tasks/", json={
            "id": "FB-update-status", "title": "To Update", "status": "TODO", "priority": 1
        })
        resp = client.patch("/tasks/FB-update-status", json={
            "status": "DOING"
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "DOING"

    def test_update_task_priority(self, client: TestClient):
        """更新任务优先级"""
        client.post("/tasks/", json={
            "id": "FB-update-priority", "title": "Priority Test", "priority": 1
        })
        resp = client.patch("/tasks/FB-update-priority", json={
            "priority": 9
        })
        assert resp.status_code == 200
        assert resp.json()["priority"] == 9

    def test_update_unknown_task_returns_404(self, client: TestClient):
        """更新不存在的任务返回 404"""
        resp = client.patch("/tasks/FB-nonexistent", json={
            "status": "DOING"
        })
        assert resp.status_code == 404


class TestDeleteTask:
    def test_delete_existing_task(self, client: TestClient):
        """删除已存在的任务"""
        client.post("/tasks/", json={
            "id": "FB-delete", "title": "To Delete", "priority": 1
        })
        resp = client.delete("/tasks/FB-delete")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        # 再次获取应返回 404
        resp2 = client.get("/tasks/FB-delete")
        assert resp2.status_code == 404

    def test_delete_unknown_task_returns_404(self, client: TestClient):
        """删除不存在的任务返回 404"""
        resp = client.delete("/tasks/FB-nonexistent")
        assert resp.status_code == 404


class TestKanbanView:
    def test_kanban_empty(self, client: TestClient):
        """空看板返回四列"""
        resp = client.get("/tasks/kanban")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["columns"]) == 4
        statuses = [c["status"] for c in data["columns"]]
        assert statuses == ["TODO", "DOING", "REVIEW", "DONE"]
        for col in data["columns"]:
            assert col["tasks"] == []

    def test_kanban_with_tasks(self, client: TestClient):
        """看板按状态分组"""
        for i, status in enumerate(["TODO", "DOING", "REVIEW", "DONE"]):
            client.post("/tasks/", json={
                "id": f"FB-kanban-{i}", "title": f"Task {i}", "status": status, "priority": i
            })
        resp = client.get("/tasks/kanban")
        assert resp.status_code == 200
        data = resp.json()
        for col in data["columns"]:
            assert len(col["tasks"]) == 1
