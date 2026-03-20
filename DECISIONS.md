# DECISIONS.md - FoxBoard 关键决策记录

> 记录重要的技术决策和架构选择，供后续追溯。

---

## 已确认决策

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-03-20 | Star-Office-UI 保留，不直接扩展 | 前端是 Canvas 像素游戏，改造代价 ≈ 重写；并行建设更稳 |
| 2026-03-20 | 新建 React 前端，不复用 Star-Office-UI 前端 | Canvas 游戏无法扩展成任务看板 |
| 2026-03-20 | 后端用 FastAPI + SQLite | 轻量、易部署、够用；后期升级 PostgreSQL |
| 2026-03-20 | 复用 agent-push 协议 | Star-Office-UI 的 join-agent → agent-push 机制成熟，直接沿用 |
| 2026-03-20 | 四狐编制：花火(PM) / 白狐(调研) / 青狐(开发) / 黑狐(QA) | 职责边界清晰，互不串岗 |
| 2026-03-20 | 白狐、黑狐注册为独立 OpenClaw agent | 主人指令，完整隔离工作空间 |
| 2026-03-20 | 目录统一放 Notebook/70_花火项目/FoxBoard/ | 符合工作空间规范 |
| 2026-03-20 | TASK-FB-008 最终由黑狐执行验收 | 黑狐职责是守门人，测试验收是黑狐的核心职责 |
| 2026-03-20 | REVIEW 状态由黑狐负责审核（非花火） | 主人方案明确：DONE 前必须经黑狐 REVIEW，花火做最终确认 |
| 2026-03-20 | FoxComms 飞书通知改为触发文件模式 | CLI subprocess 调 openclaw 失败；改为写触发文件，花火主 session 兜底发送 |
| 2026-03-20 | 工作室定位为"个人数字实验室" | 非商业组织，围绕主人个人长期目标的 AI 协作团队 |
| 2026-03-20 | PRD 补充 workflows/workflow_node_states 表 | 流程图点亮功能（Phase 3）的数据基础 |
| 2026-03-20 | FoxComms v2：改用 `openclaw agent` CLI 唤醒 | 替代 inbox.json（覆盖写入会丢消息），降级用 JSONL 追加 |
| 2026-03-20 | TASK-FB-007 流程图 PoC 移至 Phase 3 | 不属于 MVP，Phase 1 聚焦"能看到能管理" |
| 2026-03-20 | Phase 1 数据模型精简为 3 表 | agents/tasks/task_logs 足够 MVP；projects/workflows 留 Phase 2-3 |
| 2026-03-20 | Phase 1 Event 类型只用 2 种 | heartbeat + task_update；Phase 2 再细分 6 种 |
| 2026-03-20 | 新增 Phase 5 远期规划 | 像素风办公室与 FoxBoard 融合（Star-Office-UI 素材替换） |

---

## 待确认决策

（暂无）

### D-003: MVP 阶段不使用 SQLAlchemy
- **日期**: 2026-03-20 16:40
- **决策**: 接受纯 sqlite3 实现后端 ORM 层
- **理由**: MVP 只有 3 张表，sqlite3 足够；SQLAlchemy 增加依赖复杂度，无明显收益
- **后续**: v0.2.0 若需 migration/多数据库支持再引入
