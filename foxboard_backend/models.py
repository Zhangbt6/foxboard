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

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[int] = None
    assignee_id: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[str] = None

class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: int = 0
    assignee_id: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[str] = None
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
