# DELETE 销毁语义文档

> 维护人：黑狐 | 更新日期：2026-03-22
> 用途：明确 FoxBoard 任务删除操作的真删除（destroy）语义

---

## 一、DELETE 操作语义

### 规则：delete = 真删除（Destroy）

FoxBoard 的 `DELETE /tasks/{task_id}` 是**真删除**操作：

- 任务记录从 `tasks` 表中 **物理删除**（`DELETE FROM tasks`）
- 不做任何软标记（如 `archived_at`、`deleted_flag`）
- 删除后，任务**无法恢复**（无回收站）
- EventBus 发送 `task_deleted` 事件（异步通知订阅方）

### 返回值
```json
{
  "ok": true,
  "deleted": "FB-001",
  "mode": "destroyed"
}
```

| 字段 | 含义 |
|------|------|
| `ok` | 操作是否成功 |
| `deleted` | 被删除的任务 ID |
| `mode` | 固定为 `"destroyed"`，表明是物理删除 |

---

## 二、接口规格

### DELETE /tasks/{task_id}

**路径参数：**
- `task_id` (string, required)：任务 ID

**成功响应：** `200 OK`
```json
{"ok": true, "deleted": "FB-001", "mode": "destroyed"}
```

**错误响应：**
- `404`：任务不存在

---

## 三、与 ARCHIVE 的区别

| 维度 | DELETE（销毁） | POST /archive（归档） |
|------|--------------|---------------------|
| 数据库操作 | `DELETE` 物理删除 | `UPDATE` 设置 `archived_at` |
| 可恢复性 | 不可恢复 | 可通过 DB 查询恢复 |
| 事件类型 | `task_deleted` | `task_update`（含 archived_at） |
| 适用场景 | 错误创建、测试清理 | 任务完成后的正式收尾 |

---

## 四、测试覆盖

已验证场景（`tests/test_tasks.py`）：

| 测试 | 验证内容 |
|------|---------|
| `test_delete_existing_task` | 删除后 GET 返回 404（确认物理删除） |
| `test_delete_unknown_task_returns_404` | 不存在任务删除返回 404 |

---

## 五、注意事项

1. **删除前请三思**：真删除无回滚，误删只能重新创建
2. **不要在业务逻辑中频繁使用**：日常任务管理请用 `archive`
3. **EventBus 通知**：删除操作会触发 `task_deleted` 事件，订阅方需做好应对（如清理本地缓存）

---

## 六、迭代记录

| 日期 | 变更内容 | 负责人 |
|------|---------|--------|
| 2026-03-22 | 初稿，明确 delete=destroy 语义 | 黑狐 |
