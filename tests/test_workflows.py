"""
测试工作流路由 - workflows
"""
import pytest


class TestCreateWorkflow:
    def test_create_workflow(self, client):
        r = client.post("/workflows/", json={
            "id": "wf-001",
            "project_id": "foxboard",
            "name": "花火标准流程",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "wf-001"
        assert data["project_id"] == "foxboard"
        assert data["name"] == "花火标准流程"
        assert "created_at" in data

    def test_create_workflow_duplicate_id(self, client):
        client.post("/workflows/", json={"id": "wf-dup", "name": "test"})
        r = client.post("/workflows/", json={"id": "wf-dup", "name": "test2"})
        assert r.status_code == 400


class TestListWorkflows:
    def test_list_workflows_empty(self, client):
        r = client.get("/workflows/")
        assert r.status_code == 200
        assert r.json() == []

    def test_list_workflows_returns_created(self, client):
        client.post("/workflows/", json={"id": "wf-a", "name": "A"})
        client.post("/workflows/", json={"id": "wf-b", "name": "B"})
        r = client.get("/workflows/")
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_list_workflows_filter_by_project(self, client):
        client.post("/workflows/", json={"id": "wf-p1", "project_id": "proj1", "name": "P1"})
        client.post("/workflows/", json={"id": "wf-p2", "project_id": "proj2", "name": "P2"})
        r = client.get("/workflows/?project_id=proj1")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["project_id"] == "proj1"


class TestGetWorkflow:
    def test_get_existing_workflow(self, client):
        client.post("/workflows/", json={"id": "wf-get", "name": "get"})
        r = client.get("/workflows/wf-get")
        assert r.status_code == 200
        assert r.json()["id"] == "wf-get"

    def test_get_unknown_workflow(self, client):
        r = client.get("/workflows/none")
        assert r.status_code == 404


class TestWorkflowNodes:
    def test_list_nodes_on_create(self, client):
        """创建工作流时自动初始化 7 个标准节点"""
        client.post("/workflows/", json={"id": "wf-nodes", "name": "n"})
        r = client.get("/workflows/wf-nodes/nodes")
        assert r.status_code == 200
        nodes = r.json()
        assert len(nodes) == 7
        for n in nodes:
            assert n["status"] == "pending"
            assert n["color"] == "#94a3b8"

    def test_update_single_node(self, client):
        client.post("/workflows/", json={"id": "wf-upd", "name": "u"})
        r = client.patch("/workflows/wf-upd/nodes/3", json={
            "status": "running",
            "task_id": "FB-003",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["node_id"] == "3"
        assert data["status"] == "running"
        assert data["task_id"] == "FB-003"
        assert data["color"] == "#3b82f6"

    def test_update_node_status_colors(self, client):
        """验证每种状态对应正确颜色"""
        client.post("/workflows/", json={"id": "wf-colors", "name": "c"})
        for status, expected_color in [
            ("pending", "#94a3b8"),
            ("running", "#3b82f6"),
            ("done", "#22c55e"),
            ("review", "#eab308"),
            ("blocked", "#ef4444"),
        ]:
            r = client.patch("/workflows/wf-colors/nodes/1", json={"status": status})
            assert r.status_code == 200, f"failed for {status}"
            assert r.json()["color"] == expected_color, f"wrong color for {status}"

    def test_update_unknown_node(self, client):
        client.post("/workflows/", json={"id": "wf-un", "name": "u"})
        r = client.patch("/workflows/wf-un/nodes/99", json={"status": "done"})
        assert r.status_code == 404

    def test_update_nodes_by_task(self, client):
        """批量更新：同一 task_id 的节点状态"""
        client.post("/workflows/", json={"id": "wf-task", "name": "t"})
        # 先给 node 4 关联 task FB-005
        client.patch("/workflows/wf-task/nodes/4", json={
            "status": "running", "task_id": "FB-005"
        })
        # 模拟 FB-005 变为 done，触发节点颜色同步
        r = client.patch(
            "/workflows/wf-task/nodes?task_id=FB-005&status=done"
        )
        assert r.status_code == 200
        # 返回全部节点，node 4 应该是 done
        nodes = {n["node_id"]: n for n in r.json()}
        assert nodes["4"]["status"] == "done"
        assert nodes["4"]["color"] == "#22c55e"

    def test_update_nodes_by_task_not_found(self, client):
        client.post("/workflows/", json={"id": "wf-miss", "name": "m"})
        r = client.patch("/workflows/wf-miss/nodes?task_id=NO-SUCH-TASK&status=done")
        assert r.status_code == 404


class TestDeleteWorkflow:
    def test_delete_workflow(self, client):
        client.post("/workflows/", json={"id": "wf-del", "name": "d"})
        r = client.delete("/workflows/wf-del")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_delete_unknown_workflow(self, client):
        r = client.delete("/workflows/none")
        assert r.status_code == 404
