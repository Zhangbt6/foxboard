import { useEffect, useState, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getWorkflows, getWorkflowNodes } from '../api/client';
import { useInterval } from '../hooks/useInterval';

// 步骤定义（静态骨架）
const STEPS = [
  { id: '1', label: '需求提出', owner: '主人', desc: '主人提出新需求或任务' },
  { id: '2', label: '花火拆解', owner: '花火', desc: '花火分析需求，拆解为可执行任务' },
  { id: '3', label: '白狐调研', owner: '白狐', desc: '白狐调研竞品、技术方案' },
  { id: '4', label: '青狐开发', owner: '青狐', desc: '青狐实现功能代码' },
  { id: '5', label: '黑狐验证', owner: '黑狐', desc: '黑狐审核代码、测试用例' },
  { id: '6', label: '花火汇总', owner: '花火', desc: '花火确认交付，整合产出' },
  { id: '7', label: '主人审核', owner: '主人', desc: '主人最终验收' },
];

// 负责人颜色映射（静态展示用）
const OWNER_COLORS: Record<string, string> = {
  '主人': '#ec4899',
  '花火': '#f59e0b',
  '白狐': '#e2e8f0',
  '青狐': '#7c3aed',
  '黑狐': '#1e293b',
};

// 节点状态 → 颜色
const STATUS_COLORS: Record<string, string> = {
  pending:  '#94a3b8',   // 灰=未开始
  running:  '#3b82f6',   // 蓝=进行中
  done:     '#22c55e',   // 绿=完成
  review:   '#eab308',   // 黄=审核中
  blocked:  '#ef4444',   // 红=阻塞
};

interface NodeStateMap {
  [nodeId: string]: {
    status: string;
    task_id?: string;
    color: string;
  };
}

// 初始边（顺序连接）
const initEdges: Edge[] = STEPS.slice(0, -1).map((step, i) => ({
  id: `e${step.id}-${STEPS[i + 1].id}`,
  source: step.id,
  target: STEPS[i + 1].id,
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#475569', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
}));

// 自定义节点组件 — 支持动态颜色 + 阻塞闪烁
function StepNode({ data }: {
  data: {
    label: string;
    owner: string;
    ownerColor: string;
    color: string;
    desc: string;
    status: string;
    task_id?: string;
  }
}) {
  const isBlocked = data.status === 'blocked';
  return (
    <div style={{ minWidth: 140, textAlign: 'center' }}>
      <style>{`
        @keyframes blink-blocked {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50% { box-shadow: 0 0 16px 4px rgba(239,68,68,0.7); }
        }
        .step-node-blocked {
          animation: blink-blocked 1.2s ease-in-out infinite;
        }
      `}</style>
      <div
        className={isBlocked ? 'step-node-blocked' : ''}
        style={{
          background: `${data.color}22`,
          border: `2px solid ${data.color}`,
          borderRadius: 12,
          padding: '14px 20px',
          boxShadow: isBlocked ? undefined : `0 4px 12px ${data.color}33`,
          transition: 'border-color 0.3s, background 0.3s',
        }}
      >
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: data.color,
          marginBottom: 6,
        }}>
          {data.label}
        </div>
        <div style={{
          fontSize: 11,
          color: '#94a3b8',
          marginBottom: 4,
        }}>
          🦊 {data.owner}
        </div>
        <div style={{
          fontSize: 10,
          color: '#64748b',
          lineHeight: 1.4,
        }}>
          {data.desc}
        </div>
        {data.task_id && (
          <div style={{
            fontSize: 9,
            color: data.color,
            marginTop: 4,
            opacity: 0.8,
          }}>
            #{data.task_id}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { stepNode: StepNode };

// 从后端获取节点状态映射
async function fetchNodeStateMap(): Promise<NodeStateMap> {
  try {
    const wfRes = await getWorkflows();
    const workflows = wfRes.data;
    if (!workflows || workflows.length === 0) return {};
    // 取第一个工作流的节点状态
    const wf = workflows[0];
    const nodesRes = await getWorkflowNodes(wf.id);
    const nodeStates: NodeStateMap = {};
    for (const ns of nodesRes.data) {
      nodeStates[ns.node_id] = {
        status: ns.status,
        task_id: ns.task_id,
        color: STATUS_COLORS[ns.status] ?? '#94a3b8',
      };
    }
    return nodeStates;
  } catch {
    return {};
  }
}

// 根据节点状态构建 React Flow 节点
function buildNodes(nodeStateMap: NodeStateMap): Node[] {
  return STEPS.map((step) => {
    const state = nodeStateMap[step.id];
    const color = state?.color ?? OWNER_COLORS[step.owner] ?? '#475569';
    return {
      id: step.id,
      position: { x: 0, y: 0 }, // React Flow auto-layout
      data: {
        label: step.label,
        owner: step.owner,
        ownerColor: OWNER_COLORS[step.owner] ?? '#475569',
        color,
        desc: step.desc,
        status: state?.status ?? 'pending',
        task_id: state?.task_id,
      },
      type: 'stepNode',
      style: { background: 'transparent', border: 'none', padding: 0 },
    };
  });
}

export default function Workflow() {
  const [nodeStateMap, setNodeStateMap] = useState<NodeStateMap>({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);

  const loadNodeStates = useCallback(async () => {
    const map = await fetchNodeStateMap();
    setNodeStateMap(map);
    setNodes(buildNodes(map));
  }, [setNodes]);

  // 初始加载
  useEffect(() => {
    loadNodeStates();
  }, [loadNodeStates]);

  // 每 20 秒轮询更新节点状态
  useInterval(loadNodeStates, 20000);

  return (
    <div style={{ height: 'calc(100vh - 0px)', display: 'flex', flexDirection: 'column' }}>
      {/* 页面头部 */}
      <div style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--foxboard-border)',
        background: 'var(--foxboard-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>流程图</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            项目标准流程：需求提出 → 花火拆解 → 白狐调研 → 青狐开发 → 黑狐验证 → 花火汇总 → 主人审核
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {STEPS.map(step => (
            <div key={step.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: step.owner === '主人' ? '#ec4899' :
                     step.owner === '花火' ? '#f59e0b' :
                     step.owner === '白狐' ? '#e2e8f0' :
                     step.owner === '青狐' ? '#7c3aed' : '#1e293b',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: nodeStateMap[step.id]?.color ?? OWNER_COLORS[step.owner] ?? '#475569',
              }} />
              {step.owner}
            </div>
          ))}
        </div>
      </div>

      {/* React Flow 画布 */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={initEdges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0a0a14' }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls
            style={{
              background: 'var(--foxboard-surface)',
              border: '1px solid var(--foxboard-border)',
              borderRadius: 8,
            }}
          />
          <MiniMap
            style={{
              background: 'var(--foxboard-surface)',
              border: '1px solid var(--foxboard-border)',
              borderRadius: 8,
            }}
            nodeColor={(node) => (node.data as { color: string }).color ?? '#475569'}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
