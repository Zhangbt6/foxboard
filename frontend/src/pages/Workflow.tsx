/**
 * Workflow.tsx — 流程图主页面 v3.0 (视觉升级版)
 *
 * 设计目标：
 * - 更清晰的流程阶段感（渐变卡片 + 状态发光）
 * - 更漂亮的依赖链（流动虚线 + 阻塞脉冲）
 * - 信息层级更强（状态/优先级/负责人/任务摘要）
 */
import { useEffect, useState, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getWorkflows, getWorkflowNodes, getTask, getTasks } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import TaskDrawer from '../components/TaskDrawer';

const STEP_META: Record<string, {
  label: string;
  owner: string;
  desc: string;
  ownerColor: string;
}> = {
  '1': { label: '需求提出', owner: '主人',    desc: '主人提出新需求或任务',           ownerColor: '#ec4899' },
  '2': { label: '花火拆解', owner: '花火',    desc: '花火分析需求，拆解为可执行任务', ownerColor: '#f59e0b' },
  '3': { label: '白狐调研', owner: '白狐',    desc: '白狐调研竞品、技术方案',         ownerColor: '#e2e8f0' },
  '4': { label: '青狐开发', owner: '青狐',    desc: '青狐实现功能代码',               ownerColor: '#7c3aed' },
  '5': { label: '黑狐验证', owner: '黑狐',    desc: '黑狐审核代码、测试用例',         ownerColor: '#1e293b' },
  '6': { label: '花火汇总', owner: '花火',    desc: '花火确认交付，整合产出',         ownerColor: '#f59e0b' },
  '7': { label: '主人审核', owner: '主人',    desc: '主人最终验收',                   ownerColor: '#ec4899' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  running: '#38bdf8',
  done: '#22c55e',
  review: '#f59e0b',
  blocked: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待开始',
  running: '进行中',
  done: '已完成',
  review: '待审核',
  blocked: '阻塞',
};

const ASSIGNEE_NAMES: Record<string, string> = {
  fox_001: '小青狐',
  white_fox: '白狐',
  black_fox: '黑狐',
  fox_leader: '花火',
  owner: '主人',
};

interface Workflow {
  id: string;
  name: string;
  project_id: string;
}

interface WorkflowNode {
  workflow_id: string;
  node_id: string;
  task_id: string | null;
  status: string;
}

interface TaskMeta {
  id: string;
  title: string;
  priority: number;
  assignee_id: string | null;
  depends_on: string | null;
  status: string;
}

function StepNode({ data }: {
  data: {
    label: string;
    owner: string;
    ownerColor: string;
    color: string;
    desc: string;
    status: string;
    stepNo: number;
    task_id?: string | null;
    taskMeta?: TaskMeta | null;
  }
}) {
  const isBlocked = data.status === 'blocked';
  const isRunning = data.status === 'running';
  const hasTask = !!data.task_id;

  const priorityColor = data.taskMeta
    ? data.taskMeta.priority >= 8 ? '#ef4444'
      : data.taskMeta.priority >= 5 ? '#f59e0b'
      : '#64748b'
    : '#64748b';

  const statusColor = STATUS_COLORS[data.status] ?? data.color;
  const statusText = STATUS_LABELS[data.status] ?? data.status;

  return (
    <div style={{ minWidth: 240, textAlign: 'left' }}>
      <Handle type="target" position={Position.Left} style={{ background: statusColor, width: 9, height: 9, opacity: 0.9 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ background: statusColor, width: 9, height: 9, opacity: 0.9 }} />
      <Handle type="source" position={Position.Right} style={{ background: statusColor, width: 9, height: 9, opacity: 0.9 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: statusColor, width: 9, height: 9, opacity: 0.9 }} />

      <style>{`
        @keyframes foxboard-node-breathe {
          0%, 100% { box-shadow: 0 0 0 0 ${statusColor}1a, 0 8px 20px rgba(0,0,0,0.32); }
          50% { box-shadow: 0 0 0 4px ${statusColor}22, 0 12px 28px rgba(0,0,0,0.45); }
        }
        @keyframes foxboard-blocked-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.05), 0 8px 20px rgba(0,0,0,0.32); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.18), 0 12px 28px rgba(239,68,68,0.2); }
        }
      `}</style>

      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${statusColor}66`,
          background: `linear-gradient(160deg, ${statusColor}22 0%, rgba(15,23,42,0.9) 45%, rgba(2,6,23,0.92) 100%)`,
          padding: '12px 14px',
          backdropFilter: 'blur(8px)',
          animation: isBlocked
            ? 'foxboard-blocked-pulse 1.35s ease-in-out infinite'
            : isRunning
              ? 'foxboard-node-breathe 1.8s ease-in-out infinite'
              : undefined,
          transition: 'all .25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 10,
            letterSpacing: 0.3,
            background: `${statusColor}2e`,
            color: statusColor,
            border: `1px solid ${statusColor}66`,
            borderRadius: 999,
            padding: '2px 8px',
            fontWeight: 700,
          }}>
            {statusText}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {data.taskMeta && (
              <span style={{
                fontSize: 10,
                background: `${priorityColor}30`,
                color: priorityColor,
                border: `1px solid ${priorityColor}4f`,
                borderRadius: 6,
                padding: '1px 6px',
                fontWeight: 700,
              }}>
                P{data.taskMeta.priority}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>#{data.stepNo}</span>
          </div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2, marginBottom: 6 }}>
          {data.label}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontSize: 10,
            color: data.ownerColor,
            background: `${data.ownerColor}22`,
            border: `1px solid ${data.ownerColor}4a`,
            borderRadius: 999,
            padding: '2px 8px',
            fontWeight: 700,
          }}>
            {data.owner}
          </span>
          <span style={{ fontSize: 10, color: '#64748b' }}>{data.desc}</span>
        </div>

        {hasTask && data.taskMeta && (
          <div style={{
            fontSize: 11,
            color: '#e2e8f0',
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 8,
            padding: '6px 8px',
            lineHeight: 1.35,
            marginBottom: 7,
          }}>
            {data.taskMeta.title.length > 42
              ? `${data.taskMeta.title.slice(0, 42)}...`
              : data.taskMeta.title}
          </div>
        )}

        {hasTask && data.taskMeta?.assignee_id && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5 }}>
            👤 执行人：{ASSIGNEE_NAMES[data.taskMeta.assignee_id] ?? data.taskMeta.assignee_id}
          </div>
        )}

        {hasTask && data.taskMeta && data.taskMeta.status !== 'done' && data.taskMeta.depends_on && (
          <div style={{
            fontSize: 10,
            color: data.taskMeta.status === 'blocked' ? '#ef4444' : '#fb923c',
            background: data.taskMeta.status === 'blocked' ? 'rgba(239,68,68,0.16)' : 'rgba(251,146,60,0.16)',
            border: `1px solid ${data.taskMeta.status === 'blocked' ? '#ef444488' : '#fb923c88'}`,
            borderRadius: 8,
            padding: '4px 8px',
            marginBottom: 6,
            lineHeight: 1.3,
          }}>
            {data.taskMeta.status === 'blocked' ? '⛔ 被阻塞：' : '⏳ 等待依赖：'}
            {data.taskMeta.depends_on}
          </div>
        )}

        {hasTask && (
          <div style={{ fontSize: 10, color: '#64748b' }}>
            任务 ID：#{data.task_id}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { stepNode: StepNode };

function buildNodes(
  nodeStates: WorkflowNode[],
  taskMetas: Record<string, TaskMeta>
): Node[] {
  const stateMap: Record<string, WorkflowNode> = {};
  for (const ns of nodeStates) stateMap[ns.node_id] = ns;

  const nodeIds = Object.keys(STEP_META);

  return nodeIds.map((nodeId) => {
    const meta = STEP_META[nodeId];
    const state = stateMap[nodeId];
    const status = state?.status ?? 'pending';
    const color = STATUS_COLORS[status] ?? meta.ownerColor;
    const taskMeta = state?.task_id ? (taskMetas[state.task_id] ?? null) : null;

    const idx = nodeIds.indexOf(nodeId);
    const cols = Math.min(nodeIds.length, 4);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const actualCol = row % 2 === 0 ? col : (cols - 1 - col);

    return {
      id: nodeId,
      position: { x: actualCol * 300 + 40, y: row * 230 + 40 },
      data: {
        label: meta.label,
        owner: meta.owner,
        ownerColor: meta.ownerColor,
        color,
        desc: meta.desc,
        status,
        stepNo: Number(nodeId),
        task_id: state?.task_id ?? null,
        taskMeta,
      },
      type: 'stepNode',
      style: { background: 'transparent', border: 'none', padding: 0 },
    };
  });
}

type EdgeDepStatus = 'flow' | 'waiting' | 'blocked';

function getEdgeDepStyle(depStatus: EdgeDepStatus): {
  stroke: string;
  strokeDasharray?: string;
  animated: boolean;
} {
  if (depStatus === 'blocked') return { stroke: '#ef4444', strokeDasharray: '10 5', animated: true };
  if (depStatus === 'waiting') return { stroke: '#fb923c', strokeDasharray: '8 6', animated: true };
  return { stroke: '#22c55e', animated: true };
}

function buildEdges(
  taskMetas: Record<string, TaskMeta>,
  nodeStates: WorkflowNode[]
): Edge[] {
  const nodeTaskMap: Record<string, string> = {};
  for (const ns of nodeStates) {
    if (ns.task_id) nodeTaskMap[ns.node_id] = ns.task_id;
  }

  const nodeIds = Object.keys(STEP_META);
  const edges: Edge[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const from = nodeIds[i];
    const to = nodeIds[i + 1];
    const fromTaskId = nodeTaskMap[from];
    const toTaskId = nodeTaskMap[to];

    let depStatus: EdgeDepStatus = 'flow';
    if (toTaskId && toTaskId in taskMetas) {
      const toTask = taskMetas[toTaskId];
      const deps = toTask.depends_on ? toTask.depends_on.split(',').map(d => d.trim()) : [];
      if (deps.length > 0 && deps.includes(fromTaskId ?? '')) {
        if (toTask.status === 'blocked') depStatus = 'blocked';
        else if (toTask.status !== 'done') depStatus = 'waiting';
      }
    }

    const style = getEdgeDepStyle(depStatus);
    edges.push({
      id: `e${from}-${to}`,
      source: from,
      target: to,
      type: 'smoothstep',
      animated: style.animated,
      style: {
        stroke: style.stroke,
        strokeWidth: depStatus === 'flow' ? 3 : 2.5,
        ...(style.strokeDasharray ? { strokeDasharray: style.strokeDasharray } : {}),
        filter: `drop-shadow(0 0 4px ${style.stroke}88)`,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: style.stroke,
        width: 18,
        height: 18,
      },
    });
  }
  return edges;
}

export default function Workflow() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWfId, setSelectedWfId] = useState<string>('');
  const [nodeStates, setNodeStates] = useState<WorkflowNode[]>([]);
  const [taskMetas, setTaskMetas] = useState<Record<string, TaskMeta>>({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const taskId = (node.data as { task_id?: string | null }).task_id;
    if (taskId) setSelectedTaskId(taskId);
  }, []);

  useEffect(() => {
    getWorkflows()
      .then(r => {
        const wfs = r.data as Workflow[];
        setWorkflows(wfs);
        if (wfs.length > 0 && !selectedWfId) setSelectedWfId(wfs[0].id);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedWfId) return;
    try {
      const nodesRes = await getWorkflowNodes(selectedWfId);
      const states = nodesRes.data as WorkflowNode[];
      setNodeStates(states);

      const taskIds = [...new Set(states.map(s => s.task_id).filter(Boolean))] as string[];

      let allTasksMap: Record<string, TaskMeta> = {};
      try {
        const allTasksRes = await getTasks({ project_id: 'foxboard' });
        for (const t of (allTasksRes.data as TaskMeta[])) {
          allTasksMap[t.id] = t;
        }
      } catch {}

      if (taskIds.length > 0) {
        const metas = await Promise.all(
          taskIds.map(id => getTask(id).then(r => (r.data as TaskMeta)).catch(() => null))
        );
        const metaMap: Record<string, TaskMeta> = {};
        for (const m of metas) {
          if (m) metaMap[m.id] = m;
        }
        const mergedMap = { ...allTasksMap, ...metaMap };
        setTaskMetas(mergedMap);
        setNodes(buildNodes(states, mergedMap));
      } else {
        setTaskMetas(allTasksMap);
        setNodes(buildNodes(states, allTasksMap));
      }

      setLastUpdated(new Date());
    } catch {
      // ignore
    }
  }, [selectedWfId, setNodes]);

  useEffect(() => {
    if (selectedWfId) loadData();
  }, [selectedWfId, loadData]);

  useWebSocket({
    onMessage: (msg) => {
      if (['task_update', 'workflow_state_changed'].includes(msg.event as string)) {
        loadData();
      }
    },
    maxReconnects: 3,
  });

  const edges = buildEdges(taskMetas, nodeStates);
  const selectedWf = workflows.find(w => w.id === selectedWfId);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at 20% 0%, #1a1f3a 0%, #0a0f1f 40%, #070b15 100%)' }}>
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid var(--foxboard-border)',
        background: 'linear-gradient(180deg, rgba(26,26,46,0.92), rgba(14,18,32,0.88))',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: 0.2 }}>流程图</h1>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>
            {selectedWf?.name ?? '加载中...'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {workflows.length > 1 && (
            <select
              value={selectedWfId}
              onChange={e => setSelectedWfId(e.target.value)}
              style={{
                background: 'rgba(15,23,42,0.7)',
                color: '#e2e8f0',
                border: '1px solid var(--foxboard-border)',
                borderRadius: 10,
                padding: '7px 12px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}

          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              ⟳ {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}

          <button
            onClick={loadData}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 18px rgba(124,58,237,0.35)',
            }}
          >
            刷新
          </button>
        </div>
      </div>

      <div style={{
        padding: '10px 32px',
        borderBottom: '1px solid rgba(51,65,85,0.7)',
        display: 'flex',
        gap: 10,
        flexShrink: 0,
        background: 'rgba(2,6,23,0.62)',
        flexWrap: 'wrap',
      }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            border: `1px solid ${c}44`,
            background: `${c}1a`,
            borderRadius: 999,
            padding: '4px 9px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}` }} />
            <span style={{ color: c }}>{STATUS_LABELS[s] ?? s}</span>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { color: '#22c55e', label: '正常流', dash: false },
            { color: '#fb923c', label: '等待依赖', dash: true },
            { color: '#ef4444', label: '阻塞', dash: true },
          ].map(p => (
            <div key={p.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              border: `1px solid ${p.color}33`,
              borderRadius: 999,
              padding: '4px 9px',
              background: `${p.color}14`,
            }}>
              <svg width="24" height="8" style={{ display: 'block' }}>
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={p.color}
                  strokeWidth="2"
                  strokeDasharray={p.dash ? '4 2' : '0'}
                />
                <polygon points="20,0 24,4 20,8" fill={p.color} />
              </svg>
              <span style={{ color: p.color }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Background color="#1e293b" gap={24} size={1.2} />
          <Controls style={{ background: 'rgba(15,23,42,0.82)', border: '1px solid var(--foxboard-border)', borderRadius: 10 }} />
          <MiniMap
            style={{ background: 'rgba(15,23,42,0.82)', border: '1px solid var(--foxboard-border)', borderRadius: 10 }}
            nodeColor={(node) => (node.data as { color: string }).color ?? '#475569'}
          />
        </ReactFlow>
      </div>

      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onRefresh={loadData}
      />
    </div>
  );
}
