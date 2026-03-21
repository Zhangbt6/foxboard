"""
test_project_template - 项目模板初始化测试
"""
import pytest
import tempfile
import shutil
from pathlib import Path

from foxboard_backend.project_template import (
    init_project_template,
    get_project_dir,
    _get_project_root,
    PROJECT_MD_TEMPLATE,
)


class TestProjectTemplate:
    """项目模板初始化功能测试"""

    def test_init_creates_all_required_files(self, tmp_path):
        """验证所有必需目录和文件都被创建"""
        result = init_project_template(
            project_name="testproj",
            description="测试项目描述",
            owner="test_fox",
            status="active",
            project_root=tmp_path,
        )

        proj_dir = tmp_path / "testproj"
        assert proj_dir.exists()
        assert proj_dir.is_dir()

        # 顶层文件
        assert (proj_dir / "PROJECT.md").exists()
        assert (proj_dir / "BOARD.md").exists()
        assert (proj_dir / "DECISIONS.md").exists()

        # 子目录
        assert (proj_dir / "tasks").is_dir()
        assert (proj_dir / "docs").is_dir()
        assert (proj_dir / "refs").is_dir()

        # docs/PRD.md
        assert (proj_dir / "docs" / "PRD.md").exists()

    def test_init_idempotent_no_overwrite(self, tmp_path):
        """验证幂等性：已存在的文件不被覆盖"""
        proj_dir = tmp_path / "idempotent_proj"
        proj_dir.mkdir(parents=True)

        # 手动写入一个已存在的文件
        existing_file = proj_dir / "PROJECT.md"
        existing_file.write_text("手工内容不会被覆盖", encoding="utf-8")

        result = init_project_template(
            project_name="idempotent_proj",
            description="desc",
            owner="fox",
            status="active",
            project_root=tmp_path,
        )

        # 已有文件应该被跳过
        assert "PROJECT.md" in result["skipped_files"]
        assert existing_file.read_text(encoding="utf-8") == "手工内容不会被覆盖"

    def test_project_md_content(self, tmp_path):
        """验证 PROJECT.md 内容正确"""
        init_project_template(
            project_name="content_test",
            description="项目描述内容",
            owner="owner_fox",
            status="active",
            project_root=tmp_path,
        )

        content = (tmp_path / "content_test" / "PROJECT.md").read_text(encoding="utf-8")
        assert "content_test" in content
        assert "项目描述内容" in content
        assert "owner_fox" in content
        assert "active" in content

    def test_board_md_has_status_table(self, tmp_path):
        """验证 BOARD.md 包含状态说明表"""
        init_project_template(
            project_name="board_test",
            description="",
            owner="fox",
            status="active",
            project_root=tmp_path,
        )
        content = (tmp_path / "board_test" / "BOARD.md").read_text(encoding="utf-8")
        assert "TODO" in content
        assert "DOING" in content
        assert "REVIEW" in content
        assert "DONE" in content
        assert "BLOCKED" in content

    def test_prd_md_has_sections(self, tmp_path):
        """验证 PRD.md 包含必要章节"""
        init_project_template(
            project_name="prd_test",
            description="",
            owner="fox",
            status="active",
            project_root=tmp_path,
        )
        content = (tmp_path / "prd_test" / "docs" / "PRD.md").read_text(encoding="utf-8")
        assert "背景" in content
        assert "目标" in content
        assert "验收标准" in content

    def test_get_project_dir_uses_project_root(self, tmp_path):
        """验证 get_project_dir 使用指定的项目根目录"""
        result = get_project_dir("myproject", project_root=tmp_path)
        assert result == tmp_path / "myproject"

    def test_created_skipped_returned_correctly(self, tmp_path):
        """验证返回的 created_files 和 skipped_files 列表准确"""
        result = init_project_template(
            project_name="files_test",
            description="",
            owner="fox",
            status="active",
            project_root=tmp_path,
        )

        assert isinstance(result["created_files"], list)
        assert isinstance(result["skipped_files"], list)
        # 首次创建，所有文件都在 created_files
        assert "PROJECT.md" in result["created_files"]
        assert "BOARD.md" in result["created_files"]
        assert "DECISIONS.md" in result["created_files"]
        assert "docs/PRD.md" in result["created_files"]
        assert len(result["skipped_files"]) == 0
