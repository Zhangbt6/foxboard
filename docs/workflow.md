# 工作流程文档 — FoxBoard AI 工作室

> 定义需求如何进入、谁拆任务、谁执行、谁 review、谁汇报。
> 更新日期：2026-03-20

---

## 一、标准协作流程（6步）

```
Step 1: 主人提需求
Step 2: 花火立项（拆任务、指定负责人）
Step 3: 白狐前置调研（如需要）
Step 4: 青狐开发实现
Step 5: 黑狐 Review 验收
Step 6: 花火汇总回报主人
```

---

## 二、每一步详细说明

### Step 1：主人提需求
- 主人描述需求（口头、文档或飞书消息）
- 花火接收并重述需求，确保理解准确

### Step 2：花火立项
- 写任务描述（tasks/TASK-XXX.md）
- 拆成子任务
- 指定 Owner（白狐/青狐/黑狐）
- 排优先级（P1/P2/P3）
- 入看板（BOARD.md）
- **FoxComms 派单**（自动写入 COMMS.md + 触发 agent + 飞书群通知）

### Step 3：白狐前置调研
- 搜集参考资料（竞品、案例、模板）
- 整理资源清单
- 输出调研报告
- **FoxComms 汇报花火**
- 交付物：调研报告 / 资源索引 / 方案对比表

### Step 4：青狐开发实现
- 根据任务单和调研包实现编码/页面/功能/脚本
- 自测通过后更新 BOARD.md：DOING → REVIEW
- **FoxComms 汇报花火**
- 交付物：代码 / 功能结果 / 说明文档 / 待处理问题列表

### Step 5：黑狐 Review 验收
- build 是否通过
- Git 分支/提交是否规范
- 文档是否更新
- 是否符合任务要求
- 输出 PASS/FAIL + 修改意见
- PASS → BOARD.md 状态改 DONE；FAIL → 打回 DOING
- **FoxComms 汇报花火**
- 交付物：测试记录 / 验收意见 / 文档更新记录

### Step 6：花火汇总回报
- 确认 DONE
- 向主人汇报：做了什么、当前状态、需要主人拍板什么

---

## 三、紧急/临时任务流程

```
主人 → 青狐/黑狐（直接派）
      ↓ 完成后
   FoxComms 通知花火（花火知情 + 看板补录）
```

适用场景：修 bug、紧急 hotfix、文件查找等小任务（预计 < 30 分钟）。
**规则**：完成后必须通过 FoxComms 通知花火，花火补录看板。

---

## 四、通信机制（FoxComms）

所有正式通信统一通过 FoxComms：

```python
from foxcomms import FoxComms
FoxComms().send("白狐", "TASK-FB-002 竞品调研，P2，请查收")  # 派单
FoxComms().send("花火", "TASK-FB-003 已完成，请审核")        # 汇报
```

FoxComms 自动完成：
1. 写入 `COMMS.md`（时间倒序，持久记录）
2. 触发对应 agent inbox
3. 发送飞书工作群通知（主人可见）

花火在主 session 中使用 OpenClaw `message` 工具发送飞书群通知（FoxComms CLI 模式飞书通知由花火主 session 兜底）。

---

## 五、项目生命周期

```
提案 → 立项 → 执行 → Review → 完成 → 归档
         ↑                    ↓
       BLOCKED             logs/ 归档 + 复盘
```

每个里程碑完成时花火向主人汇报一次。
