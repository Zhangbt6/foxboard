#!/usr/bin/env python3
"""
grid_to_sprites.py — 宫格图自动裁剪脚本

从 Gemini 输出的宫格图（如 3x3=9宫格 / 4x4=16宫格）
自动裁剪为单帧 webp，输出到 public/sprites/。

用法：
  python3 grid_to_sprites.py input.webp --rows 3 --cols 3 --cell 64
  python3 grid_to_sprites.py input.webp --rows 4 --cols 4 --cell 64
  python3 grid_to_sprites.py input.webp --rows 4 --cols 4 --cell 64 --prefix myitem
  python3 grid_to_sprites.py input.webp --sheet 4x4 --cell 64  # 等价于 --rows 4 --cols 4

输出：
  public/sprites/<prefix>_00.webp
  public/sprites/<prefix>_01.webp
  ...
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional, List, Tuple, Union
from PIL import Image

# 默认输出目录（相对于仓库根目录）
REPO_ROOT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "sprites"
DEFAULT_CELL_SIZE = 64  # 默认 64x64 像素（64px 像素画）


def parse_sheet(sheet_str: str) -> Tuple[int, int]:
    """解析 '3x3' 或 '4x4' 格式为 (rows, cols)"""
    parts = sheet_str.lower().split("x")
    if len(parts) != 2:
        raise ValueError("无效 sheet 格式: {}，期望如 '3x3' 或 '4x4'".format(sheet_str))
    rows, cols = int(parts[0]), int(parts[1])
    if rows < 1 or cols < 1:
        raise ValueError("行列必须 >= 1: {}x{}".format(rows, cols))
    return rows, cols


def grid_to_sprites(
    input_path: str,
    rows: int,
    cols: int,
    cell_size: int = DEFAULT_CELL_SIZE,
    output_dir: Optional[Path] = None,
    prefix: Optional[str] = None,
    output_format: str = "webp",
) -> List[Path]:
    """
    将宫格图裁剪为单帧并输出。

    Args:
        input_path: 输入宫格图路径（PNG/WebP/JPG）
        rows: 行数
        cols: 列数
        cell_size: 每个单元格宽高（像素）
        output_dir: 输出目录
        prefix: 输出文件前缀（默认从输入文件名推断）
        output_format: 输出格式（webp/png）

    Returns:
        输出的文件路径列表
    """
    img = Image.open(input_path)
    img = img.convert("RGBA")

    # 自动推断行列（如果图尺寸与 cell_size 不整除，报错）
    img_w, img_h = img.size
    expected_w = cols * cell_size
    expected_h = rows * cell_size

    if img_w != expected_w or img_h != expected_h:
        print(
            "[警告] 图像尺寸 {}x{} 与 {}x{}×{} 不匹配，期望 {}x{}".format(
                img_w, img_h, rows, cols, cell_size, expected_w, expected_h
            ),
            file=sys.stderr,
        )
        # 按比例裁剪到期望尺寸
        img = img.resize((expected_w, expected_h), Image.NEAREST)
        print("[信息] 已缩放至 {}x{}".format(expected_w, expected_h), file=sys.stderr)

    if prefix is None:
        # 从输入文件名推断前缀
        stem = Path(input_path).stem
        # 去掉常见后缀
        for suffix in ("_grid", "_sheet", "_spritesheet", "_"):
            if stem.endswith(suffix):
                stem = stem[: -len(suffix)]
        prefix = stem

    out_dir = output_dir or REPO_ROOT
    out_dir.mkdir(parents=True, exist_ok=True)

    outputs: List[Path] = []
    for r in range(rows):
        for c in range(cols):
            x = c * cell_size
            y = r * cell_size
            frame = img.crop((x, y, x + cell_size, y + cell_size))
            idx = r * cols + c
            out_name = "{}_{:02d}.{}".format(prefix, idx, output_format)
            out_path = out_dir / out_name
            frame.save(out_path, format=output_format.upper())
            outputs.append(out_path)
            print("  [{:02d}] {}".format(idx, out_name))

    print("\n✅ 共输出 {} 个文件至 {}/".format(len(outputs), out_dir))
    return outputs


def make_spritesheet(
    input_path: str,
    rows: int,
    cols: int,
    cell_size: int = DEFAULT_CELL_SIZE,
    output_path: Optional[str] = None,
) -> Path:
    """
    将宫格图合成为单行 spritesheet（所有帧水平排列）。
    输出格式: PNG（Phaser 兼容）。

    Args:
        input_path: 输入宫格图路径
        rows: 行数
        cols: 列数
        cell_size: 每个单元格宽高
        output_path: 输出路径（默认在输入同目录，扩展名改为 _spritesheet.png）

    Returns:
        输出的 spritesheet 路径
    """
    img = Image.open(input_path).convert("RGBA")
    img_w, img_h = img.size
    expected_w, expected_h = cols * cell_size, rows * cell_size

    if img_w != expected_w or img_h != expected_h:
        img = img.resize((expected_w, expected_h), Image.NEAREST)

    total_frames = rows * cols
    sheet_w = total_frames * cell_size
    sheet_h = cell_size
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    for idx in range(total_frames):
        r, c = divmod(idx, cols)
        x, y = c * cell_size, r * cell_size
        frame = img.crop((x, y, x + cell_size, y + cell_size))
        sheet.paste(frame, (idx * cell_size, 0))

    if output_path is None:
        stem = Path(input_path).stem
        output_path = str(Path(input_path).parent / "{}_spritesheet.png".format(stem))

    sheet.save(output_path, format="PNG")
    print("✅ Spritesheet 已保存: {}".format(output_path))
    return Path(output_path)


def main():
    parser = argparse.ArgumentParser(
        description="宫格图自动裁剪为单帧精灵图",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  # 3x3 宫格（9宫格），64px 单元格
  python3 grid_to_sprites.py lotus_grid.webp --rows 3 --cols 3 --cell 64

  # 4x4 宫格（16宫格），使用 sheet 别名
  python3 grid_to_sprites.py tech_grid.webp --sheet 4x4 --cell 64

  # 指定前缀，输出到自定义目录
  python3 grid_to_sprites.py input.webp --rows 4 --cols 4 --prefix myitem --outdir ./output

  # 合成为 spritesheet（用于 Phaser）
  python3 grid_to_sprites.py input.webp --rows 4 --cols 4 --cell 64 --spritesheet

  # 批量处理：处理目录下所有 webp
  python3 grid_to_sprites.py ./raw_grids/ --batch --rows 4 --cols 4 --cell 64
""",
    )
    parser.add_argument("input", help="输入宫格图路径（或目录路径，当 --batch 时）")
    parser.add_argument(
        "--rows", "-r", type=int, default=None, help="宫格行数（与 --sheet 二选一）"
    )
    parser.add_argument(
        "--cols",
        "-c",
        type=int,
        default=None,
        help="宫格列数（与 --sheet 二选一）",
    )
    parser.add_argument(
        "--sheet",
        "-s",
        type=str,
        default=None,
        help="宫格规格，如 '3x3'、'4x4'（与 --rows/--cols 二选一）",
    )
    parser.add_argument(
        "--cell",
        "-w",
        type=int,
        default=DEFAULT_CELL_SIZE,
        help="单元格宽高（像素，默认 {}）".format(DEFAULT_CELL_SIZE),
    )
    parser.add_argument(
        "--prefix", "-p", type=str, default=None, help="输出文件前缀（默认从输入文件名推断）"
    )
    parser.add_argument(
        "--outdir",
        "-o",
        type=Path,
        default=None,
        help="输出目录（默认 {}）".format(REPO_ROOT),
    )
    parser.add_argument(
        "--format", "-f", default="webp", choices=["webp", "png"], help="输出格式（默认 webp）"
    )
    parser.add_argument(
        "--spritesheet",
        action="store_true",
        help="输出 spritesheet（水平排列）而非单帧",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="批量处理：input 为目录，处理目录下所有 webp/png",
    )

    args = parser.parse_args()

    # 解析行列数
    if args.sheet:
        rows, cols = parse_sheet(args.sheet)
    elif args.rows is not None and args.cols is not None:
        rows, cols = args.rows, args.cols
    else:
        print("[错误] 必须指定 --sheet 或同时指定 --rows 和 --cols", file=sys.stderr)
        sys.exit(1)

    input_path = Path(args.input)

    # 批量模式
    if args.batch:
        if not input_path.is_dir():
            print("[错误] --batch 模式需要指定目录: {}".format(input_path), file=sys.stderr)
            sys.exit(1)

        image_files = []
        for ext in ("*.webp", "*.png", "*.jpg", "*.jpeg"):
            image_files.extend(input_path.glob(ext))
            image_files.extend(input_path.glob(ext.upper()))

        if not image_files:
            print("[信息] 目录 {} 中未找到图片文件".format(input_path))
            sys.exit(0)

        print("📁 批量处理 {} 个文件:\n".format(len(image_files)))
        for img_file in sorted(image_files):
            print("\n▶ 处理: {}".format(img_file.name))
            try:
                grid_to_sprites(
                    str(img_file),
                    rows,
                    cols,
                    args.cell,
                    args.outdir,
                    prefix=img_file.stem,
                    output_format=args.format,
                )
            except Exception as e:
                print("  ❌ 失败: {}".format(e), file=sys.stderr)
        print("\n✅ 批量处理完成")
        return

    # 单文件模式
    if args.spritesheet:
        make_spritesheet(
            str(input_path),
            rows,
            cols,
            args.cell,
        )
    else:
        grid_to_sprites(
            str(input_path),
            rows,
            cols,
            args.cell,
            args.outdir,
            args.prefix,
            args.format,
        )


if __name__ == "__main__":
    main()
