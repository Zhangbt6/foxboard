import { useEffect, useState, useCallback } from 'react';
import { getEfficiency } from '../api/client';
import { useProject } from '../contexts/ProjectContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface EfficiencyData {
  overall: {
    first_pass_rate: number;
    avg_completion_hours: number;
    total_done_tasks: number;
    rejection_hotspots: { agent_id: string; rejection_count: number }[];
  };
  per_agent: {
    agent_id: string;
    total_tasks: number;
    done_tasks: number;
    avg_completion_hours: number;
    first_pass_rate: number;
  }[];
  filters: {
    project_id: string | null;
    date_range: string | null;
  };
}

const DATE_OPTIONS = [
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '近90天', value: '90d' },
];

const AGENT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AnalyticsDashboard() {
  const { projectId } = useProject();
  const [data, setData] = useState<EfficiencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>('30d');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getEfficiency({ project_id: projectId ?? undefined, date_range: dateRange })
      .then(r => setData(r.data))
      .catch(() => setError('加载失败，请检查后端服务'))
      .finally(() => setLoading(false));
  }, [projectId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { overall, per_agent } = data ?? {
    overall: { first_pass_rate: 0, avg_completion_hours: 0, total_done_tasks: 0, rejection_hotspots: [] },
    per_agent: [],
  };

  // 一次通过率柱状图数据
  const fprData = per_agent.map((a, i) => ({
    agent: a.agent_id,
    rate: a.first_pass_rate,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));

  // 人均完成周期柱状图
  const cycleData = per_agent.map((a, i) => ({
    agent: a.agent_id,
    hours: a.avg_completion_hours,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));

  // 打回热点
  const hotspotData = overall.rejection_hotspots.map((h, i) => ({
    agent: h.agent_id,
    count: h.rejection_count,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));

  // 任务完成数
  const taskVolumeData = per_agent.map((a, i) => ({
    agent: a.agent_id,
    total: a.total_tasks,
    done: a.done_tasks,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📈 效率分析</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {DATE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: dateRange === opt.value ? 'var(--foxboard-purple)' : 'var(--foxboard-border)',
                background: dateRange === opt.value ? 'var(--foxboard-purple)' : 'transparent',
                color: dateRange === opt.value ? '#fff' : '#94a3b8',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: '#94a3b8', padding: 32, textAlign: 'center' }}>加载中...</div>}
      {error && <div style={{ color: '#ef4444', padding: 32, textAlign: 'center' }}>{error}</div>}

      {!loading && !error && data && (
        <>
          {/* 核心指标卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>整体一次通过率</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: overall.first_pass_rate >= 70 ? '#4ade80' : overall.first_pass_rate >= 50 ? '#fbbf24' : '#ef4444' }}>
                {overall.first_pass_rate}%
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>REVIEW 一次通过比例</div>
            </div>

            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>平均完成周期</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--foxboard-gold)' }}>
                {overall.avg_completion_hours}h
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>任务从创建到完成平均耗时</div>
            </div>

            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>已完成任务</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--foxboard-purple)' }}>
                {overall.total_done_tasks}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>DONE 状态任务数</div>
            </div>

            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>打回热点数</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: overall.rejection_hotspots.length > 0 ? '#ef4444' : '#4ade80' }}>
                {overall.rejection_hotspots.length}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
                {overall.rejection_hotspots.length === 0 ? '无打回' : '被打回次数最多的 Agent'}
              </div>
            </div>
          </div>

          {/* 图表区域 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* 一次通过率 */}
            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>🦊 各 Agent 一次通过率</h3>
              {fprData.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 24 }}>暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={fprData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <XAxis dataKey="agent" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{ background: '#1e1e2e', border: '1px solid #3f3f5a', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${value}%`, '一次通过率']}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {fprData.map((entry, index) => (
                        <Bar key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 平均完成周期 */}
            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>⏱️ 各 Agent 平均完成周期</h3>
              {cycleData.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 24 }}>暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cycleData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <XAxis dataKey="agent" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="h" />
                    <Tooltip
                      contentStyle={{ background: '#1e1e2e', border: '1px solid #3f3f5a', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${value}h`, '平均周期']}
                    />
                    <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                      {cycleData.map((entry, index) => (
                        <Bar key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* 打回热点 */}
            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>⚠️ 打回热点（TOP5 Agent）</h3>
              {hotspotData.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 24 }}>无打回记录</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hotspotData} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis type="category" dataKey="agent" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                    <Tooltip
                      contentStyle={{ background: '#1e1e2e', border: '1px solid #3f3f5a', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${value} 次`, '打回次数']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {hotspotData.map((entry, index) => (
                        <Bar key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 任务量对比 */}
            <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>📋 各 Agent 任务量</h3>
              {taskVolumeData.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 24 }}>暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={taskVolumeData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <XAxis dataKey="agent" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e1e2e', border: '1px solid #3f3f5a', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    <Bar dataKey="total" fill="#7c3aed" name="总任务" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="done" fill="#4ade80" name="已完成" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 详细数据表 */}
          <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>📊 Agent 效率明细</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--foxboard-border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>Agent</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>总任务</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>已完成</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>完成率</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>平均周期</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>一次通过率</th>
                  </tr>
                </thead>
                <tbody>
                  {per_agent.map((a) => (
                    <tr key={a.agent_id} style={{ borderBottom: '1px solid var(--foxboard-border)' }}>
                      <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>
                        🦊 {a.agent_id}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.total_tasks}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4ade80' }}>{a.done_tasks}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>
                        {a.total_tasks > 0 ? Math.round(a.done_tasks / a.total_tasks * 100) : 0}%
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{a.avg_completion_hours}h</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: a.first_pass_rate >= 70 ? '#4ade80' : a.first_pass_rate >= 50 ? '#fbbf24' : '#ef4444' }}>
                        {a.first_pass_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
