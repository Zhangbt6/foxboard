"""
pytest 配置与共享 fixtures
"""
import pytest
import sqlite3
import tempfile
import os
import importlib
from pathlib import Path

# 注意：不在此处 import foxboard_backend.database
# 原因：模块级 import 会触发 init_db()，在 pytest 加载 conftest.py 时
# 就初始化生产数据库，绕过了我们的 DB_PATH 设置。
# 改为在 fixture 内 import，确保 DB_PATH 先被覆盖。


def _clear_foxboard_modules():
    import sys
    for mod in list(sys.modules.keys()):
        if mod.startswith("foxboard_backend"):
            del sys.modules[mod]


@pytest.fixture(scope="function")
def test_db():
    """创建临时数据库文件并初始化 schema"""
    fd, tmp_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # 在 import 之前设置 DB_PATH
    import foxboard_backend.database as db_module
    original = db_module.DB_PATH
    db_module.DB_PATH = Path(tmp_path)

    from foxboard_backend.database import init_db
    init_db()

    db_module.DB_PATH = original

    yield Path(tmp_path)

    try:
        os.unlink(tmp_path)
    except OSError:
        pass


@pytest.fixture(scope="function")
def client(test_db, monkeypatch):
    """
    返回已注入测试数据库的 FastAPI TestClient。
    """
    _clear_foxboard_modules()

    def _get_test_conn():
        conn = sqlite3.connect(test_db, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    # 动态 import，确保 DB_PATH 已被 test_db 设置好
    import foxboard_backend.database as db_module
    db_module.DB_PATH = test_db

    # monkeypatch get_conn in all relevant modules
    monkeypatch.setattr("foxboard_backend.database.get_conn", _get_test_conn)
    monkeypatch.setattr("foxboard_backend.routers.agents.get_conn", _get_test_conn)
    monkeypatch.setattr("foxboard_backend.routers.tasks.get_conn",  _get_test_conn)
    monkeypatch.setattr("foxboard_backend.routers.events.get_conn", _get_test_conn)
    monkeypatch.setattr("foxboard_backend.routers.workflows.get_conn", _get_test_conn)

    from fastapi.testclient import TestClient
    import foxboard_backend.app as app_module
    importlib.reload(app_module)

    import foxboard_backend.routers.agents as agents_mod
    import foxboard_backend.routers.tasks  as tasks_mod
    import foxboard_backend.routers.events as events_mod
    import foxboard_backend.routers.workflows as workflows_mod
    importlib.reload(agents_mod)
    importlib.reload(tasks_mod)
    importlib.reload(events_mod)
    importlib.reload(workflows_mod)

    with TestClient(app_module.app) as c:
        yield c

    _clear_foxboard_modules()
