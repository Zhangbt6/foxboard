#!/usr/bin/env python3
"""
FoxBoard 像素化处理流水线
将AI生成的普通图片转换为像素风格并制作spritesheet

Usage:
    python3 pixelate_pipeline.py pixelate --input img.png --output out.webp --size 64
    python3 pixelate_pipeline.py sheet --input-dir frames/ --output sprite.webp --frame-size 64
"""

import argparse
import os
import sys
from pathlib import Path
from PIL import Image

def pixelate_image(input_path: str, output_path: str, size: int):
    """将图片像素化并调整为指定尺寸"""
    img = Image.open(input_path).convert("RGBA")
    
    # 计算缩小比例，保留尽可能多的细节
    original_size = img.size
    scale_factor = max(1, min(original_size) // (size * 4))
    if scale_factor > 1:
        small_size = (original_size[0] // scale_factor, original_size[1] // scale_factor)
        img = img.resize(small_size, Image.NEAREST)
    
    # 像素化：缩小后放大回目标尺寸，使用NEAREST保持像素感
    pixelated = img.resize((size, size), Image.NEAREST)
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    
    # 保存为webp（无损）
    pixelated.save(output_path, "WEBP", lossless=True)
    print(f"✅ Pixelated: {input_path} → {output_path} ({size}x{size})")
    return True

def create_spritesheet(input_dir: str, output_path: str, frame_size: int):
    """将目录中的多帧图片合成为横排spritesheet"""
    input_path = Path(input_dir)
    if not input_path.is_dir():
        print(f"❌ Input directory not found: {input_dir}", file=sys.stderr)
        return False
    
    # 收集所有图片文件，按文件名排序
    extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
    frames = []
    for f in sorted(input_path.iterdir()):
        if f.suffix.lower() in extensions:
            frames.append(f)
    
    if not frames:
        print(f"❌ No image frames found in {input_dir}", file=sys.stderr)
        return False
    
    # 处理每一帧
    processed_frames = []
    for frame_path in frames:
        img = Image.open(frame_path).convert("RGBA")
        # 调整为统一帧尺寸
        if img.size != (frame_size, frame_size):
            img = img.resize((frame_size, frame_size), Image.NEAREST)
        processed_frames.append(img)
    
    # 创建横排spritesheet
    sheet_width = frame_size * len(processed_frames)
    sheet = Image.new("RGBA", (sheet_width, frame_size), (0, 0, 0, 0))
    for i, frame in enumerate(processed_frames):
        sheet.paste(frame, (i * frame_size, 0))
    
    # 保存
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    sheet.save(output_path, "WEBP", lossless=True)
    print(f"✅ Spritesheet: {len(processed_frames)} frames → {output_path} ({sheet_width}x{frame_size})")
    return True

def main():
    parser = argparse.ArgumentParser(
        description="FoxBoard 像素化处理流水线：图片像素化 + spritesheet合成",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    # pixelate 子命令
    p_pixelate = subparsers.add_parser("pixelate", help="将图片像素化")
    p_pixelate.add_argument("--input", "-i", required=True, help="输入图片路径")
    p_pixelate.add_argument("--output", "-o", required=True, help="输出webp路径")
    p_pixelate.add_argument("--size", "-s", type=int, required=True, help="输出像素尺寸（如64, 128）")
    
    # sheet 子命令
    p_sheet = subparsers.add_parser("sheet", help="将多帧图片合成为spritesheet")
    p_sheet.add_argument("--input-dir", "-d", required=True, help="输入帧目录")
    p_sheet.add_argument("--output", "-o", required=True, help="输出webp路径")
    p_sheet.add_argument("--frame-size", "-s", type=int, required=True, help="单帧像素尺寸")
    
    args = parser.parse_args()
    
    if args.command == "pixelate":
        success = pixelate_image(args.input, args.output, args.size)
    elif args.command == "sheet":
        success = create_spritesheet(args.input_dir, args.output, args.frame_size)
    else:
        parser.print_help()
        sys.exit(1)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
