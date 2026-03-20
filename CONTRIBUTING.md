# 贡献指南 — FoxBoard AI 工作室

> 任何人向 FoxBoard 提交代码前，请先阅读本文档。
> 版本：v0.1.0 | 更新日期：2026-03-20

---

## 一、分支管理

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `main` | 稳定可发布版本 | 禁止直接 push，必须走 PR |
| `feature/TASK-FB-XXX` | 功能开发 | PR 合并到 main 后删除 |
| `fix/TASK-FB-XXX` | bug 修复 | 同上 |
| `docs/TASK-FB-XXX` | 文档更新 | 同上 |

**禁止在 main 分支直接 commit。**

---

## 二、Commit 规范

格式：`{类型}({模块}): {简短描述} #{任务ID}`

| 类型 | 使用场景 |
|------|----------|
| `feat:` | 新功能 |
| `fix:` | bug 修复 |
| `docs:` | 文档更新 |
| `refactor:` | 重构（不改变功能） |
| `test:` | 测试相关 |
| `chore:` | 杂项（依赖、配置、构建） |

**示例：**
```
feat(backend): add heartbeat API endpoint #TASK-003
fix(frontend): resolve status sync delay #TASK-007
docs(readme): update deployment instructions #TASK-010
chore: add pre-commit hook #TASK-006
```

---

## 三、PR 流程

1. 从 `main` 创建功能分支：`git switch -c feature/TASK-FB-XXX`
2. 完成开发，执行本地检查：
   ```bash
   python -m py_compile .
   npm run build  # 前端有改动时
   ```
3. Commit（符合规范）
4. Push 并创建 PR，描述：
   - 改动了什么
   - 对应哪个任务
   - 测试结果
5. 等待黑狐 REVIEW + 花火 APPROVE

---

## 四、本地检查清单（PR 前必须通过）

**后端：**
```bash
python -m py_compile app.py
flake8 . --max-line-length=120 --ignore=E501
```

**前端：**
```bash
npm run build
```

**黑狐 REVIEW 门禁：**
- build 失败 → PR BLOCKED
- commit 信息不规范 → PR BLOCKED
- 文档未更新 → PR BLOCKED

---

## 五、审核流程

1. 执行人完成开发 → 提交 PR → 通知黑狐
2. 黑狐执行 REVIEW（在 `projects/BOARD.md` 领取）
3. PASS → 花火 APPROVE → 合并到 main
4. FAIL → 打回，修复后重新提交

---

## 六、文档要求

- 代码改动必须有文档对应（README/CHANGELOG/内联注释三选一）
- 新增模块在 `docs/` 下创建说明文档
- API 改动更新 `docs/API.md`

---

## 七、问题反馈

遇到不明确的情况，请联系花火姐姐。
