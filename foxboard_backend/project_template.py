"""
Project Template - 项目目录自动初始化
当 POST /projects 创建数据库记录时，同步初始化项目目录和文档模板。
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

# ---- 项目根目录配置 ----
# 默认: {workspace_root}/black_fox/projects/{project_name}/
# 可通过环境变量 FOXBOARD_PROJECT_ROOT 覆盖
def _get_project_root() -> Path:
    """获取项目根目录基础路径"""
    env_root = os.environ.get("FOXBOARD_PROJECT_ROOT")
    if env_root:
        return Path(env_root)
    # 推断 workspace root: foxboard_backend 的 parent.parent
    foxboard_repo = Path(__file__).resolve().parent.parent.parent
    return foxboard_repo / "black_fox" / "projects"


# ---- 模板内容 ----

PROJECT_MD_TEMPLATE = """\
# PROJECT.md - {project_name}

## 基本信息
- **项目名**: {project_name}
- **创建时间**: {created_at}
- **创建者**: {owner}
- **状态**: {status}

## 项目简介
{description}

## 版本规划
- [ ] **v0.1.0** — 
- [ ] **v0.2.0** — 
- [ ] **v1.0.0** — 

## 目录结构
（待 BoardRenderer 自动生成）
"""

BOARD_MD_TEMPLATE = """\
# BOARD.md - {project_name} 任务看板

> **唯一的任务调度中心**。花火写入任务，执行人读取并推进。
> 更新日期：{created_at} | {owner} 维护

---

## 📋 状态说明

| 状态 | 含义 | 谁改 |
|------|------|------|
| `TODO` | 待执行 | 花火写入 |
| `DOING` | 正在执行 | 执行人认领 |
| `REVIEW` | 等黑狐审核 | 执行人完成后提交 |
| `DONE` | 黑狐通过 + 花火确认 | 花火标记 |
| `BLOCKED` | 需花火介入 | 执行人/花火标记 |

---

## 🔥 Phase 1

| ID | 任务 | 负责人 | 优先级 | 依赖 | 状态 |
|----|------|--------|--------|------|------|
|  |  |  |  |  | TODO |

---

## ✅ 已归档
"""

DECISIONS_MD_TEMPLATE = """\
# DECISIONS.md - {project_name} 关键决策记录

> 记录重要的技术决策和架构选择，供后续追溯。

---

## 已确认决策

| 日期 | 决策 | 理由 |
|------|------|------|
| {created_date} |  |  |

---
"""

PRD_MD_TEMPLATE = """\
# PRD.md - {project_name} 产品需求文档

## 背景
（待填写）

## 目标
- 

## 非目标
- 

## 用户故事
（待填写）

## 功能需求
（待填写）

## 非功能需求
（待填写）

## 验收标准
（待填写）
"""


# ---- 核心函数 ----

def get_project_dir(project_name: str, project_root: Optional[Path] = None) -> Path:
    """获取项目目录路径"""
    if project_root is None:
        project_root = _get_project_root()
    return project_root / project_name


def init_project_template(
    project_name: str,
    description: str = "",
    owner: str = "",
    status: str = "active",
    project_root: Optional[Path] = None,
) -> dict:
    """
    初始化项目目录和文档模板。

    Args:
        project_name: 项目名称（目录名）
        description: 项目描述
        owner: 创建者
        status: 项目状态
        project_root: 项目根目录路径（默认使用 _get_project_root()）

    Returns:
        dict with keys: created_files (list), skipped_files (list), project_dir
    """
    root = get_project_dir(project_name, project_root)
    now_iso = datetime.utcnow().isoformat()
    created_date = datetime.utcnow().strftime("%Y-%m-%d")

    # 目录结构定义: (dir_path, files)
    structure = {
        "": [
            ("PROJECT.md", PROJECT_MD_TEMPLATE.format(
                project_name=project_name,
                created_at=now_iso,
                owner=owner,
                status=status,
                description=description or "（暂无描述）",
            )),
            ("BOARD.md", BOARD_MD_TEMPLATE.format(
                project_name=project_name,
                created_at=now_iso[:10],
                owner=owner,
            )),
            ("DECISIONS.md", DECISIONS_MD_TEMPLATE.format(
                project_name=project_name,
                created_date=created_date,
            )),
        ],
        "tasks": [],
        "docs": [
            ("PRD.md", PRD_MD_TEMPLATE.format(project_name=project_name)),
        ],
        "refs": [],
    }

    created_files = []
    skipped_files = []

    # 创建目录
    for subdir in ["tasks", "docs", "refs"]:
        dir_path = root / subdir
        dir_path.mkdir(parents=True, exist_ok=True)

    # 创建文件（幂等：不覆盖已有文件）
    for rel_path, content in structure[""]:
        file_path = root / rel_path
        if file_path.exists():
            skipped_files.append(str(file_path.relative_to(root)))
        else:
            file_path.write_text(content, encoding="utf-8")
            created_files.append(str(file_path.relative_to(root)))

    # docs/
    for fname, content in structure["docs"]:
        file_path = root / "docs" / fname
        if file_path.exists():
            skipped_files.append(str(file_path.relative_to(root)))
        else:
            file_path.write_text(content, encoding="utf-8")
            created_files.append(str(file_path.relative_to(root)))

    return {
        "project_dir": str(root),
        "created_files": created_files,
        "skipped_files": skipped_files,
    }
