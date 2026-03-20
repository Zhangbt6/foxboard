# TASK-FB-005: Agent 状态协议扩展设计

## 基本信息
- **状态**: TODO ⬜
- **版本**: v0.1.0
- **分配**: 花火 + 白狐
- **优先级**: P2
- **创建**: 2026-03-20
- **依赖**: TASK-FB-001（PRD定稿）

## 目标
设计四只狐狸接入 FoxBoard 的标准化状态协议，包括 heartbeat payload 扩展、事件类型定义、推送脚本规范。

## 输入
- PRD.md v1.1（Agent 状态协议章节）
- Star-Office-UI agent-push 机制分析

## 步骤
1. 设计扩展后的 heartbeat payload（含 task_id / project_id / priority / agent_name）
2. 定义完整事件类型：heartbeat / claim_task / update_task / submit_result / report_blocker / complete_task
3. 编写标准推送脚本规范（各狐狸通用 + 各狐狸独立入口）
4. 更新 `scripts/foxboard_push.py` 为通用版本
5. 为白狐、黑狐各写专属推送入口脚本

## 输出
- `docs/AGENT_PROTOCOL.md`：Agent 状态协议规范文档
- 更新的 `scripts/foxboard_push.py`（支持扩展 payload）
- `white_fox/push.sh` / `black_fox/push.sh`（各狐狸专属推送入口）

## 协议设计要点
```json
{
  "agent": "白狐",
  "event": "heartbeat",
  "project": "FoxBoard",
  "task": "TASK-FB-002",
  "status": "researching",
  "priority": "P2",
  "message": "正在调研 Plane.so 竞品方案",
  "timestamp": "2026-03-20T15:30:00+08:00"
}
```

## 审核标准
- payload 覆盖所有必要字段
- 文档包含完整示例
- 各狐狸推送脚本测试通过
