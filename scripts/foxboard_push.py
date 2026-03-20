#!/usr/bin/env python3
"""
FoxBoard 状态推送脚本 v2.0（通用版）

用法：
  python3 foxboard_push.py <state> [detail] [OPTIONS]

参数：
  state   工作阶段：idle | writing | researching | executing | syncing | reviewing | error
  detail  状态描述（可选）

选项：
  --agent      狐狸名称（默认：环境变量 FOXBOARD_AGENT_NAME 或 白狐）
  --event      事件类型（默认：heartbeat）
               可选：heartbeat | claim_task | update_task | submit_result | report_blocker | complete_task
  --task       任务 ID（默认：-）
  --project    项目 ID（默认：FoxBoard）
  --priority   优先级（默认：-）
  --no-office  跳过 Star-Office-UI 后端推送
  --json       仅输出 JSON，不写入文件

环境变量：
  FOXBOARD_STATE_FILE   本地状态文件路径
  FOXBOARD_OFFICE_URL    Star-Office-UI 后端地址（默认 http://127.0.0.1:19000）
  FOXBOARD_JOIN_KEY      Join Key（默认 foxboard_white_fox）
  FOXBOARD_AGENT_NAME    Agent 名称（默认 白狐）

事件说明：
  heartbeat      心跳保活（每15秒自动）
  claim_task     领取任务（开始执行新任务）
  update_task    更新任务状态（状态变更时）
  submit_result  提交交付物（进入 REVIEW）
  report_blocker 报告阻塞（遇到障碍）
  complete_task  完成任务（验收通过）
"""

import json
import os
import sys
import argparse
from datetime import datetime, timezone

# 默认本地状态文件
DEFAULT_STATE_FILE = "/home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/state.json"
STATE_FILE = os.environ.get("FOXBOARD_STATE_FILE", DEFAULT_STATE_FILE)

VALID_STATES = {
    "idle", "writing", "researching", "executing",
    "syncing", "reviewing", "error"
}

VALID_EVENTS = {
    "heartbeat", "claim_task", "update_task",
    "submit_result", "report_blocker", "complete_task"
}

STATE_ALIASES = {
    "working": "writing", "busy": "writing", "write": "writing",
    "run": "executing", "running": "executing", "execute": "executing",
    "research": "researching", "search": "researching", "调研": "researching",
    "sync": "syncing", "同步": "syncing",
    "review": "reviewing", "审核": "reviewing",
    "blocked": "error", "阻塞": "error",
}


def normalize_state(s):
    s = (s or "").strip().lower()
    if s in VALID_STATES:
        return s
    return STATE_ALIASES.get(s, "idle")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_payload(agent, event, state, detail, task, project, priority):
    """构建扩展 heartbeat payload"""
    return {
        "agent": agent,
        "event": event,
        "project": project,
        "task": task or "-",
        "status": state,
        "priority": priority or "-",
        "message": detail or "",
        "timestamp": now_iso()
    }


def write_local_state(payload, state_file=None):
    """写入本地 state.json（兼容旧格式 + 新格式）"""
    sf = state_file or STATE_FILE
    data = {
        "agent": payload["agent"],
        "state": payload["status"],
        "detail": payload["message"],
        "event": payload["event"],
        "task": payload["task"],
        "project": payload["project"],
        "priority": payload["priority"],
        "updated_at": payload["timestamp"]
    }
    os.makedirs(os.path.dirname(sf), exist_ok=True)
    with open(sf, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ 状态: {payload['status']} | {payload['message']}")
    print(f"📄 写入: {sf}")


def push_to_staroffice(payload):
    """推送到 Star-Office-UI 后端（向后兼容原始格式）"""
    office_url = os.environ.get("FOXBOARD_OFFICE_URL", "http://127.0.0.1:19000")
    join_key = os.environ.get("FOXBOARD_JOIN_KEY", "foxboard_white_fox")

    try:
        import requests
        # 兼容原始格式
        legacy_payload = {
            "name": payload["agent"],
            "joinKey": join_key,
            "state": payload["status"],
            "detail": payload["message"]
        }
        r = requests.post(f"{office_url}/agent-push", json=legacy_payload, timeout=5)
        if r.status_code in (200, 201):
            print(f"✅ 已同步至 Star-Office-UI ({office_url})")
        else:
            print(f"⚠️ 后端响应: {r.status_code} - {r.text[:100]}")
    except ImportError:
        print("⚠️ requests 库未安装，跳过 Star-Office-UI 推送")
    except Exception as e:
        print(f"⚠️ 后端推送失败: {e}")


def push_to_foxboard_api(payload):
    """推送到 FoxBoard 后端 API（扩展 payload）"""
    foxboard_url = os.environ.get("FOXBOARD_API_URL", "http://127.0.0.1:18000")
    try:
        import requests
        r = requests.post(f"{foxboard_url}/api/agent-push", json=payload, timeout=5)
        if r.status_code in (200, 201):
            print(f"✅ 已推送至 FoxBoard API ({foxboard_url})")
        else:
            print(f"⚠️ FoxBoard API 响应: {r.status_code}")
    except ImportError:
        pass
    except Exception as e:
        print(f"⚠️ FoxBoard API 推送失败: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="FoxBoard 状态推送脚本 v2.0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("state", nargs="?", default="idle", help="工作阶段")
    parser.add_argument("detail", nargs="?", default="", help="状态描述")
    parser.add_argument("--agent", default=os.environ.get("FOXBOARD_AGENT_NAME", "白狐"), help="狐狸名称")
    parser.add_argument("--event", default="heartbeat", help=f"事件类型: {', '.join(VALID_EVENTS)}")
    parser.add_argument("--task", default="-", help="任务 ID")
    parser.add_argument("--project", default="FoxBoard", help="项目 ID")
    parser.add_argument("--priority", default="-", help="优先级 P1/P2/P3")
    parser.add_argument("--no-office", action="store_true", help="跳过 Star-Office-UI 推送")
    parser.add_argument("--json", action="store_true", help="仅输出 JSON")
    parser.add_argument("--state-file", dest="state_file", default=STATE_FILE, help="状态文件路径")

    args = parser.parse_args()

    state = normalize_state(args.state)
    event = args.event if args.event in VALID_EVENTS else "heartbeat"
    agent = args.agent or "白狐"
    task = args.task or "-"
    project = args.project or "FoxBoard"
    priority = args.priority or "-"
    detail = args.detail

    payload = build_payload(agent, event, state, detail, task, project, priority)

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"🦊 [{agent}] {event} → {state}")
    write_local_state(payload, args.state_file)

    if not args.no_office:
        push_to_staroffice(payload)

    push_to_foxboard_api(payload)


if __name__ == "__main__":
    main()
