# FoxComms - 统一通信工具

## 一句话

```python
from foxcomms import FoxComms
FoxComms().send("白狐", "TASK-FB-002 竞品调研，P2，请查收")
```

## 安装位置

```
Notebook/70_花火项目/FoxBoard/scripts/foxcomms.py
```

## Python 用法

```python
import sys
sys.path.insert(0, '/home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/scripts')
from foxcomms import FoxComms

# 派单给白狐
FoxComms().send("白狐", "TASK-FB-002 竞品调研，P2，请查收")

# 黑狐汇报 REVIEW 结果
FoxComms().send("花火", "TASK-FB-003 REVIEW 通过，build 成功")

# 花火向主人汇报
FoxComms().send("主人", "FoxBoard Milestone 1 已完成，请审核")

# 指定项目
FoxComms(project="blog").send("青狐", "博客部署任务")
```

## CLI 用法

```bash
python3 /home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/scripts/foxcomms.py 白狐 "TASK-FB-002 竞品调研"
python3 /home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/scripts/foxcomms.py 主人 "Milestone 1 已完成" blog
```

## 通信录

| 收件人 | Agent ID | 说明 |
|--------|---------|------|
| 白狐 | `white_fox` | 调研分析 |
| 青狐/小青狐 | `worker` | 开发执行 |
| 黑狐 | `black_fox` | 测试审核 |
| 花火 | `main` | 项目管理 |
| 主人 | — | 飞书工作群通知 |

## 自动完成三件事

1. **写入 COMMS.md** — 时间倒序追加，通信有据可查
2. **触发 agent inbox** — 派单/审核/问题时自动写入对应 agent 的 inbox.json
3. **飞书群通知** — 派单/通知/问题自动发送到飞书工作群（主人可见）

## 消息类型（自动识别）

- `派单`：任务派发给白狐/青狐/黑狐
- `汇报`：执行人完成后的汇报
- `审核`：黑狐 REVIEW 结果
- `问题`：阻塞/问题上报
- `通知`：里程碑/进度通知（发给主人）
- `消息`：通用消息

## 环境变量

| 变量 | 默认值 |
|------|--------|
| `FOXCOMMS_FEISHU_GROUP_ID` | `oc_631ca66841ec4a2bf18e0853c4a9b0f8` |
| `FOXCOMMS_BLOG_DIR` | `blog COMMS.md 目录` |

## 项目对应 COMMS.md

- `FoxBoard` → `Notebook/70_花火项目/FoxBoard/COMMS.md`
- `blog` → `Notebook/70_花火项目/blog/COMMS.md`
