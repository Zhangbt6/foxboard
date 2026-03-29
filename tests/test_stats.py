"""
Tests for /stats/* API endpoints
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from foxboard_backend.app import app

client = TestClient(app)


def test_burndown_basic():
    """燃尽图端点返回 200 和有效 JSON"""
    resp = client.get("/stats/burndown?project_id=foxboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert isinstance(data["data"], list)
    # 应有 30 天数据
    assert len(data["data"]) == 30


def test_burndown_with_phase():
    """带 phase_id 过滤"""
    resp = client.get("/stats/burndown?project_id=foxboard&phase_id=phase-9")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data


def test_velocity_basic():
    """Velocity 端点返回 200"""
    resp = client.get("/stats/velocity?project_id=foxboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert isinstance(data["data"], list)


def test_velocity_with_phases():
    """带 phases 参数"""
    resp = client.get("/stats/velocity?project_id=foxboard&phases=phase-9,phase-10")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) == 2


def test_cycle_time_basic():
    """周期时间端点返回 200"""
    resp = client.get("/stats/cycle-time?project_id=foxboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "avg_cycle_time_hours" in data
    assert "sample_count" in data


def test_cycle_time_with_phase():
    """带 phase_id 过滤"""
    resp = client.get("/stats/cycle-time?project_id=foxboard&phase_id=phase-9")
    assert resp.status_code == 200


def test_status_distribution_basic():
    """状态分布端点返回 200"""
    resp = client.get("/stats/status-distribution?project_id=foxboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert "total" in data
    assert isinstance(data["data"], list)


def test_status_distribution_with_phase():
    """带 phase_id 过滤"""
    resp = client.get("/stats/status-distribution?project_id=foxboard&phase_id=phase-9")
    assert resp.status_code == 200


def test_missing_project_id():
    """缺少 project_id 参数应返回 422"""
    resp = client.get("/stats/burndown")
    assert resp.status_code == 422
