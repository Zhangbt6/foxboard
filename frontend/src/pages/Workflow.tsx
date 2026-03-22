/**
 * Workflow.tsx — 流程图主页面 v2.2 (FB-049 依赖链/阻塞链可视化)
 *
 * Phase 8: FB-049 依赖链/阻塞链可视化
 * - 节点显示：步骤名 + 负责人 + 任务标题 + 优先级 + 执行人
 * - 状态颜色：pending/running/done/review/blocked
 * - 阻塞节点闪烁动画
 * - WebSocket 实时推送
 * - 依赖链可视化：边颜色区分正常流 / 等待依赖 / 阻塞依赖
 * - 节点内显示阻塞/等待信息
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

// ============================================================
// 步骤元数据（可扩展为后端配置）
// ============================================================
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
  pending:  '#94a3b8',
  running:  '#3b82f6',
  done:     '#22c55e',
  review:   '#eab308',
  blocked:  '#ef4444',
};

// 负责人 ID → 显示名映射
const ASSIGNEE_NAMES: Record<string, string> = {
  fox_001:    '小青狐',
  white_fox:  '白狐',
  black_fox:  '黑狐',
  fox_leader: '花火',
  owner:      '主人',
};

// ============================================================
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
  depends_on: string | null;  // FB-049: 依赖链
  status: string;             // FB-049: 用于判断阻塞
}

// ============================================================
// 自定义节点组件（FB-048 增强版）
// ============================================================
function StepNode({ data }: {
  data: {
    label: string;
    owner: string;
    ownerColor: string;
    color: string;
    desc: string;
    status: string;
    task_id?: string | null;
    taskMeta?: TaskMeta | null;
  }
}) {
  const isBlocked = data.status === 'blocked';
  const hasTask = !!data.task_id;

  // 优先级颜色
  const priorityColor = data.taskMeta
    ? data.taskMeta.priority >= 8 ? '#ef4444'
      : data.taskMeta.priority >= 5 ? '#f59e0b'
      : '#475569'
    : undefined;

  return (
    <div style={{ minWidth: 160, textAlign: 'center' }}>
      <Handle type="target" position={Position.Left} style={{ background: data.color, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ background: data.color, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: data.color, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: data.color, width: 8, height: 8 }} />
      <style>{`
        @keyframes blink-blocked {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50% { box-shadow: 0 0 16px 4px rgba(239,68,68,0.7); }
        }
        .step-node-blocked { animation: blink-blocked 1.2s ease-in-out infinite; }
      `}</style>
      <div
        className={isBlocked ? 'step-node-blocked' : ''}
        style={{
          background: `${data.color}22`,
          border: `2px solid ${data.color}`,
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: isBlocked ? undefined : `0 4px 12px ${data.color}33`,
          transition: 'border-color 0.3s, background 0.3s',
        }}
      >
        {/* 顶部：状态标签 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            fontSize: 9,
            background: `${data.color}33`,
            color: data.color,
            padding: '1px 5px',
            borderRadius: 4,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            {data.status}
          </span>
          {/* 优先级 */}
          {data.taskMeta && (
            <span style={{
              fontSize: 9,
              background: `${priorityColor}33`,
              color: priorityColor,
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 700,
            }}>
              P{data.taskMeta.priority}
            </span>
          )}
        </div>

        {/* 步骤名 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: data.color, marginBottom: 4 }}>
          {data.label}
        </div>

        {/* 负责人 */}
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
          🦊 {data.owner}
        </div>

        {/* 任务标题（FB-048 新增） */}
        {hasTask && data.taskMeta && (
          <div style={{
            fontSize: 10,
            color: '#e2e8f0',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            padding: '3px 6px',
            marginBottom: 4,
            lineHeight: 1.3,
          }}>
            {data.taskMeta.title.length > 22
              ? data.taskMeta.title.slice(0, 22) + '...'
              : data.taskMeta.title}
          </div>
        )}

        {/* 执行人（FB-048 新增） */}
        {hasTask && data.taskMeta?.assignee_id && (
          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>
            👤 {ASSIGNEE_NAMES[data.taskMeta.assignee_id] ?? data.taskMeta.assignee_id}
          </div>
        )}

        {/* FB-049: 阻塞/等待依赖提示 */}
        {hasTask && data.taskMeta && data.taskMeta.status !== 'done' && data.taskMeta.depends_on && (
          <div style={{
            fontSize: 9,
            color: data.taskMeta.status === 'blocked' ? '#ef4444' : '#f97316',
            background: data.taskMeta.status === 'blocked'
              ? 'rgba(239,68,68,0.15)'
              : 'rgba(249,115,22,0.15)',
            border: `1px solid ${data.taskMeta.status === 'blocked' ? '#ef4444' : '#f97316'}44`,
            borderRadius: 4,
            padding: '2px 5px',
            marginTop: 4,
            lineHeight: 1.3,
          }}>
            {data.taskMeta.status === 'blocked' ? '⛔ 被阻塞: ' : '⏳ 等待: '}
            {data.taskMeta.depends_on}
          </div>
        )}

        {/* 任务ID */}
        {hasTask && (
          <div style={{ fontSize: 9, color: '#64748b' }}>
            #{data.task_id}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { stepNode: StepNode };

// ============================================================
// 构建节点
// ============================================================
function buildNodes(
  nodeStates: WorkflowNode[],
  taskMetas: Record<string, TaskMeta>
): Node[] {
  const stateMap: Record<string, WorkflowNode> = {};
  for (const ns of nodeStates) stateMap[ns.node_id] = ns;

  return Object.keys(STEP_META).map((nodeId) => {
    const meta = STEP_META[nodeId];
    const state = stateMap[nodeId];
    const status = state?.status ?? 'pending';
    const color = STATUS_COLORS[status] ?? meta.ownerColor;
    const taskMeta = state?.task_id ? (taskMetas[state.task_id] ?? null) : null;

    const idx = Object.keys(STEP_META).indexOf(nodeId);
    const cols = Math.min(Object.keys(STEP_META).length, 4);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    // Serpentine layout: even rows L→R, odd rows R→L
    const actualCol = row % 2 === 0 ? col : (cols - 1 - col);

    return {
      id: nodeId,
      position: { x: actualCol * 260 + 40, y: row * 200 + 40 },
      data: {
        label: meta.label,
        owner: meta.owner,
        ownerColor: meta.ownerColor,
        color,
        desc: meta.desc,
        status,
        task_id: state?.task_id ?? null,
        taskMeta,
      },
      type: 'stepNode',
      style: { background: 'transparent', border: 'none', padding: 0 },
    };
  });
}

// FB-049: 边的依赖状态
type EdgeDepStatus = 'flow' | 'waiting' | 'blocked';

function getEdgeDepStyle(
  depStatus: EdgeDepStatus
): { stroke: string; strokeDasharray?: string; animated: boolean } {
  if (depStatus === 'blocked') {
    return { stroke: '#ef4444', strokeDasharray: '6 3', animated: false };
  }
  if (depStatus === 'waiting') {
    return { stroke: '#f97316', strokeDasharray: '6 3', animated: false };
  }
  // done/正常流
  if (depStatus === 'flow') {
    return { stroke: '#22c55e', animated: false };
  }
  return { stroke: '#475569', animated: false };
}

function buildEdges(
  taskMetas: Record<string, TaskMeta>,
  nodeStates: WorkflowNode[]
): Edge[] {
  // 建立 node_id → task_id 映射
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

    // FB-049: 判断边的依赖状态
    let depStatus: EdgeDepStatus = 'flow';
    if (toTaskId && toTaskId in taskMetas) {
      const toTask = taskMetas[toTaskId];
      const deps = toTask.depends_on ? toTask.depends_on.split(',').map(d => d.trim()) : [];
      if (deps.length > 0) {
        if (deps.includes(fromTaskId ?? '')) {
          // toTask 依赖 fromTask
          if (toTask.status === 'blocked') {
            depStatus = 'blocked';
          } else if (toTask.status !== 'done') {
            depStatus = 'waiting';
          } else {
            depStatus = 'flow';
          }
        }
      }
    }

    const style = getEdgeDepStyle(depStatus);
    edges.push({
      id: `e${from}-${to}`,
      source: from,
      target: to,
      type: 'smoothstep',
      animated: depStatus === 'flow',
      style: { stroke: style.stroke, strokeWidth: 2, ...(style.strokeDasharray ? { strokeDasharray: style.strokeDasharray } : {}) },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke },
    });
  }
  return edges;
}

// ============================================================
// 主组件
// ============================================================
export default function Workflow() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWfId, setSelectedWfId] = useState<string>('');
  const [nodeStates, setNodeStates] = useState<WorkflowNode[]>([]);
  const [taskMetas, setTaskMetas] = useState<Record<string, TaskMeta>>({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);  // FB-053: 联动看板

  // FB-053: 节点点击 → 打开任务详情抽屉
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const taskId = (node.data as { task_id?: string | null }).task_id;
    if (taskId) setSelectedTaskId(taskId);
  }, []);

  // 加载流程列表
  useEffect(() => {
    getWorkflows()
      .then(r => {
        const wfs = r.data as Workflow[];
        setWorkflows(wfs);
        if (wfs.length > 0 && !selectedWfId) setSelectedWfId(wfs[0].id);
      })
      .catch(() => {});
  }, []);

  // 加载节点状态 + 任务元信息 + 依赖链（FB-049）
  const loadData = useCallback(async () => {
    if (!selectedWfId) return;
    try {
      const nodesRes = await getWorkflowNodes(selectedWfId);
      const states = nodesRes.data as WorkflowNode[];
      setNodeStates(states);

      // 提取有 task_id 的节点，并发获取任务元信息（含 depends_on）
      const taskIds = [...new Set(states.map(s => s.task_id).filter(Boolean))] as string[];

      // FB-049: 同时获取所有任务以建立依赖图
      let allTasksMap: Record<string, TaskMeta> = {};
      try {
        const allTasksRes = await getTasks({ project_id: 'foxboard' });
        for (const t of (allTasksRes.data as TaskMeta[])) {
          allTasksMap[t.id] = t;
        }
      } catch { /* ignore if no tasks yet */ }

      if (taskIds.length > 0) {
        const metas = await Promise.all(
          taskIds.map(id => getTask(id).then(r => (r.data as TaskMeta)).catch(() => null))
        );
        const metaMap: Record<string, TaskMeta> = {};
        for (const m of metas) {
          if (m) metaMap[m.id] = m;
        }
        // FB-049: 合并全量任务 map（确保依赖链完整）
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

  // WebSocket 实时推送
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 页面头部 */}
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid var(--foxboard-border)',
        background: 'var(--foxboard-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>流程图</h1>
          <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
            {selectedWf?.name ?? '加载中...'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {workflows.length > 1 && (
            <select
              value={selectedWfId}
              onChange={e => setSelectedWfId(e.target.value)}
              style={{
                background: 'var(--foxboard-surface)',
                color: '#e2e8f0',
                border: '1px solid var(--foxboard-border)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}

          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              ⟳ {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={loadData}
            style={{
              background: 'var(--foxboard-purple)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            刷新
          </button>
        </div>
      </div>

      {/* 状态图例 */}
      <div style={{
        padding: '8px 32px',
        borderBottom: '1px solid var(--foxboard-border)',
        display: 'flex',
        gap: 16,
        flexShrink: 0,
        background: 'rgba(15,15,26,0.8)',
      }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
            <span style={{ color: c, textTransform: 'uppercase' }}>{s}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          {[
            { color: '#ef4444', label: 'P8+ 高优' },
            { color: '#f59e0b', label: 'P5-7 中优' },
            { color: '#475569', label: 'P1-4 低优' },
          ].map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
              <span style={{ color: p.color }}>{p.label}</span>
            </div>
          ))}
          {/* FB-049: 依赖链图例 */}
          <div style={{ width: 1, height: 16, background: '#334155', margin: '0 4px' }} />
          {[
            { color: '#22c55e', label: '正常流', dash: false },
            { color: '#f97316', label: '等待依赖', dash: true },
            { color: '#ef4444', label: '阻塞', dash: true },
          ].map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <svg width="20" height="8" style={{ display: 'block' }}>
                <line x1="0" y1="4" x2="20" y2="4"
                  stroke={p.color}
                  strokeWidth="2"
                  strokeDasharray={p.dash ? '4 2' : '0'}
                />
                <polygon points="16,0 20,4 16,8" fill={p.color} />
              </svg>
              <span style={{ color: p.color }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* React Flow 画布 */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0a0a14' }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 8 }} />
          <MiniMap
            style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 8 }}
            nodeColor={(node) => (node.data as { color: string }).color ?? '#475569'}
          />
        </ReactFlow>
      </div>

      {/* FB-053: 流程图节点点击 → 打开任务详情抽屉 */}
      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onRefresh={loadData}
      />
    </div>
  );
}
