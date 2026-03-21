"""
test_task_context - 任务上下文打包测试
"""
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from foxboard_backend.task_context import (
    build_task_context,
    get_recommended_docs,
    get_depends_on_tasks,
    get_project_summary,
)


class TestRecommendedDocs:
    """推荐文档解析测试"""

    def test_extracts_docs_paths(self):
        desc = "参考 docs/prd.md 和 refs/architecture.png 来实现"
        result = get_recommended_docs(desc, None)
        assert "docs/prd.md" in result
        assert "refs/architecture.png" in result

    def test_extracts_urls(self):
        desc = "详情见 https://example.com/docs 和 http://internal.company.com/api"
        result = get_recommended_docs(desc, None)
        assert "https://example.com/docs" in result
        assert "http://internal.company.com/api" in result

    def test_extracts_from_tags(self):
        tags = "docs/api.md refs/spec.md"
        result = get_recommended_docs(None, tags)
        assert "docs/api.md" in result
        assert "refs/spec.md" in result

    def test_no_duplicates(self):
        desc = "见 docs/prd.md，还有 docs/prd.md 这个文件"
        result = get_recommended_docs(desc, None)
        assert result.count("docs/prd.md") == 1

    def test_empty_input(self):
        assert get_recommended_docs(None, None) == []


class TestGetDependsOnTasks:
    """依赖任务查询测试（mock DB）"""

    def test_empty_depends_on(self):
        with patch("foxboard_backend.task_context.get_conn") as mock_conn:
            assert get_depends_on_tasks(None) == []
            assert get_depends_on_tasks("") == []

    def test_parses_comma_separated_ids(self):
        with patch("foxboard_backend.task_context.get_conn") as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.return_value.cursor.return_value = mock_cursor
            mock_cursor.fetchall.return_value = [
                {"id": "FB-001", "title": "任务1", "status": "DONE"},
                {"id": "FB-002", "title": "任务2", "status": "DOING"},
            ]

            result = get_depends_on_tasks("FB-001, FB-002")
            assert len(result) == 2
            assert result[0]["id"] == "FB-001"
            assert result[0]["status"] == "DONE"


class TestGetProjectSummary:
    """项目摘要测试"""

    def test_no_project_dir_returns_db_description(self):
        """PROJECT.md 不存在时降级到 db_description"""
        with patch("foxboard_backend.task_context._get_project_dir", return_value=None):
            result = get_project_summary("nonexistent", "DB项目描述")
            assert result == "DB项目描述"

    def test_no_project_dir_no_db_desc_returns_empty(self):
        with patch("foxboard_backend.task_context._get_project_dir", return_value=None):
            result = get_project_summary("nonexistent", None)
            assert result == ""


class TestBuildTaskContext:
    """完整上下文构建测试"""

    def test_build_returns_all_keys(self):
        with patch("foxboard_backend.task_context.get_conn") as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.return_value.cursor.return_value = mock_cursor
            mock_cursor.fetchall.return_value = []

            with patch("foxboard_backend.task_context._get_project_dir", return_value=None):
                ctx = build_task_context(
                    task_id="FB-TEST",
                    task_title="测试任务",
                    task_description="参考 docs/prd.md",
                    task_tags="",
                    task_depends_on="FB-001",
                    project_id=None,
                    project_name=None,
                    db_description="项目DB描述",
                )

        assert "project_summary" in ctx
        assert "task_description" in ctx
        assert "recommended_docs" in ctx
        assert "depends_on_tasks" in ctx
        assert "recent_activity" in ctx
        assert ctx["task_description"] == "参考 docs/prd.md"
        assert "docs/prd.md" in ctx["recommended_docs"]
