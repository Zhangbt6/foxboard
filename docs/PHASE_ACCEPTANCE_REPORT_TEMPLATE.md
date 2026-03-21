# FoxBoard 版本验收报告模板

> 本模板用于每个 Phase 完成后进行系统验收，确保交付质量。
> 维护人：黑狐 | 适用阶段：Phase 8+

---

## 一、基本信息

| 项目 | 内容 |
|------|------|
| **版本号** | Phase X |
| **验收日期** | YYYY-MM-DD |
| **验收人** | 黑狐 |
| **开发负责人** | 青狐 |
| **产品确认** | 花火姐姐 |

---

## 二、构建验证

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Python Backend 编译 | ✅ PASS / ❌ FAIL | `python -m py_compile` |
| Frontend 构建 | ✅ PASS / ❌ FAIL | `npm run build` |
| pre-commit hooks | ✅ PASS / ❌ FAIL | `git commit` 触发 |
| 测试套件 | ✅ PASS / ❌ FAIL | `pytest` 158/158 通过 |

---

## 三、功能验收

### 3.1 任务生命周期

| 场景 | 操作 | 预期结果 | 实际结果 |
|------|------|---------|---------|
| 创建任务 | POST /tasks | 201，任务已创建 | ✅/❌ |
| 状态流转 TODO→DOING | PATCH /tasks/{id} | 状态更新，事件推送 | ✅/❌ |
| 提交审核 DOING→REVIEW | submit_task | 状态更新，黑狐收到通知 | ✅/❌ |
| 审核通过 REVIEW→DONE | review_task | 状态更新，产出验收 | ✅/❌ |
| 审核拒绝 REVIEW→DOING | reject_task | 状态更新，打回原因记录 | ✅/❌ |

### 3.2 归档与删除

| 场景 | 操作 | 预期结果 | 实际结果 |
|------|------|---------|---------|
| DONE 任务归档 | POST /tasks/{id}/archive | `archived_at` 设置，任务从看板消失 | ✅/❌ |
| 非 DONE 任务归档 | POST /tasks/{id}/archive | HTTP 400 拒绝 | ✅/❌ |
| 任务真删除 | DELETE /tasks/{id} | 物理删除，GET 返回 404 | ✅/❌ |

### 3.3 双主视图

| 场景 | 操作 | 预期结果 | 实际结果 |
|------|------|---------|---------|
| 看板视图加载 | GET /tasks/kanban | 五列（TODO/DOING/REVIEW/DONE/BLOCKED） | ✅/❌ |
| 流程图视图加载 | GET /workflows | 七步骤节点正确渲染 | ✅/❌ |
| 流程图节点点击 | 点击节点 | 打开任务详情抽屉 | ✅/❌ |
| 看板拖拽改状态 | 拖拽任务 | WebSocket 推送状态变更 | ✅/❌ |

### 3.4 WebSocket 实时推送

| 场景 | 预期结果 | 实际结果 |
|------|---------|---------|
| 任务状态变更 | WS 推送 `task_update` | ✅/❌ |
| 审核请求提交 | WS 推送 `task_review_requested` | ✅/❌ |
| 工作流状态变更 | WS 推送 `workflow_state_changed` | ✅/❌ |

---

## 四、文档验收

| 文档 | 路径 | 状态 |
|------|------|------|
| 双主视图职责文档 | `docs/DUAL_MAIN_VIEW_RESPONSIBILITIES.md` | ✅ 已更新 |
| 归档规则文档 | `docs/ARCHIVE_RULES.md` | ✅ 已更新 |
| DELETE 销毁语义文档 | `docs/DELETE_SEMANTICS.md` | ✅ 已更新 |
| CHANGELOG 更新 | `CHANGELOG.md` | ✅/❌ 待更新 |

---

## 五、Git 规范检查

| 检查项 | 结果 |
|--------|------|
| commit message 格式 | ✅ 符合 `feat/fix/docs(type): description #TASK-ID` |
| 分支命名 | ✅ 符合 `feature/TASK-XXX-description` |
| .gitignore 配置 | ✅ 正确忽略 `node_modules`、`__pycache__` 等 |
| 无敏感信息泄露 | ✅ 无 API keys / tokens |

---

## 六、已知问题

（若无问题填写"无"）

| 问题描述 | 严重程度 | 状态 | 备注 |
|---------|---------|------|------|
| - | - | - | - |

---

## 七、最终结论

| 维度 | 结论 |
|------|------|
| **功能完整性** | ✅ 通过 / ❌ 不通过 |
| **代码质量** | ✅ 通过 / ❌ 不通过 |
| **文档完整性** | ✅ 通过 / ❌ 不通过 |
| **测试覆盖** | ✅ 通过 / ❌ 不通过 |
| **Git 规范** | ✅ 通过 / ❌ 不通过 |

### 综合结论

> **✅ 验收通过** / **❌ 验收不通过，需要修复以下问题后重新验收**

---

## 八、签名确认

| 角色 | 签名 | 日期 |
|------|------|------|
| 黑狐（验收人） | __________ | YYYY-MM-DD |
| 花火姐姐（产品确认） | __________ | YYYY-MM-DD |

---

## 附录：测试命令

```bash
# Backend 测试
cd ~/.openclaw/workspace/repos/foxboard
python3 -m pytest tests/ -v

# Frontend 构建验证
cd ~/.openclaw/workspace/repos/foxboard/frontend
npm run build

# Python 编译检查
python3 -m py_compile foxboard_backend/app.py
```
