# MyTasks 页面下线方案

> 维护人：黑狐 | 日期：2026-03-22 | 关联任务：FB-054
> 用途：明确「我的任务」页面下线方案、迁移影响与看板替代策略

---

## 一、当前状态

### MyTasks 页面（`frontend/src/pages/MyTasks.tsx`）

- **状态**：已废弃只读（2026-03-22 完成）
- 页面顶部提示：`安全只读视图。自动推进状态已禁用；后续将并入主看板。`
- 点击任务自动推进功能：**已禁用**
- 数据刷新：每 10 秒轮询（保留，不影响功能）

### 下线原因

1. **功能重复**：看板（Kanban）已具备成员筛选、状态筛选、优先级筛选（FB-055）
2. **维护成本**：两套视图增加前端维护负担
3. **用户困惑**：同一数据两种展示方式，行为不一致

---

## 二、替代方案：看板筛选能力

Phase 8 完成的 **FB-055 看板筛选能力补强**已提供完整替代：

### 成员筛选
- 看板 Header 成员选择器 → 筛选指定成员的任务
- 等同于 MyTasks 的「只看我的」功能

### 状态筛选
- 看板支持按 TODO/DOING/REVIEW/DONE/BLOCKED 筛选
- 等同于 MyTasks 的状态分组切换

### 优先级筛选
- 看板支持按优先级筛选
- MyTasks 无此功能（增强点）

---

## 三、迁移清单

| 步骤 | 操作 | 影响范围 | 预计时间 |
|------|------|---------|---------|
| 1 | MyTasks 页面标记 `// @deprecated` 并替换为 Kanban 路由重定向 | 前端路由 | 5 min |
| 2 | 更新 Sidebar 导航，移除 MyTasks 入口 | 前端导航 | 5 min |
| 3 | 更新 `DUAL_MAIN_VIEW_RESPONSIBILITIES.md`，明确 Kanban 为唯一主视图 | 文档 | 5 min |
| 4 | 确认所有成员已会使用看板成员筛选 | 文档/通知 | - |
| 5 | 执行物理删除 MyTasks.tsx 文件 | 前端代码 | 5 min |
| 6 | 提交 git commit 并通知花火验收 | - | - |

---

## 四、路由重定向方案

在 `App.tsx` 中将 `/my-tasks` 重定向至 `/kanban`：

```tsx
// App.tsx
<Route path="/my-tasks" element={<Navigate to="/kanban" replace />} />
```

---

## 五、Timeline

- **Phase 8 完成时**：MyTasks 已废弃只读 ✅（已完成）
- **Phase 9**：执行上述迁移清单步骤 1-6
- **Phase 10+**：确认无使用量后正式删除代码

---

## 六、已验证可删除文件

| 文件 | 用途 | 删除时机 |
|------|------|---------|
| `frontend/src/pages/MyTasks.tsx` | 我的任务页面 | 步骤 5 确认无 broken link 后 |
| `frontend/src/hooks/useInterval.ts` | 轮询 hook（仅 MyTasks 使用） | 确认无其他 consumer 后 |

---

## 七、回滚方案

如迁移后发现问题，可通过以下方式快速回滚：
1. 从 git 历史恢复 `MyTasks.tsx`
2. 恢复 Sidebar 导航入口
3. 恢复路由配置

**无数据库迁移风险**（任务数据全部保留在 tasks 表）

---

## 八、负责人

- 方案制定：黑狐（FB-054）
- 执行：青狐
- 验收：黑狐 + 花火最终确认
