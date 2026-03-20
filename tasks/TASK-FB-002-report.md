# TASK-FB-002-report.md - 竞品调研报告：开源项目管理看板

> 调研人：白狐
> 完成时间：2026-03-20
> 调研范围：5个主流开源/可参考方案

---

## 一、方案列表

| 方案 | 类型 | GitHub | Stars | 最后更新 | 许可证 |
|------|------|--------|-------|----------|--------|
| **Plane.so** | 开源自托管 | [makeplane/plane](https://github.com/makeplane/plane) | ~32k+ | 2026-03 (活跃) | AGPL v3 |
| **GitLab CE** | 开源全栈 | [gitlab-org/gitlab](https://gitlab.com/gitlab-org/gitlab) | ~48k (GitHub镜像) | 2026-03 (活跃) | MIT (CE) |
| **Metabase** | 开源BI看板 | [metabase/metabase](https://github.com/metabase/metabase) | ~43k | 2026-03 (活跃) | AGPL v3 |
| **Zenkit** | 闭源SaaS | 无开源 | - | 持续运营 | 商业 |
| **Star-Office-UI** | 像素风看板 | [ringhyacinth/Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI) | ~小众 | 2026-03 (活跃) | MIT |

---

## 二、功能对比表

| 方案 | 看板视图 | 甘特图 | 列表视图 | 成员状态 | 流程图 | 通知 | 实时能力 | AI集成 |
|------|----------|--------|----------|----------|--------|------|----------|--------|
| **Plane.so** | ✅ | ✅ | ✅ | ✅ 团队成员 | ❌ | ✅ Slack集成 | ✅ | ✅ Plane AI |
| **GitLab CE** | ✅ Issue Board | ❌ 付费 | ✅ | ✅ _assignee | ❌ | ✅ | ✅ WebSocket | ❌ |
| **Metabase** | ✅ Dashboard | ✅ | ❌ | ❌ | ❌ | ✅ 订阅/警报 | ✅ | ✅ Metabot |
| **Zenkit** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Star-Office-UI** | ❌ 改用状态区 | ❌ | ❌ | ✅ 多Agent | ❌ | ❌ | ✅ 轮询 | ❌ |

---

## 三、技术栈对比

| 方案 | 前端框架 | 后端/语言 | 数据库 | 实时方案 | 自托管难度 |
|------|----------|-----------|--------|----------|------------|
| **Plane.so** | React (React Router) | Python (Django) + Node.js | PostgreSQL + Redis | WebSocket | 中等（Docker） |
| **GitLab CE** | Vue.js (部分) | Ruby on Rails + Go | PostgreSQL | WebSocket + Puma | 高（需大资源） |
| **Metabase** | React | Clojure | 任意SQL DB | 轮询 | 低（jar单文件） |
| **Zenkit** | 不明 | 不明 | 不明 | WebSocket | 不适用（云服务） |
| **Star-Office-UI** | 原生HTML/JS | Python Flask | JSON文件 | 轮询/短轮询 | 极低（pip安装） |

---

## 四、详细分析

### 1. Plane.so（最推荐参考）

**定位**：Jira/Linear 开源替代，AI 原生项目管理平台

**优势**：
- 完整的多视图支持（Board/Spreadsheet/List/Gantt）
- 内置文档和知识库
- 敏捷开发支持（Sprint/Cycle/Backlog）
- Docker/K8s 一键部署
- 企业级安全（SOC2/ISO27001）
- AI 功能内置（非后期加装）

**劣势**：
- 技术栈重（Django + React Router）
- 部署复杂度中等
- 前端非纯 React SPA

**对 FoxBoard 的借鉴**：
- ✅ 多视图切换架构
- ✅ Cycle/Sprint 概念 → 可用于 Agent 任务周期管理
- ✅ Workspace + Project 两级结构
- ⚠️ AI Agent 任务自动分配（Plane AI）→ 自研

---

### 2. GitLab CE（可选参考）

**定位**：Code + CI/CD + Issue 一体化平台

**优势**：
- 代码与项目管理无缝衔接
- 内置 CI/CD 流水线
- 庞大的社区和企业用户
- MR 审核流完善

**劣势**：
- 资源消耗极大（建议 4C8G+）
- 看板功能相对基础
- 主要面向开发者

**对 FoxBoard 的借鉴**：
- ✅ Issue Board 拖拽交互
- ✅ Label + Milestone 管理
- ⚠️ CI/CD 集成（Phase 2 考虑）
- ❌ 不适合直接复用（太重）

---

### 3. Metabase（数据看板参考）

**定位**：商业智能 + 嵌入式分析

**优势**：
- 5 分钟快速安装
- 自然语言查询（NLQ）
- Dashboard 定制灵活
- 嵌入能力强

**劣势**：
- 非任务管理工具，是数据看板
- 工作流管理能力弱

**对 FoxBoard 的借鉴**：
- ✅ Dashboard 卡片布局
- ✅ 实时数据刷新机制
- ✅ 筛选/过滤器设计
- ❌ 任务管理逻辑不适用

---

### 4. Zenkit（UX参考）

**定位**：敏捷/看板/甘特图多功能协作

**优势**：
- 多视图即时切换
- 从 Trello/Asana 一键迁移
- 资源管理（工作量视图）
- 欧盟 GDPR 合规

**劣势**：
- 无开源版本，纯云服务
- 无 API 开放程度未知

**对 FoxBoard 的借鉴**：
- ✅ 看板 UX 设计（卡片拖拽）
- ✅ 多视图切换交互
- ✅ 团队工作量可视化
- ❌ 无法自托管，无参考价值

---

### 5. Star-Office-UI（像素风格直接参考）

**定位**：AI Agent 状态可视化办公室

**优势**：
- 像素风格 UI 独一无二
- 多 Agent 状态同步
- 中英日三语支持
- 桌面宠物模式
- 零学习成本部署

**劣势**：
- 非任务管理，是状态看板
- 不支持任务分配/跟踪
- 数据存储为 JSON（无数据库）

**对 FoxBoard 的借鉴**：
- ✅✅ **像素风格 UI 可直接复用**
- ✅✅ 多 Agent 状态区设计
- ✅ 昨日小记功能
- ⚠️ Flask 后端架构可参考（轻量）

---

## 五、推荐方案

### 🥇 第一推荐：Plane.so（功能架构参考）

**理由**：
1. 技术栈与 FoxBoard 接近（React + Python 后端可选 FastAPI）
2. 多视图（Board/List/Gantt）架构清晰，可直接借鉴
3. Agent/Project/Workspace 三层模型与 FoxBoard 四狐协作场景契合
4. AI 原生设计理念（Plane AI）与 FoxBoard Agent 管理目标一致

**建议借鉴点**：
- 多视图切换的前端架构
- Cycle/Sprint 任务周期管理
- Workspace 多团队隔离模型

### 🥈 第二推荐：Star-Office-UI（视觉风格参考）

**理由**：
1. 像素风格 UI 与 FoxBoard 目标完全吻合
2. 多 Agent 状态可视化是核心，与 FoxBoard 需求一致
3. 代码量小（Flask + 原生 JS），可快速理解并改造
4. 已有 OpenClaw 集成示例

**建议借鉴点**：
- ✅✅ 像素风桌面场景设计
- ✅ 状态区动画与 Agent 映射
- ✅ 中英日三语方案
- ✅ join-key 多 Agent 加入机制

---

## 六、FoxBoard 借鉴建议

| 功能模块 | 推荐来源 | 借鉴方式 |
|----------|----------|----------|
| **看板视图** | Plane.so | 借鉴多列拖拽 + 卡片详情展开 |
| **成员状态** | Star-Office-UI | 直接采用或二次开发像素风状态区 |
| **任务周期** | Plane.so | 引入 Cycle/Sprint 概念 |
| **前端技术选型** | Plane.so | React + React Router（参考） |
| **后端轻量方案** | Star-Office-UI | Flask + JSON文件 → 后续 FastAPI + SQLite |
| **视觉风格** | Star-Office-UI | 像素风角色 + 桌面场景 |
| **Dashboard** | Metabase | 卡片网格布局 + 实时刷新 |

---

## 七、不推荐的方案

| 方案 | 原因 |
|------|------|
| GitLab CE | 太重（需 4C8G+），主要面向代码托管，不适合轻量 Agent 管理 |
| Zenkit | 纯云服务，无开源版本，无法自托管 |

---

## 八、结论

1. **FoxBoard 前端架构**：参考 Plane.so 的多视图切换，借鉴 Star-Office-UI 的像素风格
2. **核心功能优先级**：看板（Board）> 成员状态 > 任务周期 > Dashboard
3. **技术选型**：React + Tailwind（前端）+ FastAPI + SQLite（后端）—— 与两方案都兼容
4. **快速MVP路径**：以 Star-Office-UI 为基础，改造成任务管理 + 状态可视化的混合看板

---

**报告完成。白狐，2026-03-20**
