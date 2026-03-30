"""
FoxBoard Redis 缓存管理系统 (FB-301)
提供统一的缓存读写、失效、自动过期管理。
"""
from __future__ import annotations

import json
import os
import logging
from typing import Any, Optional

import redis

logger = logging.getLogger(__name__)

# Redis 连接配置
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("REDIS_DB", "0"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)

# TTL 配置（秒）
TTL_KANBAN = 60       # 看板视图
TTL_TASKS = 30        # 任务列表
TTL_PHASES = 300      # Phase 列表


class CacheManager:
    """
    Redis 缓存管理器。
    - 连接失败时自动降级（返回 None），不阻塞业务
    - 所有 key 统一加前缀 `fb:` 避免与其他应用冲突
    """

    _instance: Optional["CacheManager"] = None
    _client: Optional[redis.Redis] = None

    def __new__(cls) -> "CacheManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._connect()
        return cls._instance

    def _connect(self) -> None:
        try:
            self._client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            self._client.ping()
            logger.info("[FB-301] Redis 连接成功 %s:%s", REDIS_HOST, REDIS_PORT)
        except redis.RedisError as e:
            logger.warning("[FB-301] Redis 连接失败，降级为无缓存模式: %s", e)
            self._client = None

    @property
    def client(self) -> Optional[redis.Redis]:
        return self._client

    def _key(self, key: str) -> str:
        """统一加前缀"""
        return f"fb:{key}"

    # ---- 基础操作 ----

    def get(self, key: str) -> Optional[Any]:
        """读取缓存，返回反序列化后的对象；不存在或出错返回 None"""
        if not self._client:
            return None
        try:
            raw = self._client.get(self._key(key))
            if raw is None:
                return None
            return json.loads(raw)
        except (redis.RedisError, json.JSONDecodeError) as e:
            logger.warning("[FB-301] cache.get(%s) 失败: %s", key, e)
            return None

    def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        """写入缓存，ttl 秒过期；写入失败时降级不抛异常"""
        if not self._client:
            return False
        try:
            serialized = json.dumps(value)
            self._client.setex(self._key(key), ttl, serialized)
            return True
        except (redis.RedisError, TypeError) as e:
            logger.warning("[FB-301] cache.set(%s) 失败: %s", key, e)
            return False

    def delete(self, key: str) -> bool:
        """删除指定缓存 key"""
        if not self._client:
            return False
        try:
            self._client.delete(self._key(key))
            return True
        except redis.RedisError as e:
            logger.warning("[FB-301] cache.delete(%s) 失败: %s", key, e)
            return False

    def delete_pattern(self, pattern: str) -> int:
        """按 pattern 删除匹配的 key（如 `fb:tasks:*`），返回删除数量"""
        if not self._client:
            return 0
        try:
            full_pattern = self._key(pattern)
            keys = list(self._client.iter_keys(full_pattern))
            if not keys:
                return 0
            return self._client.delete(*keys)
        except redis.RedisError as e:
            logger.warning("[FB-301] cache.delete_pattern(%s) 失败: %s", pattern, e)
            return 0

    # ---- 业务缓存 key 构造器 ----

    @staticmethod
    def kanban_key(project_id: Optional[str] = None) -> str:
        return f"kanban:{project_id or 'all'}"

    @staticmethod
    def tasks_key(project_id: Optional[str] = None, status: Optional[str] = None) -> str:
        parts = [project_id or "all"]
        if status:
            parts.append(status)
        return "tasks:" + ":".join(parts)

    @staticmethod
    def phases_key(project_id: Optional[str] = None) -> str:
        return f"phases:{project_id or 'all'}"

    # ---- 业务缓存操作（带 TTL）----

    def get_kanban(self, project_id: Optional[str] = None) -> Optional[Any]:
        return self.get(self.kanban_key(project_id))

    def set_kanban(self, project_id: Optional[str], data: Any) -> bool:
        return self.set(self.kanban_key(project_id), data, TTL_KANBAN)

    def get_tasks(self, project_id: Optional[str] = None, status: Optional[str] = None) -> Optional[Any]:
        return self.get(self.tasks_key(project_id, status))

    def set_tasks(self, project_id: Optional[str], status: Optional[str], data: Any) -> bool:
        return self.set(self.tasks_key(project_id, status), data, TTL_TASKS)

    def get_phases(self, project_id: Optional[str] = None) -> Optional[Any]:
        return self.get(self.phases_key(project_id))

    def set_phases(self, project_id: Optional[str], data: Any) -> bool:
        return self.set(self.phases_key(project_id), data, TTL_PHASES)

    # ---- 缓存失效 ----

    def invalidate_kanban(self, project_id: Optional[str] = None) -> None:
        """使看板缓存失效"""
        self.delete(self.kanban_key(project_id))
        # project_id=None 时不清理全量，但清理 pattern
        if project_id:
            self.delete(self.kanban_key(None))  # 全量看板缓存

    def invalidate_tasks(self, project_id: Optional[str] = None) -> int:
        """使任务列表缓存失效（project_id 粒度），返回清理 key 数"""
        count = 0
        # 清理指定 project
        if project_id:
            count += self.delete(self.tasks_key(project_id, None))
            # 清理各 status 子 key
            for status in ("TODO", "DOING", "REVIEW", "DONE", "BLOCKED"):
                self.delete(self.tasks_key(project_id, status))
            self.delete(self.tasks_key(None, None))  # 全量
        else:
            count += self.delete_pattern("tasks:*")
        return count

    def invalidate_phases(self, project_id: Optional[str] = None) -> None:
        """使 Phase 缓存失效"""
        if project_id:
            self.delete(self.phases_key(project_id))
        self.delete(self.phases_key(None))  # 全量

    def invalidate_all(self) -> None:
        """全量失效（任务状态变更时调用）"""
        self.invalidate_kanban()
        self.invalidate_tasks()
        self.invalidate_phases()


# 全局单例
cache = CacheManager()
