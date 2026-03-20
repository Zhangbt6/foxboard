/**
 * API Client — 调用后端 FoxBoard API
 * 后端地址: http://localhost:8000
 */
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 5000,
});

// ---- Agents ----
export const registerAgent = (agent_id: string, name: string, role = 'worker') =>
  api.post('/agents/register', { agent_id, name, role });

export const heartbeat = (agent_id: string, status = 'idle', task_id?: string, priority = 0) =>
  api.post('/agents/heartbeat', { agent_id, status, task_id, priority });

export const getAgents = () => api.get('/agents/');

// ---- Tasks ----
export const getTasks = (params?: { status?: string; assignee_id?: string; project_id?: string }) =>
  api.get('/tasks/', { params });

export const getKanban = (project_id?: string) =>
  api.get('/tasks/kanban', { params: { project_id } });

export const createTask = (task: {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  assignee_id?: string;
  project_id?: string;
  tags?: string;
}) => api.post('/tasks/', task);

export const updateTask = (task_id: string, updates: Record<string, unknown>) =>
  api.patch(`/tasks/${task_id}`, updates);

// ---- Events ----
export const getEvents = (params?: { task_id?: string; agent_id?: string; limit?: number }) =>
  api.get('/events/', { params });

export const createEvent = (event: {
  task_id?: string;
  agent_id?: string;
  event_type: string;
  message?: string;
}) => api.post('/events/', event);

// ---- Workflows ----
export const getWorkflows = (params?: { project_id?: string }) =>
  api.get('/workflows/', { params });

export const getWorkflowNodes = (workflowId: number) =>
  api.get(`/workflows/${workflowId}/nodes`);

export const updateWorkflowNode = (workflowId: number, nodeId: string, updates: { status?: string; task_id?: string }) =>
  api.patch(`/workflows/${workflowId}/nodes/${nodeId}`, updates);

export default api;
