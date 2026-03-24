/**
 * PhaseProgress.tsx — Phase 进度可视化组件 v1.0.0
 * Phase 12: OpenClaw Dashboard 集成
 * 
 * 功能：展示当前 Phase 进度及历史 Phase 时间线
 */

import { useEffect, useState } from 'react';
import { getPhases } from '../api/client';
import { useProject } from '../contexts/ProjectContext';
import { 
  Target, 
  Clock,
  Layers,
  TrendingUp
} from 'lucide-react';

// ---- Types ----
interface Phase {
  id: string;
  project_id: string;
  name: string;
  version: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  goals: string[];
  task_count: number;
  done_count: number;
  archived_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ---- 辅助函数 ----

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return '已完成';
    case 'active': return '进行中';
    case 'cancelled': return '已取消';
    case 'planning': return '规划中';
    default: return status;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return '#4ade80';
    case 'active': return '#60a5fa';
    case 'cancelled': return '#ef4444';
    case 'planning': return '#94a3b8';
    default: return '#64748b';
  }
}

// ---- 子组件 ----

function PhaseTimeline({ phases, currentPhase }: { phases: Phase[]; currentPhase?: Phase }) {
  // 按 created_at 排序
  const sortedPhases = [...phases].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      {/* 时间线竖线 */}
      <div style={{
        position: 'absolute',
        left: 7,
        top: 8,
        bottom: 8,
        width: 2,
        background: 'linear-gradient(to bottom, #4ade80, #60a5fa, #7c3aed)',
        borderRadius: 1,
      }} />
      
      {sortedPhases.map((phase, index) => {
        const isCurrent = currentPhase?.id === phase.id;
        const statusColor = getStatusColor(phase.status);
        
        return (
          <div 
            key={phase.id}
            style={{
              position: 'relative',
              paddingBottom: index < sortedPhases.length - 1 ? 20 : 0,
            }}
          >
            {/* 节点 */}
            <div style={{
              position: 'absolute',
              left: -24 + 4,
              top: 4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: statusColor,
              border: `2px solid ${isCurrent ? '#fff' : statusColor}`,
              boxShadow: isCurrent ? `0 0 10px ${statusColor}` : 'none',
            }} />
            
            {/* 内容 */}
            <div style={{
              background: isCurrent ? 'rgba(124,58,237,0.1)' : 'transparent',
              border: isCurrent ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              borderRadius: 8,
              padding: isCurrent ? 12 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                  {phase.name}
                </span>
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: `${statusColor}22`,
                  color: statusColor,
                }}>
                  {getStatusLabel(phase.status)}
                </span>
                {isCurrent && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(124,58,237,0.3)',
                    color: '#a78bfa',
                  }}>
                    当前
                  </span>
                )}
              </div>
              
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                {phase.description}
              </div>
              
              {/* 进度条 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1,
                  height: 4,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${phase.task_count > 0 ? (phase.done_count / phase.task_count) * 100 : 0}%`,
                    height: '100%',
                    background: statusColor,
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                  {phase.done_count}/{phase.task_count}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- 主组件 ----

export default function PhaseProgress() {
  const { projectId } = useProject();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<Phase | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhases = async () => {
      try {
        const response = await getPhases(projectId ?? undefined);
        const phaseList = response.data || [];
        setPhases(phaseList);
        
        // 找到当前激活的 Phase
        const active = phaseList.find((p: Phase) => p.status === 'active');
        setCurrentPhase(active);
      } catch (err) {
        console.error('Failed to fetch phases:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPhases();
  }, [projectId]);

  // 计算统计数据
  const totalPhases = phases.length;
  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const totalTasks = phases.reduce((sum, p) => sum + p.task_count, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.done_count, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
        <Target size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
        <div>加载 Phase 数据...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Layers size={20} color="#7c3aed" />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>
            Phase 进度概览
          </h2>
        </div>
        <p style={{ fontSize: 12, color: '#64748b' }}>
          项目整体进度追踪与 Phase 历史时间线
        </p>
      </div>

      {/* 总体进度卡片 */}
      <div style={{
        background: 'var(--foxboard-surface)',
        border: '1px solid var(--foxboard-border)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed22, #8b5cf644)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={20} color="#a78bfa" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>总体进度</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {completedPhases}/{totalPhases} Phases | {completedTasks}/{totalTasks} 任务
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#7c3aed' }}>{overallProgress}%</div>
          </div>
        </div>
        
        {/* 进度条 */}
        <div style={{
          height: 8,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${overallProgress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            borderRadius: 4,
            transition: 'width 0.5s ease',
            boxShadow: '0 0 10px rgba(124,58,237,0.5)',
          }} />
        </div>
      </div>

      {/* Phase 时间线 */}
      <div style={{
        background: 'var(--foxboard-surface)',
        border: '1px solid var(--foxboard-border)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Clock size={18} color="#60a5fa" />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Phase 历史时间线</h3>
        </div>
        
        <PhaseTimeline phases={phases} currentPhase={currentPhase} />
      </div>
    </div>
  );
}
