# 任务归档规则文档 (Archive Rules)

> 维护人：黑狐 | 更新日期：2026-03-22
> 用途：明确 FoxBoard 任务归档的规则、接口行为与测试标准

---

## 一、归档核心规则

### 规则 1：只有 DONE 任务才能归档
- 归档前必须先将任务状态变更为 `DONE`
- 非 DONE 状态归档请求 → HTTP 400：`"只有 DONE 任务才能归档"`
- 已归档任务再次归档 → 返回 `{"ok": True, "message": "任务已归档"}`（幂等）

### 规则 2：归档字段
归档时必须提供以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `phase_label` | string | 归档阶段标签（如 `PHASE8`、`archived`），系统自动转大写 |
| `operator_id` | string | 执行归档操作的操作者 ID（如 `black_fox`） |
| `note` | string（可选） | 归档备注 |

归档后任务获得以下标记：

| 字段 | 说明 |
|------|------|
| `archived_at` | ISO8601 时间戳（UTC） |
| `archive_phase` | 大写阶段标签 |
| `archive_note` | 归档备注（可空） |

### 规则 3：归档任务从看板消失
- 任务 `archived_at` 非空后，默认查询（`archived_at IS NULL`）不再返回该任务
- 已归档任务不进入 Kanban 看板列

### 规则 4：归档记录追踪
- 每次归档操作会写入 `task_logs` 表（`_append_archive_record`）
- EventBus 发送 `task_update` 事件，携带 `archived_at` 和 `archive_phase` 变更

---

## 二、接口规格

### POST /tasks/{task_id}/archive

**请求体：**
```json
{
  "phase_label": "PHASE8",
  "operator_id": "black_fox",
  "note": "Phase 8 收尾归档"
}
```

**成功响应（201）：**
```json
{
  "ok": true,
  "archived": "FB-001",
  "phase": "PHASE8",
  "message": "任务已归档"
}
```

**错误响应：**
- `404`：任务不存在
- `400`：任务状态非 DONE

---

## 三、Phase 标签规范

| Phase 值 | 含义 |
|---------|------|
| `PHASE1` ~ `PHASE8` | 各阶段完成后的归档标签 |
| `archived` | 通用归档（无明确阶段） |
| `done` | 长期停滞任务的最终归档 |

---

## 四、测试覆盖要求

### 4.1 必测场景

| 场景 | 预期结果 |
|------|---------|
| DONE 任务归档 | HTTP 200，`archived_at` 非空 |
| DONE 任务重复归档 | HTTP 200（幂等），不报错 |
| 非 DONE 任务归档 | HTTP 400 |
| 不存在任务归档 | HTTP 404 |
| 归档后任务不在默认看板查询中 | 验证 `archived_at IS NULL` 查询不返回 |

### 4.2 测试文件
- `tests/test_archive_rules.py`（新建）

---

## 五、迭代记录

| 日期 | 变更内容 | 负责人 |
|------|---------|--------|
| 2026-03-22 | 初稿建立，明确归档接口规则与测试要求 | 黑狐 |
