"""
test_event_bus - EventBus 单元测试
验证 emit 写入 DB + WebSocket 广播
"""
import pytest
import sys
sys.path.insert(0, ".")

from foxboard_backend.database import get_conn, init_db
from foxboard_backend.event_bus import event_bus, EventType


@pytest.fixture(autouse=True)
def setup_db():
    """每个测试前初始化数据库"""
    init_db()


def test_emit_writes_to_db():
    """验证 emit 写入 task_logs 表"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM task_logs")
    count_before = cursor.fetchone()["cnt"]
    conn.close()

    result = event_bus.emit(
        event_type=EventType.TASK_CLAIMED,
        task_id="test-task-eb-001",
        project_id="foxboard",
        actor_id="test_fox",
        payload={"message": "测试任务领取", "from_status": "TODO", "to_status": "DOING"},
    )

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM task_logs")
    count_after = cursor.fetchone()["cnt"]
    cursor.execute("SELECT * FROM task_logs WHERE id = ?", (result["_db_id"],))
    row = cursor.fetchone()
    conn.close()

    assert count_after == count_before + 1, "DB 记录数应 +1"
    assert row["event_type"] == "task_claimed"
    assert row["task_id"] == "test-task-eb-001"
    assert row["agent_id"] == "test_fox"
    assert result["_db_id"] == row["id"]


def test_emit_returns_event_object():
    """验证 emit 返回完整事件对象"""
    result = event_bus.emit(
        event_type=EventType.TASK_CREATED,
        task_id="test-task-eb-002",
        project_id="foxboard",
        actor_id="test_fox",
        payload={"message": "测试任务创建", "task_data": {"title": "测试"}},
    )

    assert "event_type" in result
    assert "project_id" in result
    assert "task_id" in result
    assert "actor_id" in result
    assert "timestamp" in result
    assert "payload" in result
    assert "_db_id" in result
    assert result["event_type"] == "task_created"
    assert result["project_id"] == "foxboard"


def test_task_created_helper():
    """验证 task_created 快捷方法"""
    result = event_bus.task_created(
        task_id="test-task-eb-003",
        project_id="foxboard",
        actor_id="test_fox",
        task_data={"id": "test-task-eb-003", "title": "测试任务"},
    )

    assert result["event_type"] == EventType.TASK_CREATED
    assert result["task_id"] == "test-task-eb-003"
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM task_logs WHERE id = ?", (result["_db_id"],))
    row = cursor.fetchone()
    conn.close()
    assert row is not None
    assert "被创建" in row["message"]


def test_task_claimed_helper():
    """验证 task_claimed 快捷方法"""
    result = event_bus.task_claimed(
        task_id="test-task-eb-004",
        project_id="foxboard",
        actor_id="test_fox",
    )

    assert result["event_type"] == EventType.TASK_CLAIMED
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM task_logs WHERE id = ?", (result["_db_id"],))
    row = cursor.fetchone()
    conn.close()
    assert row is not None
    assert "test_fox" in row["message"]


def test_task_review_passed_helper():
    """验证 task_review_passed 快捷方法"""
    result = event_bus.task_review_passed(
        task_id="test-task-eb-005",
        project_id="foxboard",
        auditor_id="black_fox",
    )

    assert result["event_type"] == EventType.TASK_REVIEW_PASSED
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM task_logs WHERE id = ?", (result["_db_id"],))
    row = cursor.fetchone()
    conn.close()
    assert row is not None
    assert "审核通过" in row["message"]


def test_task_review_failed_helper():
    """验证 task_review_failed 快捷方法"""
    result = event_bus.task_review_failed(
        task_id="test-task-eb-006",
        project_id="foxboard",
        auditor_id="black_fox",
        reason="代码不规范",
    )

    assert result["event_type"] == EventType.TASK_REVIEW_FAILED
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM task_logs WHERE id = ?", (result["_db_id"],))
    row = cursor.fetchone()
    conn.close()
    assert row is not None
    assert "代码不规范" in row["message"]


def test_agent_heartbeat_helper():
    """验证 agent_heartbeat 快捷方法"""
    result = event_bus.agent_heartbeat(
        agent_id="test_fox",
        status="busy",
        extra={"task_id": "test-task-eb-007"},
    )

    assert result["event_type"] == EventType.AGENT_HEARTBEAT
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM task_logs WHERE id = ?", (result["_db_id"],))
    row = cursor.fetchone()
    conn.close()
    assert row is not None
    assert row["agent_id"] == "test_fox"


def test_event_type_constants():
    """验证所有事件类型常量定义正确"""
    expected_types = [
        "task_created", "task_updated", "task_claimed", "task_submitted",
        "task_review_passed", "task_review_failed", "task_blocked",
        "task_activated", "task_timeout", "task_deleted",
        "project_created", "project_updated",
        "agent_registered", "agent_heartbeat", "agent_status_changed",
        "dependency_activated",
    ]
    for et in expected_types:
        assert hasattr(EventType, et.upper()), f"EventType.{et.upper()} missing"
        assert getattr(EventType, et.upper()) == et
