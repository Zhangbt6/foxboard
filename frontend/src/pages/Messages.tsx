import { useEffect, useState, useCallback } from 'react';
import { Mail, Filter, Bell, AlertCircle, Info, Check } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

interface Message {
  id: number;
  from_agent: string;
  to_agent: string;
  body: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  is_read: boolean;
  created_at: string;
  ref_task_id?: string;
}

type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal' | 'low';

const priorityColors: Record<string, { bg: string; text: string; icon: typeof AlertCircle }> = {
  urgent: { bg: '#ef4444', text: '#fff', icon: AlertCircle },
  high: { bg: '#f97316', text: '#fff', icon: Bell },
  normal: { bg: '#3b82f6', text: '#fff', icon: Info },
  low: { bg: '#6b7280', text: '#fff', icon: Mail },
};

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<PriorityFilter>('all');
  const [agentId] = useState(() => localStorage.getItem('foxboard_agent_id') || 'white_fox');

  // 获取消息列表
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:8000/messages/?to_agent=${agentId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [agentId]);

  // WebSocket 监听实时消息
  const { status } = useWebSocket({
    url: "ws://localhost:8000/ws",
    onMessage: (event) => {
      if (event.event === 'new_message') {
        fetchMessages();
      }
    },
  });

  // 初始加载
  useEffect(() => {
    fetchMessages();
    // 每 30 秒轮询一次作为 fallback
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // 标记已读
  const markAsRead = async (messageId: number) => {
    try {
      await fetch(`http://localhost:8000/messages/${messageId}/read`, {
        method: 'PATCH',
      });
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, is_read: true } : m))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // 全部标为已读
  const markAllAsRead = async () => {
    try {
      await fetch(`http://localhost:8000/messages/read-all?to_agent=${agentId}`, {
        method: 'PATCH',
      });
      setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // 过滤消息
  const filteredMessages = messages.filter(m => {
    if (filter === 'all') return true;
    return m.priority === filter;
  });

  // 排序：未读优先，然后按时间倒序
  const sortedMessages = [...filteredMessages].sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Mail size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>
            消息中心
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {unreadCount > 0 ? `您有 ${unreadCount} 条未读消息` : '所有消息已读'} · WebSocket {status}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: '12px 16px',
        background: 'var(--foxboard-surface, #1e293b)',
        borderRadius: 8,
        border: '1px solid var(--foxboard-border, #334155)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} color="#94a3b8" />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>优先级:</span>
          {(['all', 'urgent', 'high', 'normal', 'low'] as PriorityFilter[]).map(p => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                fontSize: 12,
                cursor: 'pointer',
                background: filter === p ? priorityColors[p]?.bg || '#6366f1' : 'transparent',
                color: filter === p ? '#fff' : '#94a3b8',
                textTransform: 'capitalize',
              }}
            >
              {p === 'all' ? '全部' : p}
            </button>
          ))}
        </div>

        <button
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--foxboard-border, #334155)',
            background: unreadCount === 0 ? '#334155' : 'transparent',
            color: unreadCount === 0 ? '#64748b' : '#e2e8f0',
            fontSize: 12,
            cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={14} />
          全部标为已读
        </button>
      </div>

      {/* Message List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedMessages.length === 0 ? (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: '#64748b',
          }}>
            <Mail size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>暂无消息</p>
          </div>
        ) : (
          sortedMessages.map(msg => {
            const PriorityIcon = priorityColors[msg.priority]?.icon || Mail;
            const isUnread = !msg.is_read;

            return (
              <div
                key={msg.id}
                onClick={() => isUnread && markAsRead(msg.id)}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: isUnread ? 'var(--foxboard-surface, #1e293b)' : 'transparent',
                  border: '1px solid var(--foxboard-border, #334155)',
                  cursor: isUnread ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  opacity: msg.is_read ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Priority Icon */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: priorityColors[msg.priority]?.bg || '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <PriorityIcon size={16} color={priorityColors[msg.priority]?.text || '#fff'} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#8b5cf6',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {msg.from_agent}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>→</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{msg.to_agent}</span>
                      {msg.ref_task_id && (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          color: '#a78bfa',
                          borderRadius: 4,
                        }}>
                          {msg.ref_task_id}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
                        {new Date(msg.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: 14,
                      color: isUnread ? '#e2e8f0' : '#94a3b8',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.body}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {isUnread && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#8b5cf6',
                      flexShrink: 0,
                      marginTop: 4,
                    }} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
