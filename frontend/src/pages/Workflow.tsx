import type { Node, Edge } from 'reactflow';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

// 步骤定义
const STEPS = [
  { id: '1', label: '需求提出', owner: '主人', color: '#ec4899', desc: '主人提出新需求或任务' },
  { id: '2', label: '花火拆解', owner: '花火', color: '#f59e0b', desc: '花火分析需求，拆解为可执行任务' },
  { id: '3', label: '白狐调研', owner: '白狐', color: '#e2e8f0', desc: '白狐调研竞品、技术方案' },
  { id: '4', label: '青狐开发', owner: '青狐', color: '#7c3aed', desc: '青狐实现功能代码' },
  { id: '5', label: '黑狐验证', owner: '黑狐', color: '#1e293b', desc: '黑狐审核代码、测试用例' },
  { id: '6', label: '花火汇总', owner: '花火', color: '#f59e0b', desc: '花火确认交付，整合产出' },
  { id: '7', label: '主人审核', owner: '主人', color: '#ec4899', desc: '主人最终验收' },
];

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

// 自定义节点组件
function StepNode({ data }: { data: { label: string; owner: string; color: string; desc: string } }) {
  return (
    <div style={{
      minWidth: 140,
      textAlign: 'center',
    }}>
      <div style={{
        background: `${data.color}22`,
        border: `2px solid ${data.color}`,
        borderRadius: 12,
        padding: '14px 20px',
        boxShadow: `0 4px 12px ${data.color}33`,
      }}>
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
      </div>
    </div>
  );
}

const nodeTypes = { stepNode: StepNode };

// 渲染节点（统一用 stepNode 类型，带样式）
function buildNodes(): Node[] {
  return STEPS.map((step, i) => ({
    id: step.id,
    position: { x: 0, y: i * 140 },
    data: { label: step.label, owner: step.owner, color: step.color, desc: step.desc },
    type: 'stepNode',
    style: {
      background: 'transparent',
      border: 'none',
      padding: 0,
    },
  }));
}

export default function Workflow() {
  const [nodes, _sN, onNodesChange] = useNodesState(buildNodes());
  const [edges, _sE, onEdgesChange] = useEdgesState(initEdges);

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
              color: step.color,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.color }} />
              {step.owner}
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
          onEdgesChange={onEdgesChange}
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
