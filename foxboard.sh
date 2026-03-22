#!/bin/bash
# FoxBoard 服务管理脚本
# 用法: ./foxboard.sh [start|stop|restart|status|logs]

CMD=${1:-status}

case $CMD in
  start)
    systemctl --user start foxboard-backend foxboard-frontend
    echo "✅ FoxBoard started"
    ;;
  stop)
    systemctl --user stop foxboard-backend foxboard-frontend
    echo "⏹ FoxBoard stopped"
    ;;
  restart)
    systemctl --user restart foxboard-backend foxboard-frontend
    echo "🔄 FoxBoard restarted"
    ;;
  status)
    echo "=== Backend ==="
    systemctl --user status foxboard-backend --no-pager -l | head -10
    echo ""
    echo "=== Frontend ==="
    systemctl --user status foxboard-frontend --no-pager -l | head -10
    ;;
  logs)
    echo "=== Backend (last 30) ==="
    journalctl --user -u foxboard-backend -n 30 --no-pager
    echo ""
    echo "=== Frontend (last 30) ==="
    journalctl --user -u foxboard-frontend -n 30 --no-pager
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
