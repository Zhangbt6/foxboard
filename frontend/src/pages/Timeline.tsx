/**
 * Timeline.tsx — 项目时间线 / Gantt 视图 v0.8.0
 * Phase 13 新功能：任务依赖链可视化
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { getTasks } from '../api/client';
import { useProject } from '../contexts/ProjectContext';

// ---- Types ----
interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  assignee_id?: string;
  phase_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  depends_on?: string;
}

// ---- 常量 ----
const STATUS_COLORS: Record<string, string> = {
  TODO:    '#94a3b8',
  DOING:   '#60a5fa',
  REVIEW:  '#fbbf24',
  DONE:    '#4ade80',
  BLOCKED: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  TODO:    '📋 待办',
  DOING:   '🔵 进行中',
  REVIEW:  '🟡 审核',
  DONE:    '✅ 完成',
  BLOCKED: '⛔ 阻塞',
};

// ---- 日期工具 ----
function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  try { return new Date(s); } catch { return null; }
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

// ---- 依赖箭头绘制 ----
function DependencyArrows({ tasks, rowHeight }: {
  tasks: Task[];
  rowHeight: number;
}) {
  const taskIndexMap = new Map(tasks.map((t, i) => [t.id, i]));
  const svgLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  const HEADER_HEIGHT = 60;
  const ROW_H = rowHeight;

  for (const task of tasks) {
    if (!task.depends_on) continue;
    const depIds = task.depends_on.split(',').map(s => s.trim());
    for (const depId of depIds) {
      const depIdx = taskIndexMap.get(depId);
      if (depIdx === undefined) continue;

      // 起点：被依赖任务的右边缘
      const x1 = 220 + (depIdx + 1) * 40; // column width = 40px/day
      const y1 = HEADER_HEIGHT + depIdx * ROW_H + ROW_H / 2;
      // 终点：当前任务的左边缘
      const x2 = 220 + (taskIndexMap.get(task.id)! + 1) * 40;
      const y2 = HEADER_HEIGHT + taskIndexMap.get(task.id)! * ROW_H + ROW_H / 2;

      svgLines.push({ x1, y1, x2, y2 });
    }
  }

  if (svgLines.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#a78bfa" />
        </marker>
      </defs>
      {svgLines.map((line, i) => {
        // 画折线：水平->垂直->水平
        const midX = (line.x1 + line.x2) / 2;
        const d = `M ${line.x1} ${line.y1} L ${midX} ${line.y1} L ${midX} ${line.y2} L ${line.x2} ${line.y2}`;
        return (
          <path
            key={i}
            d={d}
            stroke="#a78bfa"
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="4,2"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

// ---- 主组件 ----
export default function Timeline() {
  const { projectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [phases, setPhases] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const ROW_HEIGHT = 48;
  const DAY_WIDTH = 40;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getTasks({ project_id: projectId ?? undefined });
      const data: Task[] = resp.data?.data ?? resp.data ?? [];
      setTasks(data);

      // 提取 phase 列表
      const phaseSet = new Set<string>();
      data.forEach(t => { if (t.phase_id) phaseSet.add(t.phase_id); });
      setPhases([...phaseSet].sort());
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // 过滤任务
  const filteredTasks = tasks.filter(t => {
    if (phaseFilter !== 'all' && t.phase_id !== phaseFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  // 计算时间范围（任务创建日期往前14天，到今天往后14天）
  const allDates = filteredTasks.flatMap(t => [
    parseDate(t.created_at),
    parseDate(t.started_at),
    parseDate(t.completed_at),
  ]).filter(Boolean) as Date[];

  if (allDates.length === 0) allDates.push(new Date());

  const minDate = addDays(new Date(Math.min(...allDates.map(d => d.getTime()))), -7);
  const maxDate = addDays(new Date(), 14);
  const totalDays = daysBetween(minDate, maxDate) + 1;

  // 生成时间轴头部
  const headerDays: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    headerDays.push(addDays(minDate, i));
  }

  // 计算每个任务在时间轴上的位置
  function getTaskStyle(task: Task) {
    const created = parseDate(task.created_at) ?? new Date();
    const start = parseDate(task.started_at) ?? created;
    const end = parseDate(task.completed_at) ?? (task.status === 'DONE' ? new Date() : null);

    const startOffset = Math.max(0, daysBetween(minDate, start));
    const endOffset = end ? daysBetween(minDate, end) : daysBetween(minDate, new Date());

    const left = startOffset * DAY_WIDTH;
    const width = Math.max((endOffset - startOffset + 1) * DAY_WIDTH, DAY_WIDTH * 2);

    return { left, width };
  }

  // 滚动到今天
  const scrollToToday = () => {
    if (!containerRef.current) return;
    const todayOffset = daysBetween(minDate, new Date()) * DAY_WIDTH;
    containerRef.current.scrollLeft = todayOffset - 300;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--foxboard-text)' }}>
          📅 Timeline / Gantt
        </div>
        <div style={{ flex: 1 }} />

        {/* Phase 过滤 */}
        <select
          value={phaseFilter}
          onChange={e => setPhaseFilter(e.target.value)}
          style={{
            background: 'var(--foxboard-bg)',
            color: 'var(--foxboard-text)',
            border: '1px solid var(--foxboard-border)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          <option value="all">全部 Phase</option>
          {phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* 状态过滤 */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--foxboard-bg)',
            color: 'var(--foxboard-text)',
            border: '1px solid var(--foxboard-border)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          <option value="all">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button
          onClick={scrollToToday}
          style={{
            background: 'var(--foxboard-purple)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          今天
        </button>

        <button
          onClick={fetchTasks}
          style={{
            background: 'transparent',
            color: 'var(--foxboard-text-secondary)',
            border: '1px solid var(--foxboard-border)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          刷新
        </button>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div style={{ color: 'var(--foxboard-text-secondary)', fontSize: 13 }}>
          加载中...
        </div>
      )}

      {/* 空状态 */}
      {!loading && filteredTasks.length === 0 && (
        <div style={{ color: 'var(--foxboard-text-secondary)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
          暂无任务数据
        </div>
      )}

      {/* 时间轴表格 */}
      {!loading && filteredTasks.length > 0 && (
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            border: '1px solid var(--foxboard-border)',
            borderRadius: 12,
            position: 'relative',
          }}
        >
          {/* 表头（固定） */}
          <div style={{
            display: 'flex',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--foxboard-surface)',
            borderBottom: '1px solid var(--foxboard-border)',
          }}>
            {/* 任务名列 */}
            <div style={{
              width: 220,
              minWidth: 220,
              padding: '12px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--foxboard-text-secondary)',
              borderRight: '1px solid var(--foxboard-border)',
            }}>
              任务
            </div>

            {/* 时间轴头部 */}
            <div style={{ display: 'flex', flex: 1 }}>
              {headerDays.map((d, i) => {
                const isToday = daysBetween(d, new Date()) === 0;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    style={{
                      width: DAY_WIDTH,
                      minWidth: DAY_WIDTH,
                      textAlign: 'center',
                      padding: '8px 0 4px',
                      fontSize: 10,
                      color: isToday ? '#f472b6' : isWeekend ? '#475569' : '#94a3b8',
                      borderRight: '1px solid var(--foxboard-border)',
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    <div>{d.getMonth() + 1}/{d.getDate()}</div>
                    <div style={{ fontSize: 9, opacity: 0.7 }}>{"日一二三四五六".charAt(d.getDay())}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 任务行 */}
          <div style={{ position: 'relative' }}>
            {/* 依赖箭头层 */}
            <DependencyArrows
              tasks={filteredTasks}
              rowHeight={ROW_HEIGHT}
            />

            {filteredTasks.map((task, idx) => {
              const style = getTaskStyle(task);
              const color = STATUS_COLORS[task.status] ?? '#94a3b8';
              const label = STATUS_LABELS[task.status] ?? task.status;
              const isToday = (() => {
                const today = new Date();
                return daysBetween(minDate, today) * DAY_WIDTH <= style.left + style.width &&
                       daysBetween(minDate, today) * DAY_WIDTH >= style.left;
              })();

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    height: ROW_HEIGHT,
                    borderBottom: '1px solid var(--foxboard-border)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  {/* 任务名列 */}
                  <div style={{
                    width: 220,
                    minWidth: 220,
                    padding: '8px 12px',
                    borderRight: '1px solid var(--foxboard-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--foxboard-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: `${color}22`,
                        color: color,
                      }}>
                        {label}
                      </span>
                      {task.depends_on && (
                        <span style={{ fontSize: 10, color: '#a78bfa' }}>🔗</span>
                      )}
                    </div>
                  </div>

                  {/* 时间轴条 */}
                  <div style={{ position: 'relative', flex: 1, minWidth: headerDays.length * DAY_WIDTH }}>
                    {/* 今日线 */}
                    {isToday && (
                      <div style={{
                        position: 'absolute',
                        left: daysBetween(minDate, new Date()) * DAY_WIDTH + DAY_WIDTH / 2,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: '#f472b6',
                        opacity: 0.5,
                        zIndex: 5,
                      }} />
                    )}

                    {/* 任务条 */}
                    <div
                      title={`${task.title} (${label})`}
                      style={{
                        position: 'absolute',
                        left: style.left + 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: Math.max(style.width - 8, 16),
                        height: 24,
                        background: `${color}33`,
                        border: `1px solid ${color}`,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        overflow: 'hidden',
                        cursor: 'default',
                        zIndex: 2,
                      }}
                    >
                      <div style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: color,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {task.assignee_id ? `@${task.assignee_id}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--foxboard-text-secondary)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
            {STATUS_LABELS[status]}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a78bfa' }}>
          <span style={{ fontSize: 14 }}>🔗</span>
          依赖关系
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f472b6' }}>
          <div style={{ width: 1, height: 12, background: '#f472b6' }} />
          今天
        </div>
      </div>
    </div>
  );
}
