"""
数据库模块 - SQLite 初始化与连接
使用纯 sqlite3，不依赖 SQLAlchemy
数据库文件：FoxBoard/data/foxboard.db
"""
import sqlite3
import os
from pathlib import Path

# 数据库文件路径（Notebook 项目目录）
DB_PATH = Path("/home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/data/foxboard.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def get_conn() -> sqlite3.Connection:
    """获取数据库连接（每次请求新建连接，SQLite 适合此模式）"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # 支持列名访问
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

    # tasks 表
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

    conn.commit()
    conn.close()
    print(f"[DB] 数据库初始化完成: {DB_PATH}")

if __name__ == "__main__":
    init_db()
