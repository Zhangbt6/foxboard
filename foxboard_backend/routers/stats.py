"""
项目统计路由 - stats
提供 Analytics 报表所需的后端数据支持：
- Burndown（燃尽图）
- Velocity（团队速度）
- Cycle Time（周期时间）
- Status Distribution（状态分布）
"""
from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
import sqlite3

from ..database import get_conn

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/burndown")
def get_burndown(
    project_id: str = Query(..., description="项目ID"),
    phase_id: Optional[str] = Query(None, description="Phase ID（单个, 已废弃，请用 phases）"),
    phases: Optional[str] = Query(None, description="逗号分隔的 Phase ID 列表"),
):
    """
    燃尽图数据
    返回每日剩余任务数（按完成时间）
    支持多 Phase 聚合：指定 phases=phase-12,phase-13 则合并显示
    不指定时默认取最近 2 个有 done 任务的 Phase
    """
    conn = get_conn()
    cursor = conn.cursor()

    # 解析 phase_id 列表
    if phases:
        phase_list = [p.strip() for p in phases.split(",") if p.strip()]
    elif phase_id:
        phase_list = [phase_id]
    else:
        # 默认：取最近 2 个有 done 任务的 phase（按最后完成时间排序）
        cursor.execute(f"""
            SELECT phase_id, MAX(completed_at) as last_done
            FROM tasks
            WHERE project_id = '{project_id}'
              AND phase_id IS NOT NULL
              AND status = 'DONE'
              AND completed_at IS NOT NULL
            GROUP BY phase_id
            ORDER BY last_done DESC
            LIMIT 2
        """)
        phase_list = [row["phase_id"] for row in cursor.fetchall()]
        if not phase_list:
            # 兜底：没有任何已完成的 phase，返回全 0
            phase_list = []

    # 构建过滤条件
    conditions = [f"project_id = '{project_id}'", "status IN ('TODO','DOING','REVIEW','DONE','BLOCKED')"]
    if phase_list:
        phase_filter = "(" + ",".join([f"'{p}'" for p in phase_list]) + ")"
        conditions.append(f"phase_id IN {phase_filter}")

    where_clause = " AND ".join(conditions)

    # 统计任务总数
    cursor.execute(f"SELECT COUNT(*) as total FROM tasks WHERE {where_clause}")
    total_count = cursor.fetchone()["total"]

    # 获取所有已完成任务，按完成日期分组
    cursor.execute(f"""
        SELECT date(completed_at) as date_str, COUNT(*) as done_count
        FROM tasks
        WHERE {where_clause}
          AND status = 'DONE'
          AND completed_at IS NOT NULL
        GROUP BY date_str
        ORDER BY date_str
    """)
    done_by_date = {row["date_str"]: row["done_count"] for row in cursor.fetchall()}

    # 生成日期范围（最近30天）
    result = []
    today = datetime.now().date()
    for i in range(30):
        d = today - timedelta(days=29 - i)
        d_str = d.isoformat()
        done = done_by_date.get(d_str, 0)
        remaining = total_count - done
        result.append({"date": d_str, "remaining_count": remaining})

    # 如果没有历史数据，补充最后一天的当前剩余
    if not done_by_date:
        result[-1] = {"date": today.isoformat(), "remaining_count": total_count}

    return {"data": result, "total_count": total_count}


@router.get("/velocity")
def get_velocity(
    project_id: str = Query(..., description="项目ID"),
    phases: Optional[str] = Query(None, description="逗号分隔的Phase ID列表"),
):
    """
    团队Velocity数据
    返回各Phase完成的任务数和平均周期时间
    """
    conn = get_conn()
    cursor = conn.cursor()

    result = []

    if phases:
        phase_list = [p.strip() for p in phases.split(",")]
    else:
        # 没有指定phases时，取最近4个有done任务的phase
        cursor.execute(f"""
            SELECT DISTINCT phase_id
            FROM tasks
            WHERE project_id = '{project_id}'
              AND phase_id IS NOT NULL
              AND status = 'DONE'
              AND completed_at IS NOT NULL
            ORDER BY phase_id DESC
            LIMIT 4
        """)
        phase_list = [row["phase_id"] for row in cursor.fetchall()]

    for phase_id in phase_list:
        # 完成数
        cursor.execute(f"""
            SELECT COUNT(*) as done_count
            FROM tasks
            WHERE project_id = '{project_id}'
              AND phase_id = '{phase_id}'
              AND status = 'DONE'
        """)
        done_count = cursor.fetchone()["done_count"] or 0

        # 平均周期时间（小时）：从创建到完成的平均时间
        cursor.execute(f"""
            SELECT AVG(
                (julianday(completed_at) - julianday(created_at)) * 24
            ) as avg_hours
            FROM tasks
            WHERE project_id = '{project_id}'
              AND phase_id = '{phase_id}'
              AND status = 'DONE'
              AND completed_at IS NOT NULL
              AND created_at IS NOT NULL
        """)
        row = cursor.fetchone()
        avg_cycle_time = round(row["avg_hours"], 1) if row["avg_hours"] else 0.0

        result.append({
            "phase_id": phase_id,
            "done_count": done_count,
            "avg_cycle_time_hours": avg_cycle_time,
        })

    return {"data": result}


@router.get("/cycle-time")
def get_cycle_time(
    project_id: str = Query(..., description="项目ID"),
    phase_id: Optional[str] = Query(None, description="Phase ID"),
):
    """
    周期时间统计
    返回 DOING -> DONE 的平均耗时（小时）
    """
    conn = get_conn()
    cursor = conn.cursor()

    conditions = [
        f"project_id = '{project_id}'",
        "status = 'DONE'",
        "started_at IS NOT NULL",
        "completed_at IS NOT NULL",
    ]
    if phase_id:
        conditions.append(f"phase_id = '{phase_id}'")

    where_clause = " AND ".join(conditions)

    cursor.execute(f"""
        SELECT AVG(
            (julianday(completed_at) - julianday(started_at)) * 24
        ) as avg_hours,
        MIN(
            (julianday(completed_at) - julianday(started_at)) * 24
        ) as min_hours,
        MAX(
            (julianday(completed_at) - julianday(started_at)) * 24
        ) as max_hours,
        COUNT(*) as sample_count
        FROM tasks
        WHERE {where_clause}
    """)

    row = cursor.fetchone()
    return {
        "avg_cycle_time_hours": round(row["avg_hours"], 1) if row["avg_hours"] else 0.0,
        "min_cycle_time_hours": round(row["min_hours"], 1) if row["min_hours"] else 0.0,
        "max_cycle_time_hours": round(row["max_hours"], 1) if row["max_hours"] else 0.0,
        "sample_count": row["sample_count"] or 0,
    }


@router.get("/status-distribution")
def get_status_distribution(
    project_id: str = Query(..., description="项目ID"),
    phase_id: Optional[str] = Query(None, description="Phase ID"),
):
    """
    任务状态分布
    返回各状态的任务数量
    """
    conn = get_conn()
    cursor = conn.cursor()

    conditions = [f"project_id = '{project_id}'"]
    if phase_id:
        conditions.append(f"phase_id = '{phase_id}'")

    where_clause = " AND ".join(conditions)

    cursor.execute(f"""
        SELECT status, COUNT(*) as count
        FROM tasks
        WHERE {where_clause}
        GROUP BY status
    """)

    rows = cursor.fetchall()
    total = sum(row["count"] for row in rows)

    return {
        "data": [{"status": row["status"], "count": row["count"]} for row in rows],
        "total": total,
    }
