"""
Task Context - 任务上下文自动打包
当员工领取（claim）任务时，自动构建该任务所需的完整上下文：
- 项目摘要
- 任务完整描述
- 推荐文档
- 依赖任务状态
- 最近活动记录
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .database import get_conn


# ---- 项目根目录推断 ----
def _get_workspace_root() -> Path:
    """推断 workspace root 路径"""
    # 从 foxboard_backend 往上两级到 repo，再往上一级到 workspace
    repo_root = Path(__file__).resolve().parent.parent
    return repo_root.parent


def _get_project_dir(project_name: str) -> Optional[Path]:
    """根据项目名推断项目目录路径"""
    ws_root = _get_workspace_root()
    proj_dir = ws_root / "black_fox" / "projects" / project_name
    if proj_dir.exists():
        return proj_dir
    return None


# ---- project_summary 提取 ----
def get_project_summary(project_name: str, db_description: Optional[str] = None) -> str:
    """
    获取项目摘要：优先从 PROJECT.md 读取前 500 字，否则用 db_description。
    """
    proj_dir = _get_project_dir(project_name)
    if proj_dir:
        project_md = proj_dir / "PROJECT.md"
        if project_md.exists():
            content = project_md.read_text(encoding="utf-8")
            # 去掉 markdown 标题和表格，只留正文前 500 字
            lines = content.split("\n")
            body_lines = [
                l for l in lines
                if l and not l.startswith("#") and not l.startswith("|")
                and not l.startswith(">")
            ]
            body = "\n".join(body_lines).strip()
            return body[:500].strip()

    if db_description:
        return db_description[:500].strip()

    return ""


# ---- recommended_docs 解析 ----
def get_recommended_docs(task_description: Optional[str], task_tags: Optional[str]) -> List[str]:
    """
    从 task.description 和 task.tags 中解析出文档路径。
    匹配形如 docs/xxx.md, refs/xxx, http://..., https://... 的引用。
    """
    docs = []
    seen = set()

    text = ""
    if task_description:
        text += task_description
    if task_tags:
        text += " " + task_tags

    # 匹配相对路径: docs/..., refs/..., tasks/...
    path_pattern = re.compile(r'\b(?:docs|refs|tasks|logs)/[^\s\)"\'#]+')
    for m in path_pattern.finditer(text):
        path = m.group().rstrip(".,;:)")
        if path not in seen:
            seen.add(path)
            docs.append(path)

    # 匹配 URL
    url_pattern = re.compile(r'https?://[^\s\)"\'<>]+')
    for m in url_pattern.finditer(text):
        url = m.group().rstrip(".,;:)")
        if url not in seen:
            seen.add(url)
            docs.append(url)

    return docs


# ---- depends_on_tasks 查询 ----
def get_depends_on_tasks(depends_on: Optional[str]) -> List[Dict[str, Any]]:
    """
    根据 depends_on 字段（逗号分隔的任务ID列表）查询任务状态。
    返回 [{id, title, status}]。
    """
    if not depends_on:
        return []

    task_ids = [tid.strip() for tid in depends_on.split(",") if tid.strip()]
    if not task_ids:
        return []

    conn = get_conn()
    cursor = conn.cursor()
    placeholders = ",".join(["?"] * len(task_ids))
    cursor.execute(
        f"SELECT id, title, status FROM tasks WHERE id IN ({placeholders})",
        task_ids
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {"id": row["id"], "title": row["title"], "status": row["status"]}
        for row in rows
    ]


# ---- recent_activity 查询 ----
def get_recent_activity(task_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    查询指定任务的最近 N 条 task_logs 记录。
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT agent_id, event_type, message, created_at
        FROM task_logs
        WHERE task_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    """, (task_id, limit))
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "agent_id": row["agent_id"],
            "event_type": row["event_type"],
            "message": row["message"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


# ---- 构建完整上下文 ----
def build_task_context(
    task_id: str,
    task_title: str,
    task_description: Optional[str],
    task_tags: Optional[str],
    task_depends_on: Optional[str],
    project_id: Optional[str],
    project_name: Optional[str] = None,
    db_description: Optional[str] = None,
    limit: int = 5,
) -> Dict[str, Any]:
    """
    构建任务的完整上下文字典。
    所有参数优先使用传入值（来自 DB row），以避免重复查询。

    Returns:
        dict with keys: project_summary, task_description, recommended_docs,
                        depends_on_tasks, recent_activity
    """
    # project_summary
    proj_name = project_name or (project_id or "")
    project_summary = get_project_summary(proj_name, db_description)

    # task_description
    task_desc = task_description or ""

    # recommended_docs
    recommended_docs = get_recommended_docs(task_description, task_tags)

    # depends_on_tasks
    depends_on_tasks = get_depends_on_tasks(task_depends_on)

    # recent_activity
    recent_activity = get_recent_activity(task_id, limit=limit)

    return {
        "project_summary": project_summary,
        "task_description": task_desc,
        "recommended_docs": recommended_docs,
        "depends_on_tasks": depends_on_tasks,
        "recent_activity": recent_activity,
    }
