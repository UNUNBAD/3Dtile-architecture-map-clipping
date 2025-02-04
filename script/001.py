import cv2
import numpy as np
from PIL import Image
import os
import time
import json
import sys
import io
import codecs

# 设置标准输出编码为utf-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def calculate_distance(p1, p2):
    """计算两点之间的欧几里得距离"""
    return np.linalg.norm(p2 - p1)

def get_width_height_from_json(json_path):
    """从 JSON 文件中读取四个点的笛卡尔坐标，并计算四边形的宽度和高度"""
    with open(json_path, "r") as f:
        data = json.load(f)
    
    points = data["points"]
    if len(points) != 4:
        raise ValueError("JSON 文件中必须包含 4 个点")
    
    # 提取四个点的笛卡尔坐标
    A = np.array([points[0]["cartesian"]["x"], points[0]["cartesian"]["y"], points[0]["cartesian"]["z"]])
    B = np.array([points[1]["cartesian"]["x"], points[1]["cartesian"]["y"], points[1]["cartesian"]["z"]])
    C = np.array([points[2]["cartesian"]["x"], points[2]["cartesian"]["y"], points[2]["cartesian"]["z"]])
    D = np.array([points[3]["cartesian"]["x"], points[3]["cartesian"]["y"], points[3]["cartesian"]["z"]])

    # 计算边长
    AB = calculate_distance(A, B)
    BC = calculate_distance(B, C)
    CD = calculate_distance(C, D)
    DA = calculate_distance(D, A)

    # 计算宽度和高度
    width = (AB + CD) / 2  # 宽度
    height = (BC + DA) / 2  # 高度

    return width, height

def process_image(input_path, output_path, json_path):
    try:
        print(f"正在处理文件: {input_path}".encode('utf-8').decode('utf-8'))
        # 从 JSON 文件中获取宽度和高度
        width_meters, height_meters = get_width_height_from_json(json_path)
        print(f"计算得出的宽度: {width_meters:.2f} 米, 高度: {height_meters:.2f} 米".encode('utf-8').decode('utf-8'))

        # 转换为像素（1 像素 = 0.1 米）
        width_pixels = int(width_meters / 0.1)
        height_pixels = int(height_meters / 0.1)
        print(f"目标分辨率: {width_pixels}x{height_pixels} 像素".encode('utf-8').decode('utf-8'))

        # 使用PIL读取PNG（保留透明通道）
        pil_image = Image.open(input_path)
        print(f"原始图像模式: {pil_image.mode}")
        # 转换为RGBA模式（如果不是的话）
        if pil_image.mode != 'RGBA':
            pil_image = pil_image.convert('RGBA')
        # 转换为numpy数组
        image = np.array(pil_image)
        # 分离alpha通道
        alpha = image[:, :, 3]
        # 使用alpha通道创建mask
        _, mask = cv2.threshold(alpha, 0, 255, cv2.THRESH_BINARY)
        mask = mask.astype(np.uint8)
        # 找到非透明区域的轮廓
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            print("没有找到有效轮廓")
            return
        # 获取最大轮廓
        main_contour = max(contours, key=cv2.contourArea)
        # 使用approxPolyDP来获取更精确的多边形近似
        epsilon = 0.02 * cv2.arcLength(main_contour, True)
        approx = cv2.approxPolyDP(main_contour, epsilon, True)
        # 如果近似点不是4个，找到最小外接矩形的四个角点
        if len(approx) != 4:
            rect = cv2.minAreaRect(main_contour)
            box = cv2.boxPoints(rect)
        else:
            box = approx.reshape(4, 2)
        # 对四个点进行排序
        box = order_points(box)
        # 设置目标点
        dst_pts = np.array([
            [0, 0],           # 左上
            [width_pixels-1, 0],     # 右上
            [width_pixels-1, height_pixels-1], # 右下
            [0, height_pixels-1]     # 左下
        ], dtype="float32")
        # 计算透视变换矩阵
        M = cv2.getPerspectiveTransform(box.astype("float32"), dst_pts)
        # 应用透视变换
        warped = cv2.warpPerspective(image, M, (width_pixels, height_pixels))
        # 裁剪掉边缘的透明部分
        alpha_warped = warped[:, :, 3]
        coords = cv2.findNonZero(alpha_warped)
        x, y, w, h = cv2.boundingRect(coords)
        # 裁剪图像
        cropped = warped[y:y+h, x:x+w]
        # 保存结果
        result_image = Image.fromarray(cropped)
        result_image.save(output_path, "PNG")
        print(f"处理完成，已保存到: {output_path}")
    except Exception as e:
        print(f"处理 {input_path} 时出错: {str(e)}")
        import traceback
        traceback.print_exc()  # 打印完整的异常堆栈信息

def order_points(pts):
    # 初始化坐标点
    rect = np.zeros((4, 2), dtype="float32")
    # 计算左上和右下
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # 左上
    rect[2] = pts[np.argmax(s)]  # 右下
    # 计算右上和左下
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # 右上
    rect[3] = pts[np.argmax(diff)]  # 左下
    return rect

def load_processed_files(index_file):
    """加载已处理文件的索引"""
    if not os.path.exists(index_file):
        return set()
    with open(index_file, "r") as f:
        return set(line.strip() for line in f.readlines())

def save_processed_file(index_file, filename):
    """将已处理的文件添加到索引中"""
    with open(index_file, "a") as f:
        f.write(f"{filename}\n")

def scan_and_process_folder(input_folder, output_folder, index_file):
    """扫描文件夹并处理未处理的 PNG 文件"""
    # 加载已处理的文件索引
    processed_files = load_processed_files(index_file)
    # 遍历输入文件夹
    for filename in os.listdir(input_folder):
        if filename.lower().endswith('.png') and filename not in processed_files:
            input_path = os.path.join(input_folder, filename)
            json_path = os.path.join(input_folder, filename.replace(".png", ".json"))
            output_path = os.path.join(output_folder, f"processed_{filename}")
            print(f"发现新文件: {filename}".encode('utf-8').decode('utf-8'))
            try:
                if not os.path.exists(json_path):
                    print(f"未找到对应的 JSON 文件: {json_path}".encode('utf-8').decode('utf-8'))
                    continue
                process_image(input_path, output_path, json_path)
                # 将处理过的文件添加到索引中
                save_processed_file(index_file, filename)
            except Exception as e:
                print(f"处理 {filename} 时出错: {str(e)}".encode('utf-8').decode('utf-8'))

def main():
    try:
        # 检查参数
        if len(sys.argv) < 2:
            print("\n错误: 缺少必要的参数".encode('utf-8').decode('utf-8'))
            print("用法: python 001.py <输入文件夹>".encode('utf-8').decode('utf-8'))
            sys.exit(1)

        # 获取输入文件夹路径
        input_folder = sys.argv[1]
        print(f"\n输入文件夹路径: {input_folder}".encode('utf-8').decode('utf-8'))

        # 验证输入文件夹
        if not os.path.exists(input_folder):
            print(f"\n错误: 输入文件夹不存在: {input_folder}".encode('utf-8').decode('utf-8'))
            sys.exit(1)

        # 设置输出文件夹（在输入文件夹下的output目录）
        output_folder = os.path.join(input_folder, "output")
        index_file = os.path.join(input_folder, "processed_files.txt")

        # 创建输出文件夹（如果不存在）
        if not os.path.exists(output_folder):
            print(f"\n创建输出文件夹: {output_folder}".encode('utf-8').decode('utf-8'))
            os.makedirs(output_folder)

        print(f"\n开始处理文件夹: {input_folder}".encode('utf-8').decode('utf-8'))
        print(f"输出文件夹: {output_folder}".encode('utf-8').decode('utf-8'))
        
        # 执行一次处理
        scan_and_process_folder(input_folder, output_folder, index_file)
        print("\n处理完成".encode('utf-8').decode('utf-8'))

    except Exception as e:
        print(f"\n发生错误: {str(e)}".encode('utf-8').decode('utf-8'))
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()