"""
Phases 路由 - 项目阶段管理 API
提供 Phase CRUD + 状态流转 + 任务聚合统计
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException

from ..cache import cache

from ..database import get_conn
from ..models import PhaseCreate, PhaseUpdate, Phase, PhaseStatus

router = APIRouter(prefix="/phases", tags=["phases"])


def row_to_phase(row) -> Phase:
    """将数据库行转为 Phase 模型"""
    d = dict(row)
    # 解析聚合字段（如果存在）
    task_count = d.get("task_count", 0) or 0
    done_count = d.get("done_count", 0) or 0
    archived_count = d.get("archived_count", 0) or 0
    return Phase(
        id=d["id"],
        project_id=d["project_id"],
        name=d["name"],
        version=d.get("version"),
        description=d.get("description"),
        status=d.get("status", "planning"),
        goals=d.get("goals"),
        summary=d.get("summary"),
        started_at=d.get("started_at"),
        completed_at=d.get("completed_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        task_count=task_count,
        done_count=done_count,
        archived_count=archived_count,
    )


def _calc_phase_stats(cursor, phase_id: str) -> dict:
    """计算 phase 的任务统计"""
    cursor.execute(
        "SELECT status, COUNT(*) as cnt FROM tasks WHERE phase_id = ? GROUP BY status",
        (phase_id,)
    )
    rows = cursor.fetchall()
    stats = {"task_count": 0, "done_count": 0, "archived_count": 0}
    for r in rows:
        s = r["status"]
        c = r["cnt"]
        stats["task_count"] += c
        if s == "DONE":
            stats["done_count"] += c
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE phase_id = ? AND archived_at IS NOT NULL",
        (phase_id,)
    )
    row = cursor.fetchone()
    stats["archived_count"] = row["cnt"] if row else 0
    return stats


def _calc_all_phase_stats(cursor, phase_ids: list) -> dict:
    """
    批量计算多个 phase 的任务统计（解决 N+1 问题）。
    用单个查询获取所有 phase 的 status 分布，
    再用单个查询获取所有 phase 的 archived 计数。
    返回 {phase_id: {"task_count": N, "done_count": N, "archived_count": N}}
    """
    if not phase_ids:
        return {}

    placeholders = ",".join(["?"] * len(phase_ids))

    # 一次性获取所有 phase 的 status 分布
    cursor.execute(
        f"SELECT phase_id, status, COUNT(*) as cnt FROM tasks WHERE phase_id IN ({placeholders}) GROUP BY phase_id, status",
        phase_ids,
    )
    stats = {pid: {"task_count": 0, "done_count": 0, "archived_count": 0} for pid in phase_ids}
    for row in cursor.fetchall():
        pid = row["phase_id"]
        s = row["status"]
        c = row["cnt"]
        stats[pid]["task_count"] += c
        if s == "DONE":
            stats[pid]["done_count"] += c

    # 一次性获取所有 phase 的 archived 计数
    cursor.execute(
        f"SELECT phase_id, COUNT(*) as cnt FROM tasks WHERE phase_id IN ({placeholders}) AND archived_at IS NOT NULL GROUP BY phase_id",
        phase_ids,
    )
    for row in cursor.fetchall():
        stats[row["phase_id"]]["archived_count"] = row["cnt"]

    return stats


@router.get("/", response_model=List[Phase])
def list_phases(project_id: Optional[str] = None):
    """列出 phases，支持按 project_id 过滤"""
    # FB-301: 缓存逻辑
    cache_key = f"phases:{project_id or 'all'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return [Phase(**p) for p in cached]

    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT p.* FROM phases p WHERE 1=1"
    params = []
    if project_id:
        query += " AND p.project_id = ?"
        params.append(project_id)
    query += " ORDER BY p.created_at ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    result = []

    # 批量获取所有 phase 的统计（解决 N+1 问题）
    phase_ids = [row["id"] for row in rows]
    all_stats = _calc_all_phase_stats(cursor, phase_ids)

    for row in rows:
        stats = all_stats.get(row["id"], {"task_count": 0, "done_count": 0, "archived_count": 0})
        d = dict(row)
        d.update(stats)
        result.append(row_to_phase(d))
    conn.close()

    # FB-301: 写入缓存
    cache.set(cache_key, [r.model_dump() for r in result], ttl=300)

    return result


@router.get("/{phase_id}", response_model=Phase)
def get_phase(phase_id: str):
    """获取单个 phase（含任务统计）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Phase not found")
    stats = _calc_phase_stats(cursor, phase_id)
    d = dict(row)
    d.update(stats)
    conn.close()
    return row_to_phase(d)


@router.post("/", response_model=Phase)
def create_phase(payload: PhaseCreate):
    """创建新 phase"""
    conn = get_conn()
    cursor = conn.cursor()
    # 检查是否已存在
    cursor.execute("SELECT id FROM phases WHERE id = ?", (payload.id,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail=f"Phase {payload.id} 已存在")
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """
        INSERT INTO phases (id, project_id, name, version, description, status, goals, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.id,
            payload.project_id,
            payload.name,
            payload.version,
            payload.description,
            payload.status.value if hasattr(payload.status, 'value') else payload.status,
            payload.goals,
            now,
            now,
        )
    )
    conn.commit()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (payload.id,))
    row = cursor.fetchone()
    conn.close()

    # FB-301: 缓存失效
    cache.invalidate_phases()

    return row_to_phase(row)


@router.patch("/{phase_id}", response_model=Phase)
def update_phase(phase_id: str, payload: PhaseUpdate):
    """更新 phase（PATCH，字段可选）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Phase not found")
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.version is not None:
        updates["version"] = payload.version
    if payload.description is not None:
        updates["description"] = payload.description
    if payload.status is not None:
        updates["status"] = payload.status.value if hasattr(payload.status, 'value') else payload.status
    if payload.goals is not None:
        updates["goals"] = payload.goals
    if payload.summary is not None:
        updates["summary"] = payload.summary
    if not updates:
        conn.close()
        cache.invalidate_phases()
        return row_to_phase(row)
    updates["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    cursor.execute(
        f"UPDATE phases SET {set_clause} WHERE id = ?",
        (*updates.values(), phase_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    updated = cursor.fetchone()
    stats = _calc_phase_stats(cursor, phase_id)
    d = dict(updated)
    d.update(stats)
    conn.close()

    # FB-301: 缓存失效
    cache.invalidate_phases()

    return row_to_phase(d)


@router.post("/{phase_id}/activate", response_model=Phase)
def activate_phase(phase_id: str):
    """激活 phase：status → active, started_at = now"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Phase not found")
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE phases SET status = 'active', started_at = ?, updated_at = ? WHERE id = ?",
        (now, now, phase_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    updated = cursor.fetchone()
    stats = _calc_phase_stats(cursor, phase_id)
    d = dict(updated)
    d.update(stats)
    conn.close()

    # FB-301: 缓存失效
    cache.invalidate_phases()

    return row_to_phase(d)


@router.post("/{phase_id}/complete", response_model=Phase)
def complete_phase(phase_id: str):
    """完成 phase：检查所有任务已归档，status → completed"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Phase not found")
    # 检查是否所有任务都已归档
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE phase_id = ? AND archived_at IS NULL",
        (phase_id,)
    )
    r = cursor.fetchone()
    if r and r["cnt"] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail=f"还有 {r['cnt']} 个任务未归档，无法完成 Phase")
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE phases SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
        (now, now, phase_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM phases WHERE id = ?", (phase_id,))
    updated = cursor.fetchone()
    stats = _calc_phase_stats(cursor, phase_id)
    d = dict(updated)
    d.update(stats)
    conn.close()

    # FB-301: 缓存失效
    cache.invalidate_phases()

    return row_to_phase(d)


@router.get("/{phase_id}/tasks", response_model=List[dict])
def get_phase_tasks(phase_id: str):
    """获取 phase 下所有任务（含已归档）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM phases WHERE id = ?", (phase_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Phase not found")
    cursor.execute(
        "SELECT * FROM tasks WHERE phase_id = ? ORDER BY created_at ASC",
        (phase_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
