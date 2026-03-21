#!/bin/bash
# FoxBoard 家具素材批处理脚本
# 使用 pixelate_pipeline.py 将 furniture/ 下的原始素材批量处理为像素风格
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PIPELINE="$SCRIPT_DIR/pixelate_pipeline.py"
INPUT_DIR="$REPO_DIR/frontend/public/static/furniture"
OUTPUT_DIR="$REPO_DIR/frontend/public/static/furniture_processed"
SIZE=64

echo "=== 家具素材像素化批处理 ==="
echo "输入: $INPUT_DIR"
echo "输出: $OUTPUT_DIR"
echo "尺寸: ${SIZE}x${SIZE}"
echo ""

if [ ! -f "$PIPELINE" ]; then
    echo "❌ pixelate_pipeline.py 未找到: $PIPELINE"
    exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
    echo "❌ 输入目录不存在: $INPUT_DIR"
    exit 1
fi

count=0
for src in "$INPUT_DIR"/*.webp; do
    if [ -f "$src" ]; then
        fname=$(basename "$src")
        dst="$OUTPUT_DIR/${fname}"
        echo "处理: $fname"
        python3 "$PIPELINE" pixelate -i "$src" -o "$dst" -s "$SIZE"
        count=$((count + 1))
    fi
done

echo ""
echo "✅ 完成，共处理 $count 个文件 → $OUTPUT_DIR/"
