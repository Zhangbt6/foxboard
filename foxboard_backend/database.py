"""
数据库模块 - SQLite 初始化与连接
使用纯 sqlite3，不依赖 SQLAlchemy
数据库文件：FoxBoard/data/foxboard.db
"""
import sqlite3
import os
from pathlib import Path

# 数据库文件路径（Notebook 项目目录）
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "foxboard.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def get_conn() -> sqlite3.Connection:
    """获取数据库连接（每次请求新建连接，SQLite 适合此模式）"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库表结构"""
    conn = get_conn()
    cursor = conn.cursor()

    # agents 表
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

    # projects 表
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

    # tasks 表（v0.4.0 新增 started_at / depends_on 字段）
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

    # task_logs 表（事件日志）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT,
            agent_id TEXT,
            event_type TEXT NOT NULL,
            message TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            FOREIGN KEY (agent_id) REFERENCES agents(id)
        )
    """)

    # workflows 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT NOT NULL DEFAULT '默认流程',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # workflow_node_states 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflow_node_states (
            workflow_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            task_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (workflow_id, node_id),
            FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )
    """)

    conn.commit()
    conn.close()
    print(f"[DB] 数据库初始化完成: {DB_PATH}")

def migrate_add_state_detail():
    """v0.5.0 迁移：agents 表新增 state_detail 字段"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(agents)")
    cols = [row[1] for row in cursor.fetchall()]
    if "state_detail" not in cols:
        cursor.execute("ALTER TABLE agents ADD COLUMN state_detail TEXT")
        print("[DB] 迁移：agents 表新增 state_detail 字段")
    conn.commit()
    conn.close()

def migrate_add_columns():
    """
    增量迁移：为已有表添加新字段（幂等）。
    """
    conn = get_conn()
    cursor = conn.cursor()
    # tasks 表增量字段
    extra_cols = [
        ("ALTER TABLE tasks ADD COLUMN started_at TEXT", "started_at"),
        ("ALTER TABLE tasks ADD COLUMN depends_on TEXT", "depends_on"),
        ("ALTER TABLE tasks ADD COLUMN archived_at TEXT", "archived_at"),
        ("ALTER TABLE tasks ADD COLUMN archive_phase TEXT", "archive_phase"),
        ("ALTER TABLE tasks ADD COLUMN archive_note TEXT", "archive_note"),
    ]
    cursor.execute("PRAGMA table_info(tasks)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    for col_def, col_name in extra_cols:
        if col_name not in existing_cols:
            try:
                cursor.execute(col_def)
                print(f"[DB] 迁移：tasks 表新增 {col_name} 字段")
            except Exception as e:
                print(f"[DB] 迁移跳过 {col_name}: {e}")
    conn.commit()
    conn.close()


def migrate_add_messages_and_reports():
    """v0.6.0 迁移：新增 messages 和 reports 表（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()

    # messages 表 — agent 间通信
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_agent TEXT NOT NULL,
            to_agent TEXT NOT NULL,
            subject TEXT,
            body TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'normal',
            ref_task_id TEXT,
            ref_project_id TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    # 收件箱查询索引
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent, is_read, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent, created_at)")

    # reports 表 — cron/agent 工作报告
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL,
            report_type TEXT NOT NULL DEFAULT 'cron_summary',
            session_id TEXT,
            summary TEXT NOT NULL,
            details TEXT,
            task_ids TEXT,
            project_id TEXT,
            status TEXT NOT NULL DEFAULT 'submitted',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_agent ON reports(agent_id, created_at)")

    conn.commit()
    conn.close()
    print("[DB] 迁移：messages + reports 表就绪")


def migrate_add_phases():
    """v0.8.0 迁移：新增 phases 表和 tasks.phase_id 列（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()

    # phases 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS phases (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            version TEXT,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'planning',
            goals TEXT,
            summary TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id)")

    # tasks 表新增 phase_id 列
    cursor.execute("PRAGMA table_info(tasks)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    if "phase_id" not in existing_cols:
        cursor.execute("ALTER TABLE tasks ADD COLUMN phase_id TEXT")
        print("[DB] 迁移：tasks 表新增 phase_id 字段")

    conn.commit()
    conn.close()
    print("[DB] 迁移：phases 表 + tasks.phase_id 列就绪")


def migrate_add_is_online():
    """v0.12.0 迁移：agents 表新增 is_online 字段（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(agents)")
    cols = [row[1] for row in cursor.fetchall()]
    if "is_online" not in cols:
        cursor.execute("ALTER TABLE agents ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0")
        print("[DB] 迁移：agents 表新增 is_online 字段")
    conn.commit()
    conn.close()

def migrate_add_capability_tags():
    """v0.12.0 迁移：agents 表新增 capability_tags 字段（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(agents)")
    cols = [row[1] for row in cursor.fetchall()]
    if "capability_tags" not in cols:
        cursor.execute("ALTER TABLE agents ADD COLUMN capability_tags TEXT DEFAULT ''")
        print("[DB] 迁移：agents 表新增 capability_tags 字段")
    conn.commit()
    conn.close()


def migrate_add_webhooks():
    """v0.13.0 迁移：新增 webhooks 和 webhook_deliveries 表（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()

    # webhooks 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS webhooks (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            events TEXT NOT NULL,
            secret TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            project_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # webhook_deliveries 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            webhook_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            response_code INTEGER,
            delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
        )
    """)

    print("[DB] 迁移：webhooks / webhook_deliveries 表创建完成")
    conn.commit()
    conn.close()


def migrate_add_indexes():
    """v0.14.0 迁移：新增任务和消息表索引以优化查询性能（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()

    indexes = [
        ("idx_tasks_project_id", "tasks", "project_id"),
        ("idx_tasks_status", "tasks", "status"),
        ("idx_tasks_phase_id", "tasks", "phase_id"),
        ("idx_tasks_assignee_id", "tasks", "assignee_id"),
        ("idx_tasks_project_status", "tasks", "project_id, status"),
        ("idx_tasks_phase_status", "tasks", "phase_id, status"),
        ("idx_tasks_assignee_status", "tasks", "assignee_id, status"),
        ("idx_tasks_archived", "tasks", "archived_at"),
        ("idx_tasks_completed_at", "tasks", "completed_at"),
        ("idx_tasks_started_at", "tasks", "started_at"),
        ("idx_messages_ref_task", "messages", "ref_task_id"),
        ("idx_messages_priority", "messages", "priority"),
    ]

    for idx_name, table, columns in indexes:
        cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({columns})")
        print(f"[DB] 索引 {idx_name} ON {table}({columns}) — 已创建/已存在")

    print("[DB] 迁移：任务和消息表索引创建完成")
    conn.commit()
    conn.close()


def migrate_add_agents_indexes():
    """v0.15.0 迁移：新增 agents 表索引以优化查询性能（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()

    indexes = [
        ("idx_agents_last_heartbeat", "agents", "last_heartbeat"),
        ("idx_agents_is_online", "agents", "is_online"),
        ("idx_agents_capability_tags", "agents", "capability_tags"),
    ]

    for idx_name, table, columns in indexes:
        cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({columns})")
        print(f"[DB] 索引 {idx_name} ON {table}({columns}) — 已创建/已存在")

    # task_logs 表索引（analytics 效率查询使用）
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_logs_event_type ON task_logs(event_type)")
    print("[DB] 索引 task_logs 相关 — 已创建/已存在")

    print("[DB] 迁移：agents 表索引创建完成")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    migrate_add_columns()
