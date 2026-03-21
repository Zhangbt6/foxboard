"""
工作报告路由 - cron/agent 执行报告
cron 隔离 session 执行完后提交报告，结果持久化可追溯
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime

from ..database import get_conn
from ..models import ReportSubmit, Report

router = APIRouter(prefix="/reports", tags=["reports"])


def _row_to_report(r) -> Report:
    return Report(
        id=r["id"],
        agent_id=r["agent_id"],
        report_type=r["report_type"],
        session_id=r["session_id"],
        summary=r["summary"],
        details=r["details"],
        task_ids=r["task_ids"],
        project_id=r["project_id"],
        status=r["status"],
        created_at=r["created_at"],
    )


@router.post("/", response_model=Report)
def submit_report(payload: ReportSubmit):
    """提交工作报告"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO reports (agent_id, report_type, session_id, summary, details,
                             task_ids, project_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
    """, (payload.agent_id, payload.report_type.value, payload.session_id,
          payload.summary, payload.details, payload.task_ids, payload.project_id, now))
    conn.commit()
    report_id = cursor.lastrowid
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.close()
    return _row_to_report(row)


@router.get("/", response_model=List[Report])
def list_reports(
    agent_id: Optional[str] = None,
    report_type: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 20,
):
    """查询工作报告"""
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM reports WHERE 1=1"
    params = []
    if agent_id:
        query += " AND agent_id = ?"
        params.append(agent_id)
    if report_type:
        query += " AND report_type = ?"
        params.append(report_type)
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [_row_to_report(r) for r in rows]


@router.get("/{report_id}", response_model=Report)
def get_report(report_id: int):
    """获取单份报告详情"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="报告不存在")
    return _row_to_report(row)


@router.get("/latest/{agent_id}", response_model=Optional[Report])
def get_latest_report(agent_id: str):
    """获取某 agent 最新一份报告"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1",
                   (agent_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"{agent_id} 暂无报告")
    return _row_to_report(row)
