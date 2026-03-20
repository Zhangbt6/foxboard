/**
 * OfficeAdapter.ts
 * FoxBoard API → game.js 数据格式适配器
 *
 * game.js 期望：
 *   /status  → { state: string, detail: string }
 *   /agents  → Agent[]
 *
 * FoxBoard API 提供：
 *   GET /agents/         → Agent[] (含 state_detail)
 *   GET /agents/{id}     → Agent
 *
 * 字段映射：
 *   FoxBoard.id          → game.js.agentId
 *   FoxBoard.name        → game.js.name
 *   FoxBoard.status      → game.js.state（状态名映射）
 *   FoxBoard.state_detail → game.js.detail
 *   FoxBoard.role         → game.js.isMain（commander = 主 agent）
 */

// Agent type (FoxBoard API shape)
interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  state_detail?: string;
  last_heartbeat?: string;
}

// ---- 常量 ----
export const FOXBOARD_API = 'http://localhost:8000';

// ---- 状态映射 ----
const STATUS_TO_STATE: Record<string, string> = {
  idle:      'idle',
  busy:      'writing',
  writing:   'writing',
  researching:'researching',
  executing: 'executing',
  syncing:   'syncing',
  reviewing: 'writing',
  error:     'error',
};

export const STATUS_TO_AREA: Record<string, string> = {
  idle:      'breakroom',
  busy:      'writing',
  writing:   'writing',
  researching:'serverroom',
  executing: 'serverroom',
  syncing:   'serverroom',
  reviewing: 'writing',
  error:     'error',
};

// ---- 类型 ----
export interface GameAgent {
  agentId: string;
  name: string;
  isMain: boolean;
  state: string;
  detail: string;
  area: string;
  authStatus: 'approved' | 'pending' | 'offline' | 'rejected';
  updated_at: string;
}

export interface GameStatus {
  state: string;
  detail: string;
}

// ---- 适配函数 ----

/**
 * 将 FoxBoard Agent 转换为 game.js Agent 格式
 */
export function adaptAgent(fb: Agent): GameAgent {
  const state = STATUS_TO_STATE[fb.status] ?? 'idle';
  return {
    agentId: fb.id,
    name: fb.name,
    isMain: fb.role === 'commander', // 花火是主 agent
    state,
    detail: fb.state_detail ?? '',
    area: STATUS_TO_AREA[fb.status] ?? 'breakroom',
    authStatus: fb.status === 'offline' ? 'offline' : 'approved',
    updated_at: fb.last_heartbeat ?? new Date().toISOString(),
  };
}

/**
 * 获取主 agent（花火）的状态，用于 /status 端点
 */
export function getMainAgentStatus(agents: Agent[]): GameStatus {
  const main = agents.find(a => a.role === 'commander') ?? agents[0];
  if (!main) return { state: 'idle', detail: '...' };
  const state = STATUS_TO_STATE[main.status] ?? 'idle';
  const detail = main.state_detail ?? '...';
  return { state, detail };
}

/**
 * 覆盖全局 fetch，使得 game.js 的 /status 和 /agents 请求指向 FoxBoard API
 * 调用时机：game.js 加载之前执行
 */
export function installFetchInterceptor(): void {
  const FB = FOXBOARD_API;

  // @ts-ignore
  const _originalFetch = window.fetch;

  // @ts-ignore
  window.fetch = function(input: RequestInfo | URL, ...init: any[]) {
    const url = typeof input === 'string' ? input : (input as Request).url;

    if (url === '/status' || url === '/status/') {
      // game.js 请求 /status → 改为 FoxBoard /agents/ 取花火状态
      return _originalFetch(`${FB}/agents/`)
        .then(r => r.json())
        .then((agents: Agent[]) => {
          const status = getMainAgentStatus(agents);
          return new Response(JSON.stringify(status), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
    }

    if (url.startsWith('/agents') && !url.includes('/agents/')) {
      // game.js 请求 /agents → 改为 FoxBoard /agents/
      return _originalFetch(`${FB}/agents/`)
        .then(r => r.json())
        .then((agents: Agent[]) => {
          const gameAgents = (Array.isArray(agents) ? agents : []).map(adaptAgent);
          return new Response(JSON.stringify(gameAgents), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
    }

    // 其他请求保持原样
    return _originalFetch(input, ...init);
  };

  console.log('[OfficeAdapter] Fetch interceptor installed, pointing to', FB);
}
