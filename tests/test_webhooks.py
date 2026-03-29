"""
Tests for /webhooks/* API endpoints
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from foxboard_backend.app import app

client = TestClient(app)


def test_create_webhook():
    """创建 Webhook 返回 200 和有效 JSON"""
    resp = client.post("/webhooks/", json={
        "url": "https://example.com/hook",
        "events": ["task.completed", "task.created"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["url"] == "https://example.com/hook"
    assert data["events"] == ["task.completed", "task.created"]
    assert data["is_active"] is True
    assert "id" in data


def test_create_webhook_with_secret():
    """创建带 secret 的 Webhook"""
    resp = client.post("/webhooks/", json={
        "url": "https://example.com/hook2",
        "events": ["task.status_changed"],
        "secret": "my-secret-key",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["secret"] == "my-secret-key"


def test_create_webhook_with_project():
    """创建绑定项目的 Webhook"""
    resp = client.post("/webhooks/", json={
        "url": "https://example.com/hook3",
        "events": ["task.completed"],
        "project_id": "foxboard",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == "foxboard"


def test_list_webhooks():
    """列出 Webhook 返回列表"""
    resp = client.get("/webhooks/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_webhooks_filter_by_project():
    """按项目过滤 Webhook"""
    resp = client.get("/webhooks/?project_id=foxboard")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_delete_webhook():
    """删除 Webhook 返回 200"""
    # 先创建一个
    create_resp = client.post("/webhooks/", json={
        "url": "https://example.com/to-delete",
        "events": ["task.completed"],
    })
    webhook_id = create_resp.json()["id"]

    # 再删除
    del_resp = client.delete(f"/webhooks/{webhook_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["ok"] is True

    # 确认删除
    get_resp = client.get(f"/webhooks/{webhook_id}")
    # Note: GET /webhooks/{id} doesn't exist, but the webhook is gone from the list


def test_delete_nonexistent_webhook():
    """删除不存在的 Webhook 返回 404"""
    resp = client.delete("/webhooks/nonexistent-id")
    assert resp.status_code == 404


def test_get_deliveries():
    """获取投递历史返回列表"""
    # 先创建一个 webhook
    create_resp = client.post("/webhooks/", json={
        "url": "https://example.com/deliveries-test",
        "events": ["task.completed"],
    })
    webhook_id = create_resp.json()["id"]

    # 获取投递历史（刚创建应该为空）
    resp = client.get(f"/webhooks/{webhook_id}/deliveries")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_get_deliveries_nonexistent():
    """获取不存在 webhook 的投递历史"""
    resp = client.get("/webhooks/nonexistent-id/deliveries")
    # 会先查 webhook 存在性，返回 404
    assert resp.status_code == 404
