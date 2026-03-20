# TASK-FB-006: Git / Build / 文档集成方案

## 基本信息
- **状态**: TODO ⬜
- **版本**: v0.1.0
- **分配**: 黑狐
- **优先级**: P2
- **创建**: 2026-03-20
- **依赖**: TASK-FB-003（后端骨架）+ TASK-FB-004（前端骨架）

## 目标
为 FoxBoard 项目建立 Git 规范、Build 验证流程、文档同步规则，由黑狐作为守门人严格执行。

## 输入
- `docs/repo_rules.md`（已由花火创建）
- FoxBoard 源码结构（青狐提供）

## 步骤
1. 在 FoxBoard 根目录初始化 Git 仓库（如尚未初始化）：
   ```bash
   git init
   git add .
   git commit -m "chore: initial FoxBoard v0.1.0 scaffold"
   ```
2. 创建标准 Git 分支命名规范：
   - `main`：稳定分支
   - `feature/TASK-FB-XXX`：功能分支
   - `fix/TASK-FB-XXX`：修复分支
3. 创建 `CONTRIBUTING.md`（commit 规范 + PR 流程）
4. 创建 pre-commit hook（build 检查 + lint）
5. 配置 `pytest.ini` / `pyproject.toml`（Python 后端测试）
6. 配置 `eslint` / `package.json scripts`（前端测试）
7. 验证后端 build 通过：`python -m py_compile app.py`
8. 验证前端 build 通过：`npm run build`

## 输出
- Git 仓库初始化完成
- `CONTRIBUTING.md`：贡献规范
- `pre-commit` hook：build + lint 检查
- `.gitignore`：标准忽略规则（node_modules/、__pycache__/、.env 等）
- 验证文档（pytest / npm test 可运行）

## 审核标准
- Git 仓库初始化完成，第一个 commit 已提交
- `git commit` 信息符合规范（feat/fix/docs/chore: description #TASK-ID）
- pre-commit hook 能捕获问题
- 后端 `python -m py_compile` 无报错
- 前端 `npm run build` 无报错
