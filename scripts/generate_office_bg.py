#!/usr/bin/env python3
"""
生成办公室背景图 - 3种风格
- 像素风(pixel art)、俯视45度、暗色调
- 尺寸: 1920x1080 (按比例缩放)
- 输出: webp格式
"""

from PIL import Image, ImageDraw
import os

OUTPUT_DIR = "/home/muyin/.openclaw/workspace/repos/foxboard/frontend/public/static"

# 调色板 - 像素风办公室
colors = {
    'floor_dark': '#2a2d35',      # 深灰地板
    'floor_mid': '#3a3d45',       # 中灰地板
    'floor_light': '#4a4d55',    # 浅灰地板
    'wall_dark': '#1a1d22',       # 深色墙壁
    'wall_mid': '#25282d',        # 中色墙壁
    'desk_dark': '#5c4033',       # 深木色桌子
    'desk_mid': '#6d4c3d',        # 中木色桌子
    'desk_light': '#8b6b5d',      # 浅木色桌子
    'chair_dark': '#3d3d3d',      # 深灰椅子
    'chair_mid': '#4d4d4d',       # 中灰椅子
    'screen_glow': '#5a7a5a',     # 屏幕绿光
    'screen_blue': '#4a6a8a',     # 屏幕蓝光
    'screen_amber': '#8a6a4a',    # 屏幕琥珀色
    'accent_red': '#8a4a4a',      # 红色点缀
    'accent_green': '#4a6a4a',    # 绿色点缀
    'plant_green': '#3a5a3a',     # 植物绿
    'lamp_yellow': '#f0c040',     # 台灯黄
    'lamp_glow': '#f8e080',       # 台灯光晕
}

def create_base_image(width=1920, height=1080, bg_color='floor_dark'):
    """创建基础画布"""
    img = Image.new('RGB', (width, height), colors[bg_color])
    return img

def draw_pixel_rect(draw, x, y, w, h, color, pixel_size=4):
    """绘制像素风格的矩形"""
    # 对齐到像素网格
    x = (x // pixel_size) * pixel_size
    y = (y // pixel_size) * pixel_size
    w = (w // pixel_size) * pixel_size
    h = (h // pixel_size) * pixel_size
    draw.rectangle([x, y, x + w, y + h], fill=color)

def draw_dithered_floor(draw, width, height, pixel_size=8):
    """绘制像素风格的地板（棋盘格抖动效果）"""
    for y in range(0, height, pixel_size):
        for x in range(0, width, pixel_size):
            # 基于位置的伪随机抖动
            pattern = ((x // pixel_size) + (y // pixel_size) * 3) % 5
            if pattern == 0:
                color = colors['floor_light']
            elif pattern == 1:
                color = colors['floor_mid']
            else:
                color = colors['floor_dark']
            draw.rectangle([x, y, x + pixel_size, y + pixel_size], fill=color)

def draw_isometric_cube(draw, x, y, size, color_top, color_left, color_right, pixel_size=4):
    """绘制等距立方体（用于桌子等）"""
    h = size // 2
    
    # 顶面（菱形）
    top_points = [
        (x, y),
        (x + size, y - h),
        (x + size * 2, y),
        (x + size, y + h)
    ]
    # 对齐到像素网格
    top_points = [((p[0] // pixel_size) * pixel_size, (p[1] // pixel_size) * pixel_size) for p in top_points]
    draw.polygon(top_points, fill=color_top)

def draw_desk_station(draw, x, y, width, depth, style='default'):
    """绘制一个工位（桌子+椅子+屏幕）"""
    pixel_size = 4
    
    if style == 'geek':
        desk_color = colors['desk_dark']
        screen_color = colors['screen_blue']
        screen_glow = colors['screen_blue']
    elif style == 'cozy':
        desk_color = colors['desk_light']
        screen_color = colors['screen_amber']
        screen_glow = colors['lamp_yellow']
    else:  # default
        desk_color = colors['desk_mid']
        screen_color = colors['screen_glow']
        screen_glow = colors['screen_glow']
    
    # 桌子（俯视角度的矩形）
    desk_w = (width // pixel_size) * pixel_size
    desk_d = (depth // pixel_size) * pixel_size
    x_aligned = (x // pixel_size) * pixel_size
    y_aligned = (y // pixel_size) * pixel_size
    
    # 桌腿/桌面阴影
    draw.rectangle([x_aligned + pixel_size*2, y_aligned + pixel_size*2, 
                    x_aligned + desk_w, y_aligned + desk_d], 
                   fill=colors['floor_dark'])
    # 桌面
    draw.rectangle([x_aligned, y_aligned, x_aligned + desk_w - pixel_size*2, y_aligned + desk_d - pixel_size*2], 
                   fill=desk_color)
    
    # 桌沿高光
    draw.rectangle([x_aligned, y_aligned, x_aligned + desk_w - pixel_size*2, y_aligned + pixel_size], 
                   fill=colors['desk_light'])
    
    # 显示器
    monitor_w = desk_w // 3
    monitor_h = desk_d // 2
    mx = x_aligned + desk_w // 2 - monitor_w // 2
    my = y_aligned + pixel_size * 3
    
    # 显示器底座
    draw.rectangle([mx + monitor_w//3, my + monitor_h, mx + monitor_w*2//3, my + monitor_h + pixel_size*2], 
                   fill=colors['chair_dark'])
    # 显示器边框
    draw.rectangle([mx, my, mx + monitor_w, my + monitor_h], 
                   fill=colors['wall_mid'])
    # 屏幕（发光效果）
    draw.rectangle([mx + pixel_size, my + pixel_size, mx + monitor_w - pixel_size, my + monitor_h - pixel_size], 
                   fill=screen_color)
    # 屏幕高光
    draw.rectangle([mx + pixel_size, my + pixel_size, mx + monitor_w - pixel_size, my + pixel_size*2], 
                   fill=screen_glow)

def draw_plant_pot(draw, x, y, size=60):
    """绘制盆栽"""
    pixel_size = 4
    # 花盆
    pot_w = (size // pixel_size) * pixel_size
    pot_h = pot_w * 3 // 4
    x_aligned = (x // pixel_size) * pixel_size
    y_aligned = (y // pixel_size) * pixel_size
    
    # 花盆阴影
    draw.rectangle([x_aligned + pixel_size*2, y_aligned + pixel_size*2, 
                    x_aligned + pot_w, y_aligned + pot_h], 
                   fill=colors['floor_dark'])
    # 花盆主体
    draw.rectangle([x_aligned, y_aligned, x_aligned + pot_w - pixel_size*2, y_aligned + pot_h - pixel_size*2], 
                   fill=colors['desk_mid'])
    
    # 植物叶子（简单的绿色像素块）
    leaf_color = colors['plant_green']
    for i in range(5):
        lx = x_aligned + (i * pot_w // 5) + pixel_size*2
        ly = y_aligned - pixel_size * (3 + i % 3)
        lw = pixel_size * (2 + i % 2)
        lh = pixel_size * (3 + i % 3)
        draw.rectangle([lx, ly, lx + lw, ly + lh], fill=leaf_color)

def draw_lamp(draw, x, y, size=50):
    """绘制台灯"""
    pixel_size = 4
    # 灯座
    base_w = (size // pixel_size) * pixel_size
    base_h = pixel_size * 2
    x_aligned = (x // pixel_size) * pixel_size
    y_aligned = (y // pixel_size) * pixel_size
    
    # 灯杆
    pole_h = size
    draw.rectangle([x_aligned + base_w//2 - pixel_size, y_aligned - pole_h, 
                    x_aligned + base_w//2 + pixel_size, y_aligned], 
                   fill=colors['chair_mid'])
    
    # 灯罩
    shade_w = base_w + pixel_size * 4
    shade_h = pixel_size * 3
    shade_y = y_aligned - pole_h
    draw.rectangle([x_aligned + base_w//2 - shade_w//2, shade_y, 
                    x_aligned + base_w//2 + shade_w//2, shade_y + shade_h], 
                   fill=colors['lamp_yellow'])
    
    # 发光效果（半透明黄色区域）
    glow_w = shade_w + pixel_size * 4
    glow_h = pixel_size * 6
    glow_y = shade_y + shade_h
    for i in range(3):
        alpha = 0.3 - i * 0.1
        gy = glow_y + i * pixel_size * 2
        # 简化的发光效果 - 用更亮的颜色
        glow_color = colors['lamp_glow'] if i == 0 else colors['lamp_yellow']
        draw.rectangle([x_aligned + base_w//2 - glow_w//2 + i*pixel_size*2, gy, 
                        x_aligned + base_w//2 + glow_w//2 - i*pixel_size*2, gy + pixel_size*2], 
                       fill=glow_color)

def generate_office_bg(style='default', width=1920, height=1080):
    """生成办公室背景图"""
    # 创建基础图像
    img = create_base_image(width, height, 'floor_dark')
    draw = ImageDraw.Draw(img)
    
    # 绘制地板（抖动效果）
    draw_dithered_floor(draw, width, height, pixel_size=8)
    
    # 根据风格设置参数
    if style == 'geek':
        desk_positions = [
            (200, 150, 300, 200, 'geek'),
            (600, 100, 350, 220, 'geek'),
            (1100, 150, 300, 200, 'geek'),
            (1600, 200, 250, 180, 'geek'),
        ]
        lamp_count = 4
        plant_count = 1
        extra_gear = True
    elif style == 'cozy':
        desk_positions = [
            (300, 200, 280, 180, 'cozy'),
            (800, 150, 320, 200, 'cozy'),
            (1400, 180, 300, 190, 'cozy'),
        ]
        lamp_count = 6
        plant_count = 5
        extra_gear = False
    else:  # default
        desk_positions = [
            (250, 180, 300, 200, 'default'),
            (700, 120, 350, 220, 'default'),
            (1200, 180, 300, 200, 'default'),
            (1650, 250, 280, 180, 'default'),
        ]
        lamp_count = 3
        plant_count = 3
        extra_gear = False
    
    # 绘制工位
    for dx, dy, dw, dd, dstyle in desk_positions:
        draw_desk_station(draw, dx, dy, dw, dd, style=dstyle)
    
    # 绘制台灯
    for i in range(lamp_count):
        lx = 150 + (i * 400) % 1600
        ly = 300 + (i * 200) % 500
        draw_lamp(draw, lx, ly, size=60)
    
    # 绘制盆栽
    for i in range(plant_count):
        px = 100 + (i * 500) % 1700
        py = 500 + (i * 150) % 400
        draw_plant_pot(draw, px, py, size=80)
    
    # 极客风额外添加服务器架等设备
    if style == 'geek' and extra_gear:
        # 服务器架
        for i in range(3):
            sx = 100 + i * 100
            sy = 100
            # 服务器架阴影
            draw.rectangle([sx+8, sy+8, sx+80, sy+400], fill=colors['floor_dark'])
            # 服务器架主体
            draw.rectangle([sx, sy, sx+72, sy+392], fill=colors['chair_dark'])
            # 服务器指示灯
            for row in range(20):
                led_y = sy + 10 + row * 18
                led_color = colors['screen_glow'] if row % 3 == 0 else colors['screen_blue']
                draw.rectangle([sx+8, led_y, sx+20, led_y+8], fill=led_color)
                draw.rectangle([sx+28, led_y, sx+40, led_y+8], fill=colors['accent_red'] if row % 7 == 0 else led_color)
    
    return img

def main():
    """生成三种风格的背景图"""
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    styles = [
        ('default', 'bg_default.webp'),
        ('geek', 'bg_geek.webp'),
        ('cozy', 'bg_cozy.webp'),
    ]
    
    for style, filename in styles:
        print(f"Generating {style} style background...")
        img = generate_office_bg(style=style, width=1920, height=1080)
        filepath = os.path.join(OUTPUT_DIR, filename)
        img.save(filepath, 'WEBP', quality=85)
        print(f"  Saved: {filepath}")
    
    print("\nAll backgrounds generated successfully!")

if __name__ == '__main__':
    main()
