# 仓库规范文档 — FoxBoard AI 工作室

> 定义 Git 分支命名、commit 规范、文档更新要求、发布检查项。
> 更新日期：2026-03-20

---

## 一、Git 分支命名规范

| 分支类型 | 命名格式 | 示例 |
|---------|---------|------|
| 功能分支 | feature/{任务ID}-{简短描述} | feature/TASK-012-research-module |
| 修复分支 | fix/{任务ID}-{简短描述} | fix/TASK-015-login-bug |
| 文档分支 | docs/{任务ID}-{简短描述} | docs/TASK-018-readme |
| 实验分支 | exp/{简短描述} | exp/new-frontend-framework |
| 主分支 | main | main |

**禁止**在 main 分支直接 commit。所有变更必须走 PR。

---

## 二、Commit 规范

格式：`{类型}({相关模块}): {简短描述} #{任务ID}`

类型前缀：
- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档更新
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 杂项（依赖、配置等）

示例：
```
feat(foxboard): add agent status API endpoint #TASK-003
fix(frontend): resolve state sync delay in idle mode #TASK-007
docs(readme): update deployment instructions #TASK-010
```

---

## 三、文档更新要求

1. **代码改动必须有文档对应**（README/CHANGELOG/内联注释三选一）
2. **新增模块必须在 docs/ 下创建说明文档**
3. **API 改动必须在 docs/API.md 更新接口说明**
4. **每次发布前检查清单**（由黑狐执行）：
   - [ ] README.md 是否反映最新状态
   - [ ] CHANGELOG.md 是否记录本次变更
   - [ ] 所有新增文件是否有内联注释
   - [ ] 依赖更新是否记录在 requirements.txt / package.json

---

## 四、发布检查项（黑狐负责）

在合并到 main 前必须确认：

**代码质量：**
- [ ] build 通过（`python3 -m py_compile` 或 `npm run build`）
- [ ] 所有测试通过（`pytest` 或 `npm test`）
- [ ] lint 通过（`flake8` / `eslint`）
- [ ] 无硬编码密码/密钥

**Git 规范：**
- [ ] commit 信息符合规范
- [ ] PR 有描述说明改动内容
- [ ] 分支已删除（合并后）

**文档：**
- [ ] README.md 更新
- [ ] CHANGELOG.md 记录
- [ ] 新增功能有使用说明

---

## 五、目录结构规范

```
{项目根目录}/
├── docs/               # 文档（必须）
│   ├── README.md       # 项目说明
│   ├── CHANGELOG.md    # 变更记录
│   └── API.md          # 接口文档（如有API）
├── src/ 或 {模块名}/   # 源代码
├── tests/              # 测试代码
├── scripts/            # 工具脚本
├── requirements.txt    # Python 依赖（Python项目）
├── package.json        # Node 依赖（前端项目）
└── .gitignore
```

---

## 六、版本号规范

采用语义化版本：`主版本.次版本.修订号`

- 主版本：架构重大调整
- 次版本：新增功能（向后兼容）
- 修订号：bug 修复（向后兼容）

当前版本：v0.1.0（初始开发版）

