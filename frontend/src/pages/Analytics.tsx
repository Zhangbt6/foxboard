/**
 * Analytics.tsx — 项目数据分析报表页 v0.8.0
 * Phase 13: 提供团队 velocity、燃尽图、周期时间、状态分布等数据看板
 */
import { useEffect, useState, useCallback } from 'react';
import { useProject } from '../contexts/ProjectContext';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getBurndown, getVelocity, getCycleTime, getStatusDistribution } from '../api/client';

// ---- Types ----
interface BurndownPoint { date: string; remaining_count: number; }
interface VelocityPoint { phase_id: string; done_count: number; avg_cycle_time_hours: number; }
interface CycleTimeData { avg_cycle_time_hours: number; min_cycle_time_hours: number; max_cycle_time_hours: number; sample_count: number; }
interface StatusPoint { status: string; count: number; }

const STATUS_COLORS: Record<string, string> = {
  TODO:    '#94a3b8',
  DOING:   '#60a5fa',
  REVIEW:  '#fbbf24',
  DONE:    '#4ade80',
  BLOCKED: '#ef4444',
};

const CHART_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const STATUS_LABELS: Record<string, string> = {
  TODO: '待处理',
  DOING: '进行中',
  REVIEW: '审核中',
  DONE: '已完成',
  BLOCKED: '阻塞',
};

export default function Analytics() {
  const { projectId } = useProject();

  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [cycleTime, setCycleTime] = useState<CycleTimeData | null>(null);
  const [statusDist, setStatusDist] = useState<StatusPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pid = projectId ?? 'foxboard';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bd, vel, ct, sd] = await Promise.all([
        getBurndown({ project_id: pid }).then(r => r.data.data),
        getVelocity({ project_id: pid, phases: 'phase-9,phase-10,phase-11,phase-12' }).then(r => r.data.data),
        getCycleTime({ project_id: pid }).then(r => r.data),
        getStatusDistribution({ project_id: pid }).then(r => r.data.data),
      ]);
      setBurndown(bd ?? []);
      setVelocity(vel ?? []);
      setCycleTime(ct ?? null);
      setStatusDist(sd ?? []);
    } catch {
      setError('加载失败，请检查后端服务');
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#94a3b8' }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  // Pie chart needs total for percentage
  const statusTotal = statusDist.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📊 Analytics 报表</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>项目：{pid} · 团队效率数据</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <SummaryCard label="当前剩余任务" value={burndown[burndown.length - 1]?.remaining_count ?? 0} color="#7c3aed" />
        <SummaryCard label="历史完成总数" value={velocity.reduce((s, v) => s + v.done_count, 0)} color="#10b981" />
        <SummaryCard
          label="平均周期(h)"
          value={cycleTime ? `${cycleTime.avg_cycle_time_hours}h` : 'N/A'}
          color="#06b6d4"
          sub={`样本: ${cycleTime?.sample_count ?? 0}`}
        />
        <SummaryCard label="当前活跃任务" value={statusDist.filter(d => d.status !== 'DONE').reduce((s, d) => s + d.count, 0)} color="#f59e0b" />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* 1. 燃尽图 */}
        <ChartCard title="🔥 燃尽图 (Burndown)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={burndown} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={v => v.slice(5)}
                interval={4}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="remaining_count"
                name="剩余任务"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Velocity */}
        <ChartCard title="⚡ 团队速度 (Velocity)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={velocity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="phase_id" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend />
              <Bar dataKey="done_count" name="完成数" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="avg_cycle_time_hours"
                name="平均周期(h)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3. 周期时间 */}
        <ChartCard title="⏱️ 周期时间 (Cycle Time)">
          {cycleTime && cycleTime.sample_count > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <CycleStat label="平均" value={`${cycleTime.avg_cycle_time_hours}h`} color="#7c3aed" />
                <CycleStat label="最短" value={`${cycleTime.min_cycle_time_hours}h`} color="#10b981" />
                <CycleStat label="最长" value={`${cycleTime.max_cycle_time_hours}h`} color="#ef4444" />
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={[
                    { label: '平均', hours: cycleTime.avg_cycle_time_hours },
                    { label: '最短', hours: cycleTime.min_cycle_time_hours },
                    { label: '最长', hours: cycleTime.max_cycle_time_hours },
                  ]}
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                  />
                  <Bar dataKey="hours" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              暂无周期时间数据
            </div>
          )}
        </ChartCard>

        {/* 4. 状态分布 */}
        <ChartCard title="📊 任务状态分布">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie
                  data={statusDist}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {statusDist.map((entry, i) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {statusDist.map((d, i) => (
                <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: STATUS_COLORS[d.status] ?? CHART_COLORS[i % CHART_COLORS.length],
                  }} />
                  <span style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>{STATUS_LABELS[d.status] ?? d.status}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{d.count}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontWeight: 600 }}>
                  <span>总计</span>
                  <span>{statusTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Refresh */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          onClick={fetchAll}
          style={{
            padding: '8px 24px',
            background: 'var(--foxboard-purple)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          🔄 刷新数据
        </button>
      </div>
    </div>
  );
}

// ---- Sub-components ----
function SummaryCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function CycleStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', background: '#0f172a', borderRadius: 8, padding: '12px 8px' }}>
      <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
