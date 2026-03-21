"""
test_foxboard_sdk.py — FoxBoardSDK 单元测试
用 unittest.mock 模拟 HTTP 请求，不依赖真实后端。

覆盖：
  - 所有 SDK 方法的请求参数构造
  - 异常映射（FoxBoardError / NotFoundError / ValidationError / AuthError）
  - CLI argparse 解析
Author: 小青狐 | FB-041
"""
import json
import sys
import unittest
from unittest.mock import MagicMock, patch

# 确保 SDK 路径可导入
sys.path.insert(0, "/home/muyin/.openclaw/workspace/scripts")

from foxboard_sdk import (
    FoxBoardSDK,
    FoxBoardError,
    FoxBoardNotFoundError,
    FoxBoardValidationError,
    FoxBoardAuthError,
)


# ============================================================================
# 辅助函数
# ============================================================================

def mock_response(
    status_code: int = 200,
    json_data: dict = None,
    text: str = "",
):
    """构造一个 mock Response 对象"""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    if json_data is not None:
        resp.json = MagicMock(return_value=json_data)
    else:
        resp.json = MagicMock(side_effect=ValueError("no json"))
    return resp


# ============================================================================
# FoxBoardSDK 方法测试
# ============================================================================

class TestSDKProjectMethods(unittest.TestCase):
    """项目 API"""

    def setUp(self):
        self.sdk = FoxBoardSDK(base_url="http://test:8000")

    @patch("requests.Session.post")
    def test_create_project(self, mock_post):
        mock_post.return_value = mock_response(201, {
            "id": "proj-1", "name": "测试项目", "owner": "花火",
            "status": "active", "created_at": "2026-01-01T00:00:00",
            "updated_at": "2026-01-01T00:00:00",
        })

        result = self.sdk.create_project(
            id="proj-1",
            name="测试项目",
            description="一个测试",
            owner="花火",
        )

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["id"], "proj-1")
        self.assertEqual(call_kwargs["json"]["name"], "测试项目")
        self.assertEqual(result["id"], "proj-1")

    @patch("requests.Session.get")
    def test_list_projects(self, mock_get):
        mock_get.return_value = mock_response(200, [
            {"id": "proj-1", "name": "P1", "status": "active"},
            {"id": "proj-2", "name": "P2", "status": "archived"},
        ])

        result = self.sdk.list_projects()

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)
        mock_get.assert_called_once()

    @patch("requests.Session.get")
    def test_get_project(self, mock_get):
        mock_get.return_value = mock_response(200, {"id": "proj-1", "name": "P1"})
        result = self.sdk.get_project("proj-1")
        self.assertEqual(result["id"], "proj-1")

    @patch("requests.Session.get")
    def test_get_project_not_found(self, mock_get):
        mock_get.return_value = mock_response(404, {"detail": "Project not found"})
        with self.assertRaises(FoxBoardNotFoundError) as ctx:
            self.sdk.get_project("nonexistent")
        self.assertIn("not found", str(ctx.exception).lower())

    # ---- 异常映射 ----

    @patch("requests.Session.get")
    def test_404_raises_not_found(self, mock_get):
        mock_get.return_value = mock_response(404, {"detail": "Not found"})
        with self.assertRaises(FoxBoardNotFoundError):
            self.sdk.list_projects()

    @patch("requests.Session.post")
    def test_400_raises_validation_error(self, mock_post):
        mock_post.return_value = mock_response(400, {"detail": "Task already exists"})
        with self.assertRaises(FoxBoardValidationError):
            self.sdk.create_project(id="dup", name="dup")

    @patch("requests.Session.post")
    def test_401_raises_auth_error(self, mock_post):
        mock_post.return_value = mock_response(401, {"detail": "Unauthorized"})
        with self.assertRaises(FoxBoardAuthError):
            self.sdk.create_project(id="x", name="x")


class TestSDKTaskMethods(unittest.TestCase):
    """任务 API"""

    def setUp(self):
        self.sdk = FoxBoardSDK(base_url="http://test:8000")
        self.sample_task = {
            "id": "FB-T1",
            "title": "测试任务",
            "status": "TODO",
            "priority": 5,
            "assignee_id": None,
            "project_id": None,
            "description": None,
            "tags": None,
            "started_at": None,
            "depends_on": None,
            "created_at": "2026-01-01T00:00:00",
            "updated_at": "2026-01-01T00:00:00",
            "completed_at": None,
        }

    @patch("requests.Session.post")
    def test_create_task(self, mock_post):
        mock_post.return_value = mock_response(201, self.sample_task)

        result = self.sdk.create_task(
            id="FB-T1",
            title="测试任务",
            priority=5,
            project_id="FoxBoard",
        )

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["id"], "FB-T1")
        self.assertEqual(call_kwargs["json"]["title"], "测试任务")
        self.assertEqual(result["id"], "FB-T1")

    @patch("requests.Session.get")
    def test_list_tasks(self, mock_get):
        mock_get.return_value = mock_response(200, [self.sample_task])
        result = self.sdk.list_tasks(status="TODO", project_id="FoxBoard")
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        call_kwargs = mock_get.call_args[1]
        self.assertEqual(call_kwargs["params"]["status"], "TODO")
        self.assertEqual(call_kwargs["params"]["project_id"], "FoxBoard")

    @patch("requests.Session.get")
    def test_get_task(self, mock_get):
        mock_get.return_value = mock_response(200, self.sample_task)
        result = self.sdk.get_task("FB-T1")
        self.assertEqual(result["id"], "FB-T1")

    @patch("requests.Session.post")
    def test_claim_task(self, mock_post):
        doing_task = dict(self.sample_task, status="DOING", started_at="2026-01-01T01:00:00")
        mock_post.return_value = mock_response(200, {
            "ok": True, "task": doing_task, "message": "任务已领取"
        })

        result = self.sdk.claim_task("FB-T1", "qing_fox")

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["agent_id"], "qing_fox")
        self.assertTrue(result["ok"])
        self.assertEqual(result["task"]["status"], "DOING")

    @patch("requests.Session.post")
    def test_submit_task(self, mock_post):
        review_task = dict(self.sample_task, status="REVIEW")
        mock_post.return_value = mock_response(200, {
            "ok": True, "task": review_task, "message": "任务已提交"
        })

        result = self.sdk.submit_task("FB-T1", "qing_fox", message="功能开发完成")

        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["agent_id"], "qing_fox")
        self.assertEqual(call_kwargs["json"]["message"], "功能开发完成")
        self.assertTrue(result["ok"])
        self.assertEqual(result["task"]["status"], "REVIEW")

    @patch("requests.Session.post")
    def test_review_task_passed(self, mock_post):
        done_task = dict(self.sample_task, status="DONE", completed_at="2026-01-01T02:00:00")
        mock_post.return_value = mock_response(200, {
            "ok": True, "task": done_task, "message": "审核通过"
        })

        result = self.sdk.review_task("FB-T1", "black_fox", passed=True)

        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["auditor_id"], "black_fox")
        self.assertTrue(result["ok"])
        self.assertEqual(result["task"]["status"], "DONE")

    @patch("requests.Session.post")
    def test_review_task_rejected(self, mock_post):
        doing_task = dict(self.sample_task, status="DOING")
        mock_post.return_value = mock_response(200, {
            "ok": True, "task": doing_task, "message": "任务已打回"
        })

        result = self.sdk.review_task(
            "FB-T1", "black_fox", passed=False, reason="逻辑有误，请修复"
        )

        # passed=False 内部调用 reject_task，走 /reject endpoint
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["auditor_id"], "black_fox")
        self.assertEqual(call_kwargs["json"]["reason"], "逻辑有误，请修复")
        self.assertTrue(result["ok"])

    @patch("requests.Session.post")
    def test_reject_task(self, mock_post):
        doing_task = dict(self.sample_task, status="DOING")
        mock_post.return_value = mock_response(200, {
            "ok": True, "task": doing_task, "message": "任务已打回"
        })

        result = self.sdk.reject_task("FB-T1", "black_fox", "缺少单元测试")

        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs["json"]["reason"], "缺少单元测试")
        self.assertTrue(result["ok"])

    @patch("requests.Session.get")
    def test_my_tasks(self, mock_get):
        mock_get.return_value = mock_response(200, [self.sample_task])
        result = self.sdk.my_tasks("qing_fox", status="TODO")
        call_kwargs = mock_get.call_args[1]
        self.assertEqual(call_kwargs["params"]["agent_id"], "qing_fox")
        self.assertEqual(call_kwargs["params"]["status"], "TODO")
        self.assertEqual(len(result), 1)

    @patch("requests.Session.post")
    def test_bulk_create_tasks(self, mock_post):
        mock_post.return_value = mock_response(200, {
            "ok": True,
            "created": [self.sample_task],
            "failed": [],
        })
        tasks_list = [
            {"id": "FB-B1", "title": "批量任务1", "priority": 5},
            {"id": "FB-B2", "title": "批量任务2"},
        ]
        result = self.sdk.bulk_create_tasks("FoxBoard", tasks_list)
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["created"]), 1)
        self.assertEqual(len(result["failed"]), 0)

    @patch("requests.Session.delete")
    def test_delete_task(self, mock_delete):
        mock_delete.return_value = mock_response(200, {"ok": True, "deleted": "FB-T1"})
        result = self.sdk.delete_task("FB-T1")
        self.assertTrue(result["ok"])

    @patch("requests.Session.get")
    def test_kanban(self, mock_get):
        mock_get.return_value = mock_response(200, {
            "columns": [
                {"status": "TODO", "tasks": [self.sample_task]},
                {"status": "DOING", "tasks": []},
                {"status": "REVIEW", "tasks": []},
                {"status": "DONE", "tasks": []},
            ]
        })
        result = self.sdk.kanban()
        self.assertIn("columns", result)
        self.assertEqual(len(result["columns"]), 4)


class TestSDKBoundaryErrors(unittest.TestCase):
    """边界与异常"""

    def setUp(self):
        self.sdk = FoxBoardSDK(base_url="http://test:8000")

    @patch("requests.Session.post")
    def test_connection_error(self, mock_post):
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError("Connection refused")
        with self.assertRaises(FoxBoardError) as ctx:
            self.sdk.create_project(id="x", name="x")
        self.assertIn("无法连接到", str(ctx.exception))

    @patch("requests.Session.post")
    def test_timeout_error(self, mock_post):
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("timed out")
        with self.assertRaises(FoxBoardError) as ctx:
            self.sdk.create_project(id="x", name="x")
        self.assertIn("超时", str(ctx.exception))

    @patch("requests.Session.post")
    def test_500_internal_error(self, mock_post):
        mock_post.return_value = mock_response(500, {"detail": "Internal server error"})
        with self.assertRaises(FoxBoardError) as ctx:
            self.sdk.create_project(id="x", name="x")
        self.assertEqual(ctx.exception.status_code, 500)


class TestSDKCLIArgs(unittest.TestCase):
    """CLI 参数解析"""

    def test_claim_args(self):
        with patch.object(FoxBoardSDK, "claim_task", return_value={"ok": True}) as mock:
            with patch("sys.stdout", new=MagicMock()):
                import argparse
                from foxboard_sdk import _build_parser
                parser = _build_parser()
                args = parser.parse_args(["claim", "FB-038", "qing_fox"])
                self.assertEqual(args.cmd, "claim")
                self.assertEqual(args.task_id, "FB-038")
                self.assertEqual(args.agent_id, "qing_fox")

    def test_review_args(self):
        with patch.object(FoxBoardSDK, "review_task", return_value={"ok": True}):
            with patch("sys.stdout", new=MagicMock()):
                from foxboard_sdk import _build_parser
                parser = _build_parser()
                args = parser.parse_args(["review", "FB-038", "black_fox"])
                self.assertEqual(args.task_id, "FB-038")
                self.assertEqual(args.reviewer_id, "black_fox")
                self.assertTrue(args.passed)

    def test_review_reject_args(self):
        with patch.object(FoxBoardSDK, "reject_task", return_value={"ok": True}):
            with patch("sys.stdout", new=MagicMock()):
                from foxboard_sdk import _build_parser
                parser = _build_parser()
                args = parser.parse_args([
                    "review", "FB-038", "black_fox",
                    "--reject", "--reason", "逻辑错误"
                ])
                self.assertTrue(args.reject)
                self.assertEqual(args.reason, "逻辑错误")


if __name__ == "__main__":
    unittest.main()
