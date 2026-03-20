"""
工作流路由 - workflows
支持流程图实例管理和节点状态读写
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime

from ..database import get_conn
from ..models import (
    WorkflowCreate, Workflow,
    WorkflowNodeStateCreate, WorkflowNodeStateUpdate, WorkflowNodeState,
    NodeStatus, NODE_STATUS_COLORS
)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def row_to_workflow(row) -> Workflow:
    return Workflow(
        id=row["id"],
        project_id=row["project_id"],
        name=row["name"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def row_to_node_state(row) -> WorkflowNodeState:
    status = NodeStatus(row["status"])
    return WorkflowNodeState(
        workflow_id=row["workflow_id"],
        node_id=row["node_id"],
        task_id=row["task_id"],
        status=status,
        color=NODE_STATUS_COLORS[status],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# =====================
# Workflow CRUD
# =====================

@router.get("/", response_model=List[Workflow])
def list_workflows(project_id: Optional[str] = None):
    """列出所有工作流，可按 project_id 过滤"""
    conn = get_conn()
    cursor = conn.cursor()
    if project_id:
        cursor.execute(
            "SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        )
    else:
        cursor.execute("SELECT * FROM workflows ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [row_to_workflow(r) for r in rows]


@router.post("/", response_model=Workflow)
def create_workflow(payload: WorkflowCreate):
    """创建工作流实例，同时初始化 7 个标准节点状态为 pending"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    # 标准 7 步节点 ID
    STD_NODE_IDS = ["1", "2", "3", "4", "5", "6", "7"]

    try:
        # 插入 workflow 记录
        cursor.execute("""
            INSERT INTO workflows (id, project_id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (payload.id, payload.project_id, payload.name, now, now))

        # 为每个标准节点初始化状态
        for node_id in STD_NODE_IDS:
            cursor.execute("""
                INSERT INTO workflow_node_states (workflow_id, node_id, task_id, status, created_at, updated_at)
                VALUES (?, ?, NULL, 'pending', ?, ?)
            """, (payload.id, node_id, now, now))

        conn.commit()
        cursor.execute("SELECT * FROM workflows WHERE id = ?", (payload.id,))
        row = cursor.fetchone()
        conn.close()
        return row_to_workflow(row)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{workflow_id}", response_model=Workflow)
def get_workflow(workflow_id: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return row_to_workflow(row)


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Workflow not found")
    cursor.execute("DELETE FROM workflow_node_states WHERE workflow_id = ?", (workflow_id,))
    cursor.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "deleted": workflow_id}


# =====================
# Node State
# =====================

@router.get("/{workflow_id}/nodes", response_model=List[WorkflowNodeState])
def list_nodes(workflow_id: str):
    """获取工作流所有节点状态"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM workflow_node_states WHERE workflow_id = ? ORDER BY node_id",
        (workflow_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    if not rows:
        raise HTTPException(status_code=404, detail="Workflow not found or has no nodes")
    return [row_to_node_state(r) for r in rows]


@router.patch("/{workflow_id}/nodes/{node_id}", response_model=WorkflowNodeState)
def update_node(workflow_id: str, node_id: str, payload: WorkflowNodeStateUpdate):
    """更新单个节点状态（颜色随之变化）或关联任务"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    cursor.execute(
        "SELECT * FROM workflow_node_states WHERE workflow_id = ? AND node_id = ?",
        (workflow_id, node_id)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Node state not found")

    new_status = payload.status.value if payload.status else row["status"]
    new_task_id = payload.task_id if payload.task_id is not None else row["task_id"]

    cursor.execute("""
        UPDATE workflow_node_states
        SET status = ?, task_id = ?, updated_at = ?
        WHERE workflow_id = ? AND node_id = ?
    """, (new_status, new_task_id, now, workflow_id, node_id))
    conn.commit()

    cursor.execute(
        "SELECT * FROM workflow_node_states WHERE workflow_id = ? AND node_id = ?",
        (workflow_id, node_id)
    )
    row = cursor.fetchone()
    conn.close()
    return row_to_node_state(row)


@router.patch("/{workflow_id}/nodes", response_model=List[WorkflowNodeState])
def update_nodes_by_task(workflow_id: str, task_id: str, status: NodeStatus):
    """
    根据 task_id 批量更新关联节点的节点状态。
    用于任务状态变化时同步流程图节点颜色。
    """
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    cursor.execute("""
        UPDATE workflow_node_states
        SET status = ?, updated_at = ?
        WHERE workflow_id = ? AND task_id = ?
    """, (status.value, now, workflow_id, task_id))

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="No node found linked to this task")

    conn.commit()
    cursor.execute(
        "SELECT * FROM workflow_node_states WHERE workflow_id = ? ORDER BY node_id",
        (workflow_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [row_to_node_state(r) for r in rows]
