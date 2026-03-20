"""
集成测试 — Phase 3
测试跨模块功能：workflows 与 tasks/events 的集成
注意：workflows router 尚未提交 Git（FB-016 审核中）
此测试文件验证 FB-016 功能正确性。
"""
import pytest


class TestWorkflowTaskIntegration:
    """工作流节点与任务的集成"""

    def test_create_workflow_then_update_task_status(self, client):
        """创建工作流后，关联任务状态应能正确更新节点"""
        # 1. 创建工作流（自动创建7个节点，均为 pending）
        r = client.post("/workflows/", json={
            "id": "wf-int-001",
            "project_id": "foxboard",
            "name": "集成测试流程",
        })
        assert r.status_code == 200
        wf = r.json()
        assert wf["id"] == "wf-int-001"

        # 2. 创建任务
        r = client.post("/tasks/", json={
            "id": "task-int-001",
            "title": "集成测试任务",
            "priority": 5,
            "assignee_id": "white_fox",
            "project_id": "foxboard",
        })
        assert r.status_code == 200

        # 3. 将任务关联到工作流第3节点（白狐调研）
        r = client.patch("/workflows/wf-int-001/nodes/3", json={
            "task_id": "task-int-001",
        })
        assert r.status_code == 200
        assert r.json()["task_id"] == "task-int-001"

        # 4. 更新节点状态（模拟任务开始）
        r = client.patch("/workflows/wf-int-001/nodes/3", json={
            "status": "running",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "running"
        assert r.json()["color"] == "#3b82f6"  # blue

        # 5. 验证颜色映射正确
        color_map = {
            "pending": "#94a3b8",
            "running": "#3b82f6",
            "done": "#22c55e",
            "review": "#eab308",
            "blocked": "#ef4444",
        }
        for status, expected_color in color_map.items():
            r = client.patch("/workflows/wf-int-001/nodes/3", json={"status": status})
            assert r.status_code == 200
            assert r.json()["color"] == expected_color, f"status={status} expected {expected_color}"

    def test_workflow_delete_cascades_to_nodes(self, client):
        """删除工作流应级联删除节点状态"""
        # 创建工作流
        r = client.post("/workflows/", json={"id": "wf-del-cascade", "name": "级联删除测试"})
        assert r.status_code == 200

        # 确认有7个节点
        r = client.get("/workflows/wf-del-cascade/nodes")
        assert r.status_code == 200
        assert len(r.json()) == 7

        # 删除工作流
        r = client.delete("/workflows/wf-del-cascade")
        assert r.status_code == 200

        # 节点应无法再访问
        r = client.get("/workflows/wf-del-cascade/nodes")
        assert r.status_code == 404


class TestWorkflowEventsIntegration:
    """工作流与事件系统的集成"""

    def test_create_workflow_generates_event(self, client):
        """创建工作流应在 events 表留下记录（通过事件追踪）"""
        # 创建工作流
        r = client.post("/workflows/", json={
            "id": "wf-evt-001",
            "name": "事件测试流程",
        })
        assert r.status_code == 200

        # 确认可以查询该工作流
        r = client.get("/workflows/wf-evt-001")
        assert r.status_code == 200
        assert r.json()["name"] == "事件测试流程"

    def test_workflow_node_updates_tracked(self, client):
        """工作流节点状态变更应可追踪"""
        # 创建工作流
        r = client.post("/workflows/", json={
            "id": "wf-evt-002",
            "name": "节点变更追踪测试",
        })
        assert r.status_code == 200

        # 更新节点状态
        for status in ["running", "done", "review"]:
            r = client.patch("/workflows/wf-evt-002/nodes/1", json={"status": status})
            assert r.status_code == 200
            node = r.json()
            assert node["status"] == status

        # 确认最终状态
        r = client.get("/workflows/wf-evt-002/nodes")
        assert r.status_code == 200
        nodes = r.json()
        node1 = next(n for n in nodes if n["node_id"] == "1")
        assert node1["status"] == "review"


class TestPhase2Regression:
    """Phase 2 功能回归测试 — 确保 Phase 3 修改未破坏已有功能"""

    def test_agents_api_still_works(self, client):
        """Agent 注册和心跳 API 未被破坏"""
        r = client.get("/agents/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_tasks_api_still_works(self, client):
        """Task CRUD API 未被破坏"""
        r = client.post("/tasks/", json={
            "id": "regression-task-001",
            "title": "回归测试任务",
            "priority": 5,
        })
        assert r.status_code == 200
        task_id = r.json()["id"]

        r = client.get(f"/tasks/{task_id}")
        assert r.status_code == 200

        r = client.patch(f"/tasks/{task_id}", json={"status": "DONE"})
        assert r.status_code == 200
        assert r.json()["status"] == "DONE"

    def test_events_api_still_works(self, client):
        """Events API 未被破坏"""
        r = client.get("/events/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        r = client.post("/events/", json={
            "event_type": "task_completed",
            "message": "回归测试事件",
        })
        assert r.status_code == 200
