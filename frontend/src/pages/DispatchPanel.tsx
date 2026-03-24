/**
 * DispatchPanel.tsx — 任务自动派单引擎前端UI
 * Phase 12：任务派单管理面板
 */
import { useEffect, useState, useCallback } from 'react';
import { getAgents, getTasks, claimTask } from '../api/client';

// ---- Types ----
interface Agent {
  agent_id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'offline';
  is_online: boolean;
  capability_tags: string;
  task_count: number;
  current_task_id: string | null;
  last_heartbeat: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assignee_id?: string;
  assignee_name?: string;
  tags?: string;
  created_at: string;
  depends_on?: string;
}

interface DispatchLog {
  id: number;
  task_id: string;
  task_title: string;
  agent_id: string;
  agent_name: string;
  action: 'auto' | 'manual';
  status: 'success' | 'failed';
  message: string;
  timestamp: string;
}

// ---- 常量 ----
const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

const ROLE_LABELS: Record<string, string> = {
  fox_leader: '花火',
  white_fox: '白狐',
  black_fox: '黑狐',
  qing_fox: '青狐',
};

export default function DispatchPanel() {
  // ---- State ----
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch Data ----
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch agents
      const agentsRes = await getAgents();
      if (agentsRes.data) {
        setAgents(agentsRes.data);
      }

      // Fetch pending tasks (TODO with no assignee)
      const tasksRes = await getTasks({ status: 'TODO' });
      if (tasksRes.data) {
        const pending = tasksRes.data.filter((t: Task) => !t.assignee_id);
        setPendingTasks(pending);
      }

      // Load mock logs for now (would be fetched from backend)
      setLogs(generateMockLogs());
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Mock logs generator ----
  function generateMockLogs(): DispatchLog[] {
    return [
      {
        id: 1,
        task_id: 'FB-102',
        task_title: 'Agent状态看板Dashboard页面',
        agent_id: 'white_fox',
        agent_name: '白狐',
        action: 'auto',
        status: 'success',
        message: '自动派单成功',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 2,
        task_id: 'FB-103',
        task_title: 'Phase 10 技术调研',
        agent_id: 'qing_fox',
        agent_name: '青狐',
        action: 'manual',
        status: 'success',
        message: '手动分配',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  }

  // ---- Auto dispatch ----
  const handleAutoDispatch = async () => {
    if (pendingTasks.length === 0) {
      return;
    }

    setDispatching(true);
    setError(null);

    try {
      // Get available agents
      const availableAgents = agents.filter(a => a.status === 'idle' && a.is_online);

      if (availableAgents.length === 0) {
        throw new Error('没有可用的 Agent');
      }

      // Simple round-robin dispatch
      let agentIndex = 0;
      const newLogs: DispatchLog[] = [];

      for (const task of pendingTasks.slice(0, availableAgents.length)) {
        const agent = availableAgents[agentIndex % availableAgents.length];
        
        try {
          // Attempt to claim task
          await claimTask(task.id, { assignee_id: agent.agent_id });
          
          newLogs.push({
            id: Date.now() + Math.random(),
            task_id: task.id,
            task_title: task.title,
            agent_id: agent.agent_id,
            agent_name: agent.name,
            action: 'auto',
            status: 'success',
            message: '自动派单成功',
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          newLogs.push({
            id: Date.now() + Math.random(),
            task_id: task.id,
            task_title: task.title,
            agent_id: agent.agent_id,
            agent_name: agent.name,
            action: 'auto',
            status: 'failed',
            message: err.message || '派单失败',
            timestamp: new Date().toISOString(),
          });
        }
        
        agentIndex++;
      }

      setLogs(prev => [...newLogs, ...prev]);
      
      // Refresh data
      await fetchData();
    } catch (err: any) {
      setError(err.message || '自动派单失败');
    } finally {
      setDispatching(false);
    }
  };

  // ---- Render helpers ----
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务派单中心</h1>
          <p className="text-sm text-gray-500 mt-1">自动派单引擎 · 智能负载均衡</p>
        </div>
        <button
          onClick={handleAutoDispatch}
          disabled={dispatching || pendingTasks.length === 0}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            dispatching || pendingTasks.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {dispatching ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5. 5.291z"/>
              </svg>
              派单中...
            </span>
          ) : (
            '🚀 一键自动派单'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pending Tasks */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">待派单任务</h2>
              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingTasks.length}
              </span>
            </div>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto space-y-3">
            {pendingTasks.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p>暂无待派单任务</p>
              </div>
            ) : (
              pendingTasks.map(task => (
                <div key={task.id} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {task.id}
                    </span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      task.priority >= 5 ? 'bg-red-100 text-red-700' : 
                      task.priority >= 3 ? 'bg-amber-100 text-amber-700' : 
                      'bg-blue-100 text-blue-700'
                    }`}>
                      P{task.priority}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</p>
                  {task.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {task.tags.split(',').slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center: Agent Load */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Agent 负载监控</h2>
          </div>
          <div className="p-4 space-y-4">
            {agents.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>暂无 Agent 数据</p>
              </div>
            ) : (
              agents.map(agent => (
                <div key={agent.agent_id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[agent.status] || 'bg-gray-400'}`} />
                      <span className="font-medium text-gray-900">
                        {ROLE_LABELS[agent.agent_id] || agent.name || agent.agent_id}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      {agent.role || 'Agent'}
                    </span>
                  </div>
                  
                  {/* Load Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">负载</span>
                      <span className="font-medium text-gray-700">
                        {agent.task_count} 任务 · {agent.status === 'idle' ? '空闲' : agent.status === 'busy' ? '忙碌' : '离线'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          agent.task_count === 0 ? 'bg-green-500 w-0' :
                          agent.task_count <= 2 ? 'bg-green-500' :
                          agent.task_count <= 4 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((agent.task_count / 5) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Capabilities */}
                  {agent.capability_tags && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {agent.capability_tags.split(',').slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Dispatch Actions */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm text-white p-6">
            <h3 className="text-lg font-semibold mb-4">派单统计</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-bold">{pendingTasks.length}</p>
                <p className="text-sm text-indigo-100">待派单</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{agents.filter(a => a.status === 'idle').length}</p>
                <p className="text-sm text-indigo-100">空闲Agent</p>
              </div>
            </div>
          </div>

          {/* Dispatch Rules */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 mb-3">派单规则</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-gray-600">优先分配给空闲 Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-gray-600">按能力标签匹配</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span className="text-gray-600">轮询负载均衡</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Dispatch History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">派单历史日志</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方式</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      暂无派单记录
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.task_title}</div>
                        <div className="text-xs text-gray-500">{log.task_id}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{log.agent_name}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          log.action === 'auto' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.action === 'auto' ? '🤖 自动' : '👤 手动'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status === 'success' ? '✅ 成功' : '❌ 失败'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
