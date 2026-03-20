# FoxBoard Frontend

React + TypeScript + Vite + Tailwind 前端骨架。

## 技术栈

- React 19 + TypeScript
- Vite 8（构建工具）
- Tailwind CSS v4（样式）
- React Router v7（路由）
- Lucide React（图标）
- Axios（API 调用）

## 快速启动

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

## 页面

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 项目进度 + 风险卡片 + 今日动态 |
| `/kanban` | 任务看板 | 四列（TODO/DOING/REVIEW/DONE）可点击推进任务 |
| `/agents` | 成员状态 | 四只狐狸状态卡片 |

## 前端联调

前端调用后端 API：`http://localhost:8000`

后端必须先启动：
```bash
cd foxboard_backend
python -m uvicorn foxboard_backend.app:app --port 8000
```

## 构建

```bash
npm run build   # 产物在 dist/
npm run preview # 预览构建结果
```
