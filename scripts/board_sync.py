#!/usr/bin/env python3
from __future__ import annotations

import requests

"""
FoxBoard BOARD.md 同步脚本 (board_sync.py)

将 BOARD.md 中的任务条目同步到 FoxBoard 后端 SQLite 数据库。

用法：
  python3 board_sync.py [--board PATH] [--dry-run] [--verbose]

原理：
  1. 解析 BOARD.md，提取所有任务条目（状态≠DONE）
  2. 调用后端 API（已存在则 PATCH，不存在则 POST）
  3. 报告同步结果

环境变量：
  FOXBOARD_API_URL   后端地址（默认 http://localhost:8000）
  FOXBOARD_BOARD_PATH  BOARD.md 路径（默认从工作空间推断）
"""

import os
import re
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

# ---- 配置 ----
DEFAULT_API_URL = os.environ.get("FOXBOARD_API_URL", "http://localhost:8000")
WORKSPACE = Path.home() / ".openclaw" / "workspace"
DEFAULT_BOARD_PATH = WORKSPACE / "qinghu" / "projects" / "FoxBoard" / "BOARD.md"

# ---- 状态映射 ----
STATUS_EMOJI_MAP = {
    "REVIEW 🟡": "REVIEW",
    "TODO ⬜": "TODO",
    "DOING 🔵": "DOING",
    "BLOCKED 🔴": "BLOCKED",
    "DONE ✅": "DONE",
}

# ---- 解析器 ----

def _strip_status(status: str) -> str:
    """去除状态字段中的 emoji 装饰"""
    # 去掉常见 emoji 和空格
    cleaned = re.sub(r"[\U0001F300-\U0001FFFF\s]+", " ", status).strip()
    # 常见状态词
    for s in ("REVIEW", "TODO", "DOING", "BLOCKED", "DONE"):
        if s in cleaned.upper():
            return s.upper()
    return "TODO"


def extract_tasks(board_text: str) -> list[dict]:
    """从 BOARD.md Phase 2 活跃任务区域解析任务列表（不含 DONE 任务）"""
    tasks = []

    # 找到 ## 🔥 Phase 2 小节，到下一个 ## 标题或 ## 📦 归档之前的内容
    phase2_match = re.search(
        r"## 🔥 Phase 2.*?\n(.*?)(?=\n## |\Z)",
        board_text,
        re.DOTALL,
    )
    if not phase2_match:
        print("⚠️ 未找到 Phase 2 任务区域", file=sys.stderr)
        return []

    phase2_text = phase2_match.group(1)

    # 匹配 ### [TASK-XXX] 段落
    task_pattern = re.compile(
        r"### \[(TASK-FB-\d+)\] (.+?)\n((?:.*?\n)*?)(?=\n### |\n\n|\Z)",
        re.MULTILINE,
    )

    for m in task_pattern.finditer(phase2_text):
        task_id = m.group(1)
        title = m.group(2).strip()

        # 提取字段
        body = m.group(3)

        status = _strip_status(extract_field(body, "状态", "TODO"))
        assignee = extract_field(body, "分配", None)
        priority = parse_priority(extract_field(body, "优先级", "0"))
        description = extract_field(body, "描述", "")
        tags = extract_field(body, "标签", "")

        # 跳过 DONE 任务
        if status == "DONE":
            continue

        tasks.append({
            "id": task_id,
            "title": title,
            "description": description,
            "status": status,
            "assignee_id": assignee,
            "priority": priority,
            "tags": tags,
        })

    return tasks


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


# ---- API 客户端 ----

def api_url(path: str) -> str:
    return f"{DEFAULT_API_URL}{path}"


def get_task(task_id: str) -> dict | None:
    """GET /tasks/{id}"""
    try:
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
    payload = {}
    if "title" in task:
        payload["title"] = task["title"]
    if "description" in task:
        payload["description"] = task["description"]
    if "status" in task:
        # 只同步非终态
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
    parser = argparse.ArgumentParser(description="FoxBoard BOARD.md → SQLite 同步脚本")
    parser.add_argument("--board", type=Path, default=DEFAULT_BOARD_PATH,
                        help=f"BOARD.md 路径（默认 {DEFAULT_BOARD_PATH}）")
    parser.add_argument("--dry-run", action="store_true", help="只解析不写入")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细输出")
    args = parser.parse_args()

    # 读取 BOARD.md
    if not args.board.exists():
        print(f"❌ BOARD.md 不存在: {args.board}", file=sys.stderr)
        sys.exit(1)

    board_text = args.board.read_text(encoding="utf-8")
    print(f"📋 解析 BOARD.md: {args.board}")
    print(f"   API 地址: {DEFAULT_API_URL}")

    # 解析任务
    tasks = extract_tasks(board_text)
    print(f"   找到 {len(tasks)} 个待同步任务（不含 DONE）")

    if not tasks:
        print("✅ 没有需要同步的任务")
        return

    if args.dry_run:
        print("\n[DRY-RUN] 以下任务将被同步：")
        for t in tasks:
            print(f"  {t['id']} | {t['status']} | {t['title'][:40]} | 优先级 P{t['priority']}")
        return

    # 同步到 API
    try:
        import requests
    except ImportError:
        print("❌ requests 库未安装", file=sys.stderr)
        sys.exit(1)

    success = 0
    failed = 0
    for t in tasks:
        ok = sync_task(t)
        if ok:
            success += 1
        else:
            failed += 1

    print(f"\n📊 同步完成: {success} 成功, {failed} 失败")


if __name__ == "__main__":
    main()
