#!/bin/bash
# FoxBoard 家具素材批处理脚本
# 使用 pixelate_pipeline.py 将原始家具素材批量像素化处理
#
# 用法：
#   bash scripts/process_furniture.sh [输入目录] [输出目录] [像素尺寸]
#
# 示例：
#   bash scripts/process_furniture.sh frontend/public/static/ frontend/public/static/furniture_processed/ 64
#
# 依赖：
#   - scripts/pixelate_pipeline.py
#   - Pillow: pip install Pillow

set -e

INPUT_DIR="${1:-frontend/public/static/furniture}"
OUTPUT_DIR="${2:-frontend/public/static/furniture_processed}"
PIXEL_SIZE="${3:-64}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "FoxBoard 家具像素化批处理"
echo "=========================================="
echo "输入目录: $INPUT_DIR"
echo "输出目录: $OUTPUT_DIR"
echo "像素尺寸: ${PIXEL_SIZE}x${PIXEL_SIZE}"
echo ""

# 检查 pixelate_pipeline.py
PIPELINE="$REPO_DIR/scripts/pixelate_pipeline.py"
if [ ! -f "$PIPELINE" ]; then
    echo "❌ 错误: 找不到 pixelate_pipeline.py: $PIPELINE"
    exit 1
fi

# 检查输入目录
if [ ! -d "$INPUT_DIR" ]; then
    echo "❌ 错误: 找不到输入目录: $INPUT_DIR"
    echo "   提示: 请先确保 FB-069（家具原始素材）已完成"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 收集图片文件
SUPPORTED_EXT="png|jpg|jpeg|webp|bmp"
INPUT_FILES=$(find "$INPUT_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.webp" -o -iname "*.bmp" \) | sort)

if [ -z "$INPUT_FILES" ]; then
    echo "⚠️  警告: 在 $INPUT_DIR 中没有找到图片文件"
    exit 0
fi

FILE_COUNT=$(echo "$INPUT_FILES" | wc -l)
echo "找到 $FILE_COUNT 个图片文件"
echo ""

# 逐个处理
PROCESSED=0
FAILED=0
for FILE in $INPUT_FILES; do
    BASENAME=$(basename "$FILE")
    NAME="${BASENAME%.*}"
    OUTPUT_FILE="$OUTPUT_DIR/${NAME}_${PIXEL_SIZE}.webp"
    
    echo -n "处理: $BASENAME ... "
    
    if python3 "$PIPELINE" pixelate \
        --input "$FILE" \
        --output "$OUTPUT_FILE" \
        --size "$PIXEL_SIZE" \
        > /dev/null 2>&1; then
        echo "✅ → ${NAME}_${PIXEL_SIZE}.webp"
        PROCESSED=$((PROCESSED + 1))
    else
        echo "❌ 失败"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=========================================="
echo "处理完成: $PROCESSED 成功, $FAILED 失败"
echo "输出目录: $OUTPUT_DIR"
echo "=========================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
exit 0
