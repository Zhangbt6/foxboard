"""
pytest tests for board_renderer.py
"""
import pytest
import tempfile
import os
import sqlite3
from pathlib import Path


@pytest.fixture
def temp_board_dir():
    """创建临时看板目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        board_path = Path(tmpdir) / "FoxBoard"
        board_path.mkdir()
        (board_path / "tasks").mkdir()
        yield board_path


@pytest.fixture
def seeded_db():
    """创建带测试数据的临时数据库"""
    fd, tmp_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(tmp_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 初始化 schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'worker',
            status TEXT NOT NULL DEFAULT 'idle',
            current_task_id TEXT,
            current_project_id TEXT,
            priority INTEGER DEFAULT 0,
            last_heartbeat TEXT,
            state_detail TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            owner TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'TODO',
            priority INTEGER DEFAULT 0,
            assignee_id TEXT,
            project_id TEXT,
            tags TEXT,
            started_at TEXT,
            depends_on TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT,
            agent_id TEXT,
            event_type TEXT NOT NULL,
            message TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    """)

    # 插入测试数据
    cursor.execute(
        "INSERT INTO projects (id, name, description) VALUES (?, ?, ?)",
        ("testproj", "测试项目", "用于测试的项目"),
    )
    cursor.execute(
        "INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, tags) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("TEST-001", "测试任务1", "## 目标\n完成测试\n\n## 完成标准\n通过测试\n",
         "TODO", 1, "qing_fox", "testproj", "Phase 7"),
    )
    cursor.execute(
        "INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, tags) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("TEST-002", "测试任务2", "## 目标\n也完成\n\n## 完成标准\n也通过\n",
         "DONE", 2, "hei_fox", "testproj", "Phase 7"),
    )
    conn.commit()
    conn.close()

    yield Path(tmp_path)

    try:
        os.unlink(tmp_path)
    except OSError:
        pass


class TestPriorityAndStatusHelpers:
    """测试辅助函数"""

    def test_priority_label(self):
        from foxboard_backend.board_renderer import _priority_label
        assert _priority_label(0) == "P0"
        assert _priority_label(1) == "P1"
        assert _priority_label(3) == "P3"
        assert _priority_label(99) == "P99"

    def test_status_icon(self):
        from foxboard_backend.board_renderer import _status_icon
        assert _status_icon("TODO") == "📋"
        assert _status_icon("DOING") == "🔵"
        assert _status_icon("REVIEW") == "🟡"
        assert _status_icon("DONE") == "✅"
        assert _status_icon("BLOCKED") == "🚫"
        assert _status_icon("UNKNOWN") == ""


class TestGroupByStatus:
    def test_groups_all_statuses(self):
        from foxboard_backend.board_renderer import _group_by_status
        tasks = [
            {"id": "T1", "status": "TODO"},
            {"id": "T2", "status": "DOING"},
            {"id": "T3", "status": "REVIEW"},
            {"id": "T4", "status": "DONE"},
            {"id": "T5", "status": "BLOCKED"},
        ]
        groups = _group_by_status(tasks)
        assert groups["TODO"] == [{"id": "T1", "status": "TODO"}]
        assert groups["DOING"] == [{"id": "T2", "status": "DOING"}]
        assert groups["REVIEW"] == [{"id": "T3", "status": "REVIEW"}]
        assert groups["DONE"] == [{"id": "T4", "status": "DONE"}]
        assert groups["BLOCKED"] == [{"id": "T5", "status": "BLOCKED"}]

    def test_empty_list(self):
        from foxboard_backend.board_renderer import _group_by_status
        groups = _group_by_status([])
        for v in groups.values():
            assert v == []


class TestExtractPhase:
    def test_phase_7(self):
        from foxboard_backend.board_renderer import _extract_phase
        t = {"tags": "Phase 7", "title": "", "description": ""}
        assert _extract_phase(t) == "Phase 7 (v0.7.0)"

    def test_phase_archived(self):
        from foxboard_backend.board_renderer import _extract_phase
        t = {"tags": "Phase 3", "title": "", "description": ""}
        assert _extract_phase(t) == "archived"

    def test_no_phase(self):
        from foxboard_backend.board_renderer import _extract_phase
        t = {"tags": "", "title": "普通任务", "description": ""}
        assert _extract_phase(t) is None


class TestParseTaskDescription:
    def test_parsed_fields(self):
        from foxboard_backend.board_renderer import _parse_task_description
        desc = (
            "## 目标\n完成测试\n\n"
            "## 完成标准\n测试通过\n\n"
            "## 推荐实现步骤\n第一步\n第二步\n\n"
            "## 参考文件\ndoc.md\n\n"
            "## 交付物\n代码\n\n"
            "## 审核提示（黑狐）\n检查逻辑\n\n"
            "## 审核人\n花火"
        )
        result = _parse_task_description(desc)
        assert result["goal"] == "完成测试"
        assert result["criteria"] == "测试通过"
        assert result["steps"] == "第一步\n第二步"
        assert result["references"] == "doc.md"
        assert result["deliverables"] == "代码"
        assert result["reviewer_notes"] == "检查逻辑"
        assert result["reviewer"] == "花火"

    def test_no_description(self):
        from foxboard_backend.board_renderer import _parse_task_description
        result = _parse_task_description("")
        assert result["goal"] == "（无描述）"


class TestGenerateBoardMd:
    def test_header_contains_timestamp(self, seeded_db, temp_board_dir):
        from foxboard_backend.board_renderer import generate_board_md
        import foxboard_backend.database as db_module
        original = db_module.DB_PATH
        db_module.DB_PATH = seeded_db

        try:
            content = generate_board_md("testproj", temp_board_dir)
            assert "# BOARD.md" in content
            assert "testproj" in content or "测试项目" in content
            assert "更新日期：" in content
            assert "TODO" in content
            assert "DONE" in content
        finally:
            db_module.DB_PATH = original


class TestRenderProject:
    def test_renders_board_and_tasks(self, seeded_db, temp_board_dir):
        import foxboard_backend.database as db_module
        original = db_module.DB_PATH
        db_module.DB_PATH = seeded_db

        try:
            from foxboard_backend.board_renderer import render_project
            result = render_project("testproj", temp_board_dir)
            assert result["task_count"] == 2
            assert "board" in result
            assert "board_path" in result

            # 检查 BOARD.md 写入
            assert (temp_board_dir / "BOARD.md").exists()

            # 检查任务卡写入
            assert (temp_board_dir / "tasks" / "TASK-TEST-001.md").exists()
            assert (temp_board_dir / "tasks" / "TASK-TEST-002.md").exists()
        finally:
            db_module.DB_PATH = original

    def test_task_card_preserves_human_notes(self, seeded_db, temp_board_dir):
        """人工备注区应被保留"""
        import foxboard_backend.database as db_module
        original = db_module.DB_PATH
        db_module.DB_PATH = seeded_db

        try:
            from foxboard_backend.board_renderer import generate_task_card, render_project

            # 第一次渲染
            render_project("testproj", temp_board_dir)

            # 人工添加备注
            task_path = temp_board_dir / "tasks" / "TASK-TEST-001.md"
            content = task_path.read_text()
            assert "<!-- 人工备注区" in content

            # 追加人工备注
            content = content.replace(
                "（人工备注区 - 供花火/黑狐添加人工说明）",
                "（人工备注区 - 供花火/黑狐添加人工说明）\n\n青狐备注：已完成核心逻辑开发。"
            )
            task_path.write_text(content)

            # 再次渲染，人工备注应保留
            generate_task_card(
                {"id": "TEST-001", "title": "测试任务1",
                 "description": "## 目标\n完成测试\n",
                 "status": "TODO", "priority": 1,
                 "assignee_id": "qing_fox", "project_id": "testproj",
                 "tags": "Phase 7", "depends_on": None,
                 "started_at": None, "created_at": "", "updated_at": "",
                 "completed_at": None},
                temp_board_dir,
            )
            content = task_path.read_text()
            assert "青狐备注：已完成核心逻辑开发" in content
        finally:
            db_module.DB_PATH = original


class TestEventBusRenderHook:
    def test_render_callback_is_settable(self):
        from foxboard_backend.event_bus import EventBus
        bus = EventBus()
        called = []

        def my_callback(project_id, board_path):
            called.append((project_id, board_path))

        bus.set_render_callback(my_callback)
        assert bus._render_callback is my_callback
