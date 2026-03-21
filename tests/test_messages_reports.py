"""
Messages + Reports API 测试
"""
import pytest
from fastapi.testclient import TestClient
from foxboard_backend.app import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestMessages:
    def test_send_message(self, client: TestClient):
        resp = client.post("/messages/", json={
            "from_agent": "qing_fox",
            "to_agent": "black_fox",
            "subject": "FB-047 开发完成",
            "body": "代码已写到工作区，请审核",
            "priority": "normal",
            "ref_task_id": "FB-047",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["from_agent"] == "qing_fox"
        assert data["to_agent"] == "black_fox"
        assert data["is_read"] is False
        assert data["id"] > 0

    def test_inbox_unread(self, client: TestClient):
        # 发两条给 black_fox
        client.post("/messages/", json={"from_agent": "qing_fox", "to_agent": "black_fox", "body": "msg1"})
        client.post("/messages/", json={"from_agent": "white_fox", "to_agent": "black_fox", "body": "msg2"})
        # 发一条给别人
        client.post("/messages/", json={"from_agent": "qing_fox", "to_agent": "fox_leader", "body": "msg3"})

        resp = client.get("/messages/", params={"to_agent": "black_fox", "unread_only": "true"})
        assert resp.status_code == 200
        msgs = resp.json()
        assert all(m["to_agent"] == "black_fox" for m in msgs)
        assert len(msgs) >= 2

    def test_mark_read(self, client: TestClient):
        resp = client.post("/messages/", json={"from_agent": "a", "to_agent": "b", "body": "hi"})
        msg_id = resp.json()["id"]

        resp = client.patch(f"/messages/{msg_id}/read")
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True
        assert resp.json()["read_at"] is not None

    def test_unread_count(self, client: TestClient):
        client.post("/messages/", json={"from_agent": "x", "to_agent": "counter_test", "body": "a"})
        client.post("/messages/", json={"from_agent": "y", "to_agent": "counter_test", "body": "b"})

        resp = client.get("/messages/unread-count", params={"to_agent": "counter_test"})
        assert resp.status_code == 200
        assert resp.json()["unread"] >= 2

    def test_mark_all_read(self, client: TestClient):
        client.post("/messages/", json={"from_agent": "x", "to_agent": "bulk_test", "body": "a"})
        client.post("/messages/", json={"from_agent": "y", "to_agent": "bulk_test", "body": "b"})

        resp = client.patch("/messages/read-all", params={"to_agent": "bulk_test"})
        assert resp.status_code == 200
        assert resp.json()["marked_read"] >= 2

        resp = client.get("/messages/unread-count", params={"to_agent": "bulk_test"})
        assert resp.json()["unread"] == 0

    def test_filter_by_priority(self, client: TestClient):
        client.post("/messages/", json={"from_agent": "a", "to_agent": "prio_test", "body": "low", "priority": "low"})
        client.post("/messages/", json={"from_agent": "a", "to_agent": "prio_test", "body": "urgent", "priority": "urgent"})

        resp = client.get("/messages/", params={"to_agent": "prio_test", "priority": "urgent"})
        assert resp.status_code == 200
        msgs = resp.json()
        assert all(m["priority"] == "urgent" for m in msgs)

    def test_mark_read_nonexistent(self, client: TestClient):
        resp = client.patch("/messages/999999/read")
        assert resp.status_code == 404


class TestReports:
    def test_submit_report(self, client: TestClient):
        resp = client.post("/reports/", json={
            "agent_id": "black_fox",
            "report_type": "review_report",
            "summary": "Phase 8 审核：8个任务全部FAIL，已打回",
            "details": "kanban测试失败 + 代码未commit",
            "task_ids": "FB-047,FB-048,FB-049",
            "project_id": "foxboard",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] == "black_fox"
        assert data["status"] == "submitted"
        assert data["id"] > 0

    def test_list_reports(self, client: TestClient):
        client.post("/reports/", json={"agent_id": "qing_fox", "summary": "开发完成"})
        client.post("/reports/", json={"agent_id": "black_fox", "summary": "审核完成"})

        resp = client.get("/reports/", params={"agent_id": "black_fox"})
        assert resp.status_code == 200
        reports = resp.json()
        assert all(r["agent_id"] == "black_fox" for r in reports)

    def test_get_report(self, client: TestClient):
        resp = client.post("/reports/", json={"agent_id": "test", "summary": "test report"})
        report_id = resp.json()["id"]

        resp = client.get(f"/reports/{report_id}")
        assert resp.status_code == 200
        assert resp.json()["summary"] == "test report"

    def test_get_report_nonexistent(self, client: TestClient):
        resp = client.get("/reports/999999")
        assert resp.status_code == 404

    def test_latest_report(self, client: TestClient):
        client.post("/reports/", json={"agent_id": "latest_test", "summary": "first"})
        client.post("/reports/", json={"agent_id": "latest_test", "summary": "second"})

        resp = client.get("/reports/latest/latest_test")
        assert resp.status_code == 200
        assert resp.json()["summary"] == "second"

    def test_latest_report_no_data(self, client: TestClient):
        resp = client.get("/reports/latest/nobody")
        assert resp.status_code == 404

    def test_cron_summary_type(self, client: TestClient):
        resp = client.post("/reports/", json={
            "agent_id": "qing_fox",
            "report_type": "cron_summary",
            "session_id": "abc-123",
            "summary": "本轮 cron：claim FB-060，开发完成提交REVIEW",
        })
        assert resp.status_code == 200
        assert resp.json()["report_type"] == "cron_summary"
        assert resp.json()["session_id"] == "abc-123"
