# TASK-FB-008: 测试、验收与部署

## 基本信息
- **状态**: TODO ⬜
- **版本**: v0.1.0
- **分配**: 黑狐
- **优先级**: P1
- **创建**: 2026-03-20
- **依赖**: TASK-FB-003 + TASK-FB-004 + TASK-FB-006

## 目标
FoxBoard v0.1.0 MVP 完成前的最终验收：后端测试 + 前端测试 + Git 规范检查 + 部署验证。

## 输入
- TASK-FB-003 后端交付物
- TASK-FB-004 前端交付物
- TASK-FB-006 Git/Build 规范

## 步骤
1. 后端测试：
   - pytest 测试用例覆盖核心 API（agents / projects / tasks CRUD）
   - 验证 SQLite 数据库正常创建和读写
   - 测试 heartbeat payload 解析正确
2. 前端测试：
   - 页面可访问性检查（无 console error）
   - 看板拖拽/创建任务功能验证
   - 成员状态卡片数据展示正确
3. Git 规范检查：
   - 全部 commit 信息符合规范
   - 无硬编码密码/密钥
   - README / CHANGELOG 已更新
4. 验收报告：
   - 黑狐输出 `tasks/TASK-FB-008-review.md`
   - 包含 PASS/FAIL 结论 + 修复建议
5. 部署：
   - 后端部署方案（主人决定：本地 / 云服务器 / Cloudflare Tunnel）
   - 前端 build 产物部署
   - 通知主人访问地址

## 输出
- `tasks/TASK-FB-008-review.md`：黑狐验收报告
  - 测试用例执行结果（PASS/FAIL）
  - build 验证结果
  - Git 规范检查结果
  - 部署状态

## 审核标准（全部通过才标记 DONE）
- 后端 pytest 全部 PASS（或标记已知问题）
- 前端 npm run build 成功
- 无硬编码密钥
- README 包含启动说明
- CHANGELOG.md 有 v0.1.0 记录
- 主人可访问部署后的 FoxBoard
