#!/bin/bash
#===============================================
# 黑狐 FoxBoard 状态推送入口
# 用法：./push.sh <state> [detail] [--event EVENT] [--task TASK] [--priority PRIORITY]
#
# 示例：
#   ./push.sh reviewing "审核 TASK-FB-002" --event heartbeat --task TASK-FB-002
#   ./push.sh idle "待命中"
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOXPATH="$SCRIPT_DIR/FoxBoard/scripts/foxboard_push.py"

if [ ! -f "$FOXPATH" ]; then
    echo "❌ 未找到 foxboard_push.py: $FOXPATH"
    exit 1
fi

exec python3 "$FOXPATH" "$1" "$2" \
    --agent "黑狐" \
    --project "FoxBoard" \
    "${@:3}"
