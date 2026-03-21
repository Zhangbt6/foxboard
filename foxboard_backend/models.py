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
    developer = "developer"
    designer = "designer"
    ops = "ops"

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
    task_claimed = "task_claimed"
    task_submitted = "task_submitted"
    task_review_passed = "task_review_passed"
    task_review_failed = "task_review_failed"
    task_activated = "task_activated"
    task_timeout = "task_timeout"
    task_deleted = "task_deleted"
    project_created = "project_created"
    project_updated = "project_updated"
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
    archived_at: Optional[str] = None
    archive_phase: Optional[str] = None
    archive_note: Optional[str] = None

class TaskArchiveRequest(BaseModel):
    operator_id: str
    phase_label: str = Field(default="PHASE8")
    note: Optional[str] = None

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

# ---- Task Lifecycle Request/Response ----
class TaskClaimRequest(BaseModel):
    agent_id: str = Field(..., description="领取任务的 Agent ID")

class TaskSubmitRequest(BaseModel):
    agent_id: str = Field(..., description="提交任务的 Agent ID")
    message: Optional[str] = Field(None, description="提交附言（可选）")

class TaskReviewRequest(BaseModel):
    auditor_id: str = Field(..., description="审核人 ID（黑狐）")

class TaskRejectRequest(BaseModel):
    auditor_id: str = Field(..., description="审核人 ID（黑狐）")
    reason: str = Field(..., description="打回原因")

class TaskBulkCreateRequest(BaseModel):
    tasks: List[TaskCreate] = Field(..., description="批量创建的任务列表")

class TaskContextItem(BaseModel):
    """单个上下文项（用于 depends_on_tasks 和 recent_activity）"""
    id: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    agent_id: Optional[str] = None
    event_type: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[str] = None


class TaskContext(BaseModel):
    """任务上下文（claim/submit 响应中附带）"""
    project_summary: str = Field(default="", description="项目简介摘要")
    task_description: str = Field(default="", description="任务完整描述")
    recommended_docs: List[str] = Field(default_factory=list, description="推荐文档路径/URL列表")
    depends_on_tasks: List[TaskContextItem] = Field(default_factory=list, description="依赖任务及状态")
    recent_activity: List[TaskContextItem] = Field(default_factory=list, description="最近活动记录")


class TaskOperationResponse(BaseModel):
    ok: bool
    task: Task
    message: Optional[str] = None
    context: Optional[TaskContext] = Field(None, description="任务上下文（claim 时自动打包）")

class TaskBulkResponse(BaseModel):
    ok: bool
    created: List[Task]
    failed: List[dict] = Field(default_factory=list, description="创建失败的任务及错误原因")


# ---- Messages (Agent 间通信) ----
class MessagePriority(str, Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"

class MessageSend(BaseModel):
    from_agent: str = Field(..., description="发送者 agent ID")
    to_agent: str = Field(..., description="接收者 agent ID")
    subject: Optional[str] = Field(None, description="消息主题")
    body: str = Field(..., description="消息正文")
    priority: MessagePriority = MessagePriority.normal
    ref_task_id: Optional[str] = Field(None, description="关联任务 ID")
    ref_project_id: Optional[str] = Field(None, description="关联项目 ID")

class Message(BaseModel):
    id: int
    from_agent: str
    to_agent: str
    subject: Optional[str]
    body: str
    priority: MessagePriority
    ref_task_id: Optional[str]
    ref_project_id: Optional[str]
    is_read: bool
    read_at: Optional[str]
    created_at: str


# ---- Reports (工作报告) ----
class ReportType(str, Enum):
    cron_summary = "cron_summary"
    review_report = "review_report"
    dev_report = "dev_report"
    incident = "incident"
    custom = "custom"

class ReportSubmit(BaseModel):
    agent_id: str = Field(..., description="提交者 agent ID")
    report_type: ReportType = ReportType.cron_summary
    session_id: Optional[str] = Field(None, description="来源 session ID")
    summary: str = Field(..., description="报告摘要（≤500字）")
    details: Optional[str] = Field(None, description="详细内容")
    task_ids: Optional[str] = Field(None, description="相关任务 ID（逗号分隔）")
    project_id: Optional[str] = Field(None, description="关联项目 ID")

class Report(BaseModel):
    id: int
    agent_id: str
    report_type: ReportType
    session_id: Optional[str]
    summary: str
    details: Optional[str]
    task_ids: Optional[str]
    project_id: Optional[str]
    status: str
    created_at: str
