"""
Pydantic 数据模型定义
用于请求/响应验证
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# ---- Enums ----
class AgentRole(str, Enum):
    worker = "worker"
    commander = "commander"
    auditor = "auditor"

class AgentStatus(str, Enum):
    idle = "idle"
    busy = "busy"
    offline = "offline"

class TaskStatus(str, Enum):
    TODO = "TODO"
    DOING = "DOING"
    REVIEW = "REVIEW"
    DONE = "DONE"
    BLOCKED = "BLOCKED"

class ProjectStatus(str, Enum):
    active = "active"
    archived = "archived"

class EventType(str, Enum):
    task_created = "task_created"
    task_updated = "task_updated"
    task_completed = "task_completed"
    agent_heartbeat = "agent_heartbeat"
    agent_registered = "agent_registered"

# ---- Agent ----
class AgentRegister(BaseModel):
    agent_id: str = Field(..., description="唯一标识，如 fox_001")
    name: str = Field(..., description="成员名称")
    role: AgentRole = AgentRole.worker

class AgentHeartbeat(BaseModel):
    agent_id: str
    task_id: Optional[str] = None
    project_id: Optional[str] = None
    status: AgentStatus = AgentStatus.idle
    priority: int = Field(default=0, ge=0, le=100)

class Agent(BaseModel):
    id: str
    name: str
    role: AgentRole
    status: AgentStatus
    current_task_id: Optional[str] = None
    current_project_id: Optional[str] = None
    priority: int = 0
    last_heartbeat: Optional[str] = None
    state_detail: Optional[str] = None
    created_at: str
    updated_at: str

# ---- Project ----
class ProjectCreate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None

class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.active
    owner: Optional[str] = None
    created_at: str
    updated_at: str

# ---- Task ----
class TaskCreate(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: int = Field(default=0, ge=0, le=10)
    assignee_id: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[str] = None
    depends_on: Optional[str] = None  # 逗号分隔的任务ID列表

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[int] = None
    assignee_id: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[str] = None
    depends_on: Optional[str] = None

class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: int = 0
    assignee_id: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[str] = None
    started_at: Optional[str] = None   # DOING 任务的开始时间
    depends_on: Optional[str] = None   # 逗号分隔的依赖任务ID
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None

class KanbanColumn(BaseModel):
    status: TaskStatus
    tasks: List[Task]

class KanbanView(BaseModel):
    columns: List[KanbanColumn]

# ---- Event ----
class EventCreate(BaseModel):
    task_id: Optional[str] = None
    agent_id: Optional[str] = None
    event_type: EventType
    message: Optional[str] = None
    metadata: Optional[str] = None

class Event(BaseModel):
    id: int
    task_id: Optional[str]
    agent_id: Optional[str]
    event_type: EventType
    message: Optional[str]
    metadata: Optional[str]
    created_at: str

# ---- Workflow ----
class WorkflowCreate(BaseModel):
    id: str
    project_id: Optional[str] = None
    name: str = "默认流程"

class Workflow(BaseModel):
    id: str
    project_id: Optional[str]
    name: str
    created_at: str
    updated_at: str

# ---- Workflow Node State ----
class NodeStatus(str, Enum):
    """节点状态：决定颜色"""
    pending = "pending"      # 灰 #94a3b8 未开始
    running = "running"       # 蓝 #3b82f6 进行中
    done = "done"            # 绿 #22c55e 完成
    review = "review"        # 黄 #eab308 审核中
    blocked = "blocked"      # 红 #ef4444 阻塞

# 状态→颜色映射（供前端直接使用）
NODE_STATUS_COLORS = {
    NodeStatus.pending: "#94a3b8",
    NodeStatus.running: "#3b82f6",
    NodeStatus.done: "#22c55e",
    NodeStatus.review: "#eab308",
    NodeStatus.blocked: "#ef4444",
}

class WorkflowNodeStateCreate(BaseModel):
    node_id: str
    task_id: Optional[str] = None
    status: NodeStatus = NodeStatus.pending

class WorkflowNodeStateUpdate(BaseModel):
    status: Optional[NodeStatus] = None
    task_id: Optional[str] = None

class WorkflowNodeState(BaseModel):
    workflow_id: str
    node_id: str
    task_id: Optional[str]
    status: NodeStatus
    color: str  # 派生自 status
    created_at: str
    updated_at: str
