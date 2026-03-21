#!/usr/bin/env python3
"""
FoxBoard BOARD.md 同步脚本 v2.0 (board_sync.py)

将 BOARD.md 中的任务条目同步到 FoxBoard 后端 SQLite 数据库。

支持格式：
  - Phase 7 表格格式（当前活跃格式）
  - Phase 2 段落格式（兼容旧格式）

用法：
  python3 board_sync.py [--board PATH] [--dry-run] [--verbose] [--cron]

环境变量：
  FOXBOARD_API_URL   后端地址（默认 http://localhost:8000）
  FOXBOARD_BOARD_PATH  BOARD.md 路径（默认从工作空间推断）
"""

from __future__ import annotations

import os
import re
import sys
import argparse
from pathlib import Path

# ---- 配置 ----
DEFAULT_API_URL = os.environ.get("FOXBOARD_API_URL", "http://localhost:8000")
WORKSPACE = Path.home() / ".openclaw" / "workspace"
DEFAULT_BOARD_PATH = WORKSPACE / "qinghu" / "projects" / "FoxBoard" / "BOARD.md"

# ---- 状态映射 ----
_STATUS_STRIP_RE = re.compile(r"[\U0001F300-\U0001FFFF\s]+")


def _strip_status(status: str) -> str:
    """去除状态字段中的 emoji 装饰，还原状态名"""
    cleaned = _STATUS_STRIP_RE.sub(" ", status).strip()
    for s in ("REVIEW", "TODO", "DOING", "BLOCKED", "DONE"):
        if s in cleaned.upper():
            return s.upper()
    return "TODO"


def _normalize_assignee(name: str) -> str | None:
    """将中文负责人名映射为 agent_id"""
    mapping = {
        "青狐": "qing_fox",
        "白狐": "bai_fox",
        "黑狐": "hei_fox",
        "花火": "fox_leader",
        "主人": "owner",
    }
    name = name.strip()
    return mapping.get(name, name if name else None)


# ---- Phase 7 表格解析器 ----

def _parse_markdown_table(text: str) -> list[list[str]]:
    """解析 markdown 表格，返回 cells[row][col]"""
    lines = text.strip().split("\n")
    rows = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("|") is False:
            continue
        # 去掉首尾 |
        inner = line.strip("|")
        cells = [c.strip() for c in inner.split("|")]
        rows.append(cells)
    # 跳过表头分隔行（第二行通常是 |---|---|）
    return rows


def _extract_table_tasks(phase_text: str) -> list[dict]:
    """从 Phase 7 表格格式提取任务"""
    tasks = []

    # 找到表格（从 ### 📊 进度总览 开始）
    table_match = re.search(r"### 📊 进度总览\s*\n(\|.*?(?=\n### |\n\n|\Z))", phase_text, re.DOTALL)
    if not table_match:
        return tasks

    table_text = table_match.group(1)
    rows = _parse_markdown_table(table_text)
    if len(rows) < 2:
        return tasks

    # 第一行是表头
    header = [c.lower() for c in rows[0]]
    try:
        idx_id = header.index("id")
        idx_task = header.index("任务")
        idx_assignee = header.index("负责人")
        idx_status = header.index("状态")
    except ValueError as e:
        print(f"  ⚠️ 表格列名不完整: {e}", file=sys.stderr)
        return tasks

    for row in rows[1:]:
        if len(row) <= max(idx_id, idx_task, idx_assignee, idx_status):
            continue
        task_id = row[idx_id].strip()
        title = row[idx_task].strip()
        assignee_raw = row[idx_assignee].strip()
        status_raw = row[idx_status].strip()

        status = _strip_status(status_raw)
        assignee_id = _normalize_assignee(assignee_raw)

        # 跳过 DONE 任务
        if status == "DONE":
            continue

        # ID 必须是 FB- 开头
        if not re.match(r"^FB-\d+$", task_id):
            continue

        tasks.append({
            "id": task_id,
            "title": title,
            "description": "",
            "status": status,
            "assignee_id": assignee_id,
            "priority": 0,
            "tags": "",
        })

    return tasks


# ---- Phase 2 段落解析器（兼容旧格式）----

def extract_field(body: str, field: str, default=None):
    """从任务体中提取指定字段"""
    pattern = re.compile(rf"- \*\*{re.escape(field)}\*\*: (.+?)(?:\n|$)", re.MULTILINE)
    m = pattern.search(body)
    if m:
        return m.group(1).strip().strip('"')
    return default


def parse_priority(p: str) -> int:
    """解析优先级字段"""
    p = p.strip()
    m = re.search(r"\d+", p)
    return int(m.group()) if m else 0


def _extract_paragraph_tasks(phase_text: str) -> list[dict]:
    """从 Phase 2 段落格式提取任务（向后兼容）"""
    tasks = []

    task_pattern = re.compile(
        r"### \[(TASK-FB-\d+)\] (.+?)\n((?:.*?\n)*?)(?=\n### |\n\n|\Z)",
        re.MULTILINE,
    )

    for m in task_pattern.finditer(phase_text):
        task_id = m.group(1)
        title = m.group(2).strip()
        body = m.group(3)

        status = _strip_status(extract_field(body, "状态", "TODO"))
        assignee_raw = extract_field(body, "分配", None)
        priority = parse_priority(extract_field(body, "优先级", "0"))
        description = extract_field(body, "描述", "")
        tags = extract_field(body, "标签", "")

        if status == "DONE":
            continue

        tasks.append({
            "id": task_id,
            "title": title,
            "description": description,
            "status": status,
            "assignee_id": _normalize_assignee(assignee_raw) if assignee_raw else None,
            "priority": priority,
            "tags": tags,
        })

    return tasks


# ---- 主解析入口 ----

def extract_tasks(board_text: str) -> list[dict]:
    """从 BOARD.md 解析所有任务（自动检测格式）"""
    # 找到所有 Phase 章节（🔥 表示活跃，✅ 表示已归档）
    # 优先处理最新的活跃 Phase
    phase_pattern = re.compile(
        r"(## 🔥 Phase (\d+).*?\n)(.*?)(?=\n## (🔥|✅) Phase |\Z)",
        re.DOTALL,
    )

    all_tasks = []
    active_phases = []

    for m in phase_pattern.finditer(board_text):
        phase_header = m.group(1)  # 完整标题行
        phase_num = int(m.group(2))
        phase_content = m.group(3)

        # 提取 Phase 标题中的版本信息
        version_match = re.search(r"\(v(\d+\.\d+\.\d+)\)", phase_header)
        version = version_match.group(1) if version_match else ""

        active_phases.append((phase_num, version, phase_content))

    if not active_phases:
        print("⚠️ 未找到任何 Phase 任务区域", file=sys.stderr)
        return []

    # 按 Phase 编号降序排列（优先新 Phase）
    active_phases.sort(key=lambda x: x[0], reverse=True)
    newest_phase_num, newest_version, newest_content = active_phases[0]

    print(f"   检测到 Phase {newest_phase_num} (v{newest_version}) 为最新活跃阶段", file=sys.stderr)

    # 优先尝试表格格式
    table_tasks = _extract_table_tasks(newest_content)
    if table_tasks:
        print(f"   使用表格格式解析，找到 {len(table_tasks)} 个任务", file=sys.stderr)
        all_tasks.extend(table_tasks)
    else:
        # 回退到段落格式
        paragraph_tasks = _extract_paragraph_tasks(newest_content)
        if paragraph_tasks:
            print(f"   使用段落格式解析，找到 {len(paragraph_tasks)} 个任务", file=sys.stderr)
            all_tasks.extend(paragraph_tasks)

    # 同时解析已归档 Phase 中的非 DONE 任务（通常是当前活跃的）
    for phase_num, version, phase_content in active_phases[1:]:
        if phase_num >= newest_phase_num:
            continue
        # 已归档 Phase 跳过 DONE 之外的任务同步（只同步当前 Phase）
        pass

    return all_tasks


# ---- API 客户端 ----

def api_url(path: str) -> str:
    return f"{DEFAULT_API_URL}{path}"


def get_task(task_id: str) -> dict | None:
    """GET /tasks/{id}"""
    try:
        import requests
        r = requests.get(api_url(f"/tasks/{task_id}"), timeout=10)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 404:
            return None
        r.raise_for_status()
    except Exception as e:
        print(f"  ⚠️ GET /tasks/{task_id} 失败: {e}", file=sys.stderr)
    return None


def create_task(task: dict) -> bool:
    """POST /tasks/"""
    import requests
    payload = {
        "id": task["id"],
        "title": task["title"],
        "description": task.get("description"),
        "priority": task.get("priority", 0),
        "assignee_id": task.get("assignee_id"),
        "project_id": "foxboard",
        "tags": task.get("tags"),
        "status": task.get("status", "TODO"),
    }
    try:
        r = requests.post(api_url("/tasks/"), json=payload, timeout=10)
        if r.status_code in (200, 201):
            print(f"  ✅ 创建任务 {task['id']}")
            return True
        if r.status_code == 400 and "UNIQUE constraint" in r.text:
            return update_task(task)
        print(f"  ⚠️ POST /tasks/ {task['id']} 失败: {r.status_code} {r.text[:100]}")
    except Exception as e:
        print(f"  ⚠️ POST /tasks/ {task['id']} 异常: {e}", file=sys.stderr)
    return False


def update_task(task: dict) -> bool:
    """PATCH /tasks/{id}"""
    import requests
    payload = {}
    if "title" in task:
        payload["title"] = task["title"]
    if "description" in task:
        payload["description"] = task["description"]
    if "status" in task:
        if task["status"] in ("TODO", "DOING", "REVIEW", "BLOCKED"):
            payload["status"] = task["status"]
    if "priority" in task:
        payload["priority"] = task["priority"]
    if "assignee_id" in task:
        payload["assignee_id"] = task["assignee_id"]
    if "tags" in task:
        payload["tags"] = task["tags"]

    if not payload:
        return True

    try:
        r = requests.patch(api_url(f"/tasks/{task['id']}"), json=payload, timeout=10)
        if r.status_code == 200:
            print(f"  🔄 更新任务 {task['id']}: {list(payload.keys())}")
            return True
        print(f"  ⚠️ PATCH /tasks/{task['id']} 失败: {r.status_code}")
    except Exception as e:
        print(f"  ⚠️ PATCH /tasks/{task['id']} 异常: {e}", file=sys.stderr)
    return False


def sync_task(task: dict) -> bool:
    """同步单个任务（存在则更新，不存在则创建）"""
    existing = get_task(task["id"])
    if existing:
        return update_task(task)
    else:
        return create_task(task)


# ---- 主逻辑 ----

def main():
    import requests

    parser = argparse.ArgumentParser(description="FoxBoard BOARD.md → SQLite 同步脚本 v2.0")
    parser.add_argument("--board", type=Path, default=DEFAULT_BOARD_PATH,
                        help=f"BOARD.md 路径（默认 {DEFAULT_BOARD_PATH}）")
    parser.add_argument("--dry-run", action="store_true", help="只解析不写入")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细输出")
    parser.add_argument("--cron", action="store_true", help="cron 模式（精简输出）")
    args = parser.parse_args()

    if not args.board.exists():
        print(f"❌ BOARD.md 不存在: {args.board}", file=sys.stderr)
        sys.exit(1)

    board_text = args.board.read_text(encoding="utf-8")

    if not args.cron:
        print(f"📋 解析 BOARD.md: {args.board}")
        print(f"   API 地址: {DEFAULT_API_URL}")

    tasks = extract_tasks(board_text)
    print(f"   找到 {len(tasks)} 个待同步任务（不含 DONE）")

    if not tasks:
        if not args.cron:
            print("✅ 没有需要同步的任务")
        return

    if args.dry_run:
        print("\n[DRY-RUN] 以下任务将被同步：")
        for t in tasks:
            print(f"  {t['id']} | {t['status']} | {t['title'][:40]} | {t.get('assignee_id','?')}")
        return

    success = 0
    failed = 0
    for t in tasks:
        ok = sync_task(t)
        if ok:
            success += 1
        else:
            failed += 1

    if args.cron:
        print(f"board_sync: {success} ok, {failed} failed")
    else:
        print(f"\n📊 同步完成: {success} 成功, {failed} 失败")


if __name__ == "__main__":
    main()
