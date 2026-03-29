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

export const getMyTasks = (agent_id: string, status?: string) =>
  api.get('/tasks/my', { params: { agent_id, status } });

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
export const getEvents = (params?: { task_id?: string; agent_id?: string; event_type?: string; limit?: number }) =>
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

export const getWorkflowNodes = (workflowId: string) =>
  api.get(`/workflows/${workflowId}/nodes`);

export const updateWorkflowNode = (workflowId: number, nodeId: string, updates: { status?: string; task_id?: string }) =>
  api.patch(`/workflows/${workflowId}/nodes/${nodeId}`, updates);

export default api;

// ---- Projects ----
export const getProjects = () => api.get('/projects/');

export const getProject = (id: string) => api.get(`/projects/${id}`);

export const createProject = (data: { id: string; name: string; description?: string; owner?: string }) =>
  api.post('/projects/', data);

export const updateProject = (id: string, data: Record<string, unknown>) =>
  api.patch(`/projects/${id}`, data);

export const deleteProject = (id: string) => api.delete(`/projects/${id}`);

// ---- Analytics ----
export const getEfficiency = (params?: { project_id?: string; date_range?: string }) =>
  api.get('/analytics/efficiency', { params });

export const getBurndown = (params: { project_id: string; phase_id?: string }) =>
  api.get('/stats/burndown', { params });

export const getVelocity = (params: { project_id: string; phases?: string }) =>
  api.get('/stats/velocity', { params });

export const getCycleTime = (params: { project_id: string; phase_id?: string }) =>
  api.get('/stats/cycle-time', { params });

export const getStatusDistribution = (params: { project_id: string; phase_id?: string }) =>
  api.get('/stats/status-distribution', { params });

// ---- Task Operations (Phase 7) ----
export const getTask = (task_id: string) =>
  api.get(`/tasks/${task_id}`);

export const getTaskDetails = (task_id: string) =>
  api.get(`/tasks/${task_id}`, { params: { with_context: true } });

export const claimTask = (task_id: string, payload: { assignee_id: string }) =>
  api.post(`/tasks/${task_id}/claim`, payload);

export const submitTask = (task_id: string, payload: { status: string; note?: string }) =>
  api.post(`/tasks/${task_id}/submit`, payload);

export const reviewTask = (task_id: string, payload: { result: 'pass'; note?: string }) =>
  api.post(`/tasks/${task_id}/review`, payload);

export const rejectTask = (task_id: string, payload: { reason: string }) =>
  api.post(`/tasks/${task_id}/reject`, payload);

export const getTaskLogs = (task_id: string, limit = 10) =>
  api.get('/events/', { params: { task_id, limit } });

// ---- Phases (Phase 9) ----
export const getPhases = (projectId?: string) =>
  api.get('/phases/', { params: { project_id: projectId } });

export const getPhase = (phaseId: string) =>
  api.get(`/phases/${phaseId}`);

export const createPhase = (data: {
  id: string;
  project_id: string;
  name: string;
  version?: string;
  description?: string;
  status?: string;
  goals?: string;
}) => api.post('/phases/', data);

export const getPhaseTasks = (phaseId: string) =>
  api.get(`/phases/${phaseId}/tasks`);

export const getArchivedTasks = (params?: { project_id?: string; phase_id?: string; archive_phase?: string }) =>
  api.get('/tasks/archived', { params });
