"""
数据分析路由 - efficiency analytics
提供团队效率统计 API
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query
from datetime import datetime, timedelta

from ..database import get_conn

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/efficiency")
def get_efficiency(
    project_id: Optional[str] = Query(None, description="按项目过滤"),
    date_range: Optional[str] = Query(None, description="日期范围过滤，如 7d/30d/90d"),
):
    """
    团队效率统计 API

    返回 per_agent 和 overall 数据：
    - 一次通过率 (first_pass_rate)
    - 平均完成周期 (avg_completion_hours)
    - 打回热点 (rejection_hotspots)
    """
    conn = get_conn()
    cursor = conn.cursor()

    # 日期过滤
    date_filter = ""
    if date_range:
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(date_range, 30)
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        date_filter = f"AND t.created_at >= '{cutoff}'"

    # 项目过滤
    project_filter = ""
    if project_id:
        project_filter = f"AND t.project_id = '{project_id}'"

    # ===== 1. 一次通过率 =====
    # 思路：DONE任务中，只经过1次review就通过的为一次通过
    # 一次通过的：task有 task_review_passed 事件，且该任务没有 task_review_failed 事件
    # 或者：task_review_failed 计数为0

    # 找出所有DONE任务的审核通过次数
    cursor.execute(f"""
        SELECT t.id, t.assignee_id,
               COUNT(CASE WHEN l.event_type = 'task_review_passed' THEN 1 END) as pass_count,
               COUNT(CASE WHEN l.event_type = 'task_review_failed' THEN 1 END) as fail_count
        FROM tasks t
        LEFT JOIN task_logs l ON l.task_id = t.id
        WHERE t.status = 'DONE'
        {project_filter}
        {date_filter}
        GROUP BY t.id
    """)
    done_tasks = cursor.fetchall()

    total_done = len(done_tasks)
    first_pass = sum(1 for r in done_tasks if r["fail_count"] == 0 and r["pass_count"] >= 1)
    first_pass_rate = round(first_pass / total_done * 100, 2) if total_done > 0 else 0.0

    # ===== 2. 平均完成周期 =====
    cursor.execute(f"""
        SELECT AVG(
            (julianday(completed_at) - julianday(created_at)) * 24
        ) as avg_hours
        FROM tasks t
        WHERE t.status = 'DONE'
          AND t.completed_at IS NOT NULL
          AND t.created_at IS NOT NULL
        {project_filter}
        {date_filter}
    """)
    row = cursor.fetchone()
    avg_completion_hours = round(float(row["avg_hours"] or 0), 2) if row else 0.0

    # ===== 3. 打回热点（按 agent 统计）=====
    cursor.execute(f"""
        SELECT t.assignee_id,
               COUNT(*) as rejection_count
        FROM task_logs l
        JOIN tasks t ON t.id = l.task_id
        WHERE l.event_type = 'task_review_failed'
        {project_filter}
        GROUP BY t.assignee_id
        ORDER BY rejection_count DESC
        LIMIT 5
    """)
    rejection_rows = cursor.fetchall()
    rejection_hotspots = [
        {"agent_id": r["assignee_id"], "rejection_count": r["rejection_count"]}
        for r in rejection_rows
        if r["assignee_id"]
    ]

    # ===== 4. per_agent 统计 =====
    cursor.execute(f"""
        SELECT
            t.assignee_id,
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN t.status = 'DONE' THEN 1 END) as done_tasks,
            AVG(CASE
                WHEN t.status = 'DONE' AND t.completed_at IS NOT NULL AND t.created_at IS NOT NULL
                THEN (julianday(t.completed_at) - julianday(t.created_at)) * 24
            END) as avg_hours
        FROM tasks t
        WHERE t.assignee_id IS NOT NULL
        {project_filter}
        {date_filter}
        GROUP BY t.assignee_id
    """)
    agent_rows = cursor.fetchall()

    per_agent = []
    for r in agent_rows:
        # 计算该 agent 的一次通过率
        cursor.execute(f"""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN fail_count = 0 AND pass_count >= 1 THEN 1 ELSE 0 END) as first_pass
            FROM (
                SELECT t.id,
                       COUNT(CASE WHEN l.event_type = 'task_review_passed' THEN 1 END) as pass_count,
                       COUNT(CASE WHEN l.event_type = 'task_review_failed' THEN 1 END) as fail_count
                FROM tasks t
                LEFT JOIN task_logs l ON l.task_id = t.id
                WHERE t.assignee_id = ? AND t.status = 'DONE'
                {project_filter}
                {date_filter}
                GROUP BY t.id
            )
        """, (r["assignee_id"],))
        rate_row = cursor.fetchone()
        fpr = round(float(rate_row["first_pass"] or 0) / float(rate_row["total"] or 1) * 100, 2)

        per_agent.append({
            "agent_id": r["assignee_id"],
            "total_tasks": r["total_tasks"],
            "done_tasks": r["done_tasks"],
            "avg_completion_hours": round(float(r["avg_hours"] or 0), 2),
            "first_pass_rate": fpr,
        })

    conn.close()

    return {
        "overall": {
            "first_pass_rate": first_pass_rate,
            "avg_completion_hours": avg_completion_hours,
            "total_done_tasks": total_done,
            "rejection_hotspots": rejection_hotspots,
        },
        "per_agent": per_agent,
        "filters": {
            "project_id": project_id,
            "date_range": date_range,
        },
    }
