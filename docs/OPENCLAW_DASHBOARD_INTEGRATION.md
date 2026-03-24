# OpenClaw Dashboard 集成指南

> FoxBoard 作为 OpenClaw 默认管理面板的集成方案

## 概述

本指南描述如何将 FoxBoard 嵌入 OpenClaw 作为主管理面板，实现统一的 Agent 监控、任务管理和项目进度追踪。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              OpenClaw Dashboard                     │  │
│  │  ┌──────────────┐  ┌───────────────────────────┐  │  │
│  │  │   Sidebar    │  │     FoxBoard Panel        │  │  │
│  │  │   (原生)     │  │     (iframe/embed)        │  │  │
│  │  └──────────────┘  └───────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 集成方式

### 方案一：URL 重定向（推荐）

将 OpenClaw Dashboard 的默认落地页重定向到 FoxBoard：

```json
// ~/.openclaw/openclaw.json
{
  "dashboard": {
    "defaultPanel": "foxboard",
    "panels": {
      "foxboard": {
        "type": "redirect",
        "url": "http://localhost:5173/",
        "title": "FoxBoard",
        "icon": "🦊"
      }
    }
  }
}
```

### 方案二：Canvas 嵌入

使用 OpenClaw 的 canvas/present 功能将 FoxBoard 作为主界面：

```bash
# 在 OpenClaw 启动时自动加载 FoxBoard
openclaw canvas present --url http://localhost:5173/ --fullscreen
```

### 方案三：反向代理集成

在 Nginx/Caddy 中将 OpenClaw 和 FoxBoard 路径合并：

```nginx
server {
    listen 80;
    server_name dashboard.local;
    
    # OpenClaw Gateway
    location /api/ {
        proxy_pass http://localhost:8080/;
    }
    
    # FoxBoard Frontend
    location / {
        proxy_pass http://localhost:5173/;
    }
}
```

## FoxBoard Dashboard 功能

### Agent 状态监控

FoxBoard Dashboard 提供四狐团队的实时监控：

| Agent | 角色 | 状态指标 |
|-------|------|----------|
| 🦊 花火 (fox_leader) | PM/指挥官 | 在线状态、当前任务、心跳时间 |
| 🦊 青狐 (qing_fox) | 开发工程师 | 代码产出、任务进度 |
| 🦊 白狐 (white_fox) | 设计/调研 | 调研产出、美术资源 |
| 🦊 黑狐 (black_fox) | 质量审核 | 审核队列、代码审查 |

### 项目进度追踪

- **总体进度**：已完成 Phases / 总 Phases
- **任务统计**：各状态任务数（TODO/DOING/REVIEW/DONE/BLOCKED）
- **优先级分布**：P10-P0 任务分布柱状图
- **事件流**：实时显示系统事件（任务创建、状态变更、Agent心跳等）

### 关键指标面板

```
┌────────────────────────────────────────────────────────────┐
│  总体进度 42%     任务总数 156    阻塞任务 3    超时任务 0   │
├────────────────────────────────────────────────────────────┤
│  [任务状态环形图]  [优先级柱状图]  [事件类型分布]            │
├────────────────────────────────────────────────────────────┤
│  📋 事件流                                                 │
│  🦊 fox_leader: task_update - FB-047 审核通过             │
│  🦊 qing_fox: agent_heartbeat - 忙碌中                    │
└────────────────────────────────────────────────────────────┘
```

## 配置示例

### OpenClaw 配置 (~/.openclaw/openclaw.json)

```json
{
  "gateway": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "dashboard": {
    "enabled": true,
    "defaultPanel": "foxboard",
    "refreshInterval": 30000,
    "panels": {
      "foxboard": {
        "type": "iframe",
        "url": "http://localhost:5173/",
        "title": "FoxBoard 项目管理",
        "icon": "🦊",
        "permissions": ["read:tasks", "read:agents", "read:phases"]
      },
      "system": {
        "type": "native",
        "component": "SystemStatus",
        "title": "系统状态",
        "icon": "⚙️"
      }
    }
  },
  "agents": {
    "heartbeatInterval": 60,
    "timeoutThreshold": 300
  }
}
```

### FoxBoard 后端配置 (foxboard_backend/.env)

```env
# Server
HOST=0.0.0.0
PORT=8000

# CORS (允许 OpenClaw 访问)
CORS_ORIGINS=http://localhost:5173,http://localhost:8080

# Database
DATABASE_URL=sqlite:///data/foxboard.db

# OpenClaw Integration
OPENCLAW_GATEWAY_URL=http://localhost:8080
OPENCLAW_API_KEY=your-api-key-here
```

## 启动顺序

```bash
# 1. 启动 FoxBoard 后端
cd ~/foxboard/foxboard_backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 2. 启动 FoxBoard 前端
cd ~/foxboard/frontend
npm run dev

# 3. 启动 OpenClaw Gateway
openclaw gateway start

# 4. 访问 Dashboard
open http://localhost:5173/  # FoxBoard 直接访问
# 或
open http://localhost:8080/   # OpenClaw Dashboard (若已配置重定向)
```

## 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| FoxBoard 页面空白 | 后端未启动或 CORS 错误 | 检查 `localhost:8000` 是否可访问，确认 CORS_ORIGINS 包含前端地址 |
| OpenClaw 无法加载 FoxBoard | iframe 安全策略阻止 | 配置 `X-Frame-Options: ALLOW-FROM` 或使用反向代理合并域名 |
| Agent 状态不更新 | WebSocket 连接失败 | 检查网络连接，确认 `useWebSocket` hook 正确配置重连逻辑 |
| 构建失败 | TypeScript 编译错误 | 运行 `npm run build` 查看具体错误，修复后重新构建 |

## 相关链接

- FoxBoard 代码仓库: `~/.openclaw/workspace/repos/foxboard/`
- OpenClaw 配置: `~/.openclaw/openclaw.json`
- FoxBoard API 文档: `http://localhost:8000/docs`
- FoxBoard 前端: `http://localhost:5173/`

---

**最后更新**: 2026-03-24
**维护者**: FoxBoard Team 🦊
