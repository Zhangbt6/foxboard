#!/usr/bin/env python3
"""
FoxBoard 多项目支持数据库迁移脚本
文件: docs/migration.sql
执行方式（任选其一）:
  1. python3 -c "exec(open('docs/migration.sql').read())"
  2. sqlite3 data/foxboard.db < docs/migration.sql
  3. python3 docs/migration.sql
"""
import sqlite3, os, sys

DB_PATH = "/home/muyin/.openclaw/workspace/repos/foxboard/data/foxboard.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # PHASE 1: 创建 project_members 表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS project_members (
            agent_id   TEXT NOT NULL,
            project_id TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT 'member'
                       CHECK(role IN ('owner', 'member', 'viewer')),
            joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (agent_id, project_id),
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    """)
    print("[OK] project_members 表已创建")

    # PHASE 2: 初始化 foxboard 项目成员（全部设为 owner）
    cur.execute("""
        INSERT OR IGNORE INTO project_members (agent_id, project_id, role)
        SELECT id, 'foxboard', 'owner'
        FROM agents
        WHERE id IN ('qing_fox', 'black_fox', 'white_fox', 'fox_leader')
    """)
    print(f"[OK] 项目成员初始化完成，受影响行数: {cur.rowcount}")

    # PHASE 3: 回填 tasks.project_id
    cur.execute("""
        UPDATE tasks
        SET project_id = 'foxboard'
        WHERE project_id IS NULL OR project_id = ''
    """)
    print(f"[OK] tasks.project_id 回填完成，受影响行数: {cur.rowcount}")

    # PHASE 4: 回填 phases.project_id
    cur.execute("""
        UPDATE phases
        SET project_id = 'foxboard'
        WHERE project_id IS NULL OR project_id = ''
    """)
    print(f"[OK] phases.project_id 回填完成，受影响行数: {cur.rowcount}")

    # 验证
    cur.execute("SELECT COUNT(*) FROM project_members")
    pm_count = cur.fetchone()[0]
    print(f"[验证] project_members 记录数: {pm_count}")

    conn.commit()
    conn.close()
    print("[完成] 迁移成功")

if __name__ == "__main__":
    migrate()
