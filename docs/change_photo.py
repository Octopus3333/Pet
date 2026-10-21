import pandas as pd
import json

def save_json(data, save_path):
    """保存json文件，格式化输出"""
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def clean_str(s):
    """清洗文本：- 转为空字符串"""
    if pd.isna(s):
        return ""
    if isinstance(s, str) and s.strip() == "-":
        return ""
    return str(s)

def clean_num(s, default=0):
    """清洗数值：- / 空值 替换为默认值"""
    if pd.isna(s):
        return default
    if isinstance(s, str) and s.strip() == "-":
        return default
    return s

# ====================== 配置区 ======================
EXCEL_FILE_PATH = "./照片配置表.xlsx"  # 你的excel文件路径
SHEET_BASE = "照片基础配置表"        # 基础表sheet名
SHEET_VAR = "照片变种样式配置"       # 变种表sheet名
OUT_BASE_JSON = "./照片基础配置.json"
OUT_VAR_JSON = "./照片变种样式配置.json"

# ====================== 1、处理【照片基础配置表】 ======================
df_base = pd.read_excel(EXCEL_FILE_PATH, sheet_name=SHEET_BASE)
base_result = []

for _, row in df_base.iterrows():
    photo_id = row["照片ID"]
    if pd.isna(photo_id):
        continue
    
    name = clean_str(row["照片名称"])
    desc = clean_str(row["回忆相册简介"])
    quality = clean_num(row["稀有度"], default=0)
    pet_raw = clean_str(row["可获得物种"])  # 强制转字符串，解决int无split问题

    pet_limit = []
    if pet_raw.strip():
        # 分割遍历，只保留纯数字
        parts = pet_raw.split(",")
        for x in parts:
            val = x.strip()
            if val.isdigit():
                pet_limit.append(int(val))

    item = {
        "id": int(photo_id),
        "name": name,
        "descripetion": desc,
        "quality": quality,
        "pet_limit": pet_limit
    }
    base_result.append(item)

save_json(base_result, OUT_BASE_JSON)
print(f"✅ 照片基础配置已导出至: {OUT_BASE_JSON}")

# ====================== 2、处理【照片变种样式配置】 ======================
df_var = pd.read_excel(EXCEL_FILE_PATH, sheet_name=SHEET_VAR)
var_result = []

for _, row in df_var.iterrows():
    photo_id = row["照片ID"]
    if pd.isna(photo_id):
        continue

    # 文本字段清洗
    grow_id_raw = clean_num(row["照片变种自增ID"], default=0)
    sub_id = clean_str(row["照片变种ID"])
    type_raw = clean_num(row["照片类型"], default=1)
    figma_link = clean_str(row["figma链接"])
    photo_path = clean_str(row["照片文件名"])
    bg_name = clean_str(row["背景图文件名"])
    forward_bg_name = clean_str(row["前景图文件名"])
    action_path = clean_str(row["角色姿势文件名"])
    
    # 浮点数/整数数值统一清洗"-"
    pose_scale_raw = clean_num(row["pose放大倍数"], default=1.0)
    poseX_raw = clean_num(row["poseX"], default=0)
    poseY_raw = clean_num(row["poseY"], default=0)
    
    emo_path = clean_str(row["表情文件名"])
    emo_scale_raw = clean_num(row["emotion放大倍数"], default=1.0)
    emo_x_raw = clean_num(row["emotionX"], default=0)
    emo_y_raw = clean_num(row["emotionY"], default=0)

    var_item = {
        "id": int(photo_id),
        "grow_id": int(grow_id_raw),
        "sub_id": sub_id,
        "type": int(type_raw),
        "figma_link": figma_link,
        "photo_path": photo_path,
        "bg_name": bg_name,
        "forward_bg_name": forward_bg_name,
        "action_path": action_path,
        "pose_scale": float(pose_scale_raw),
        "poseX": int(poseX_raw),
        "poseY": int(poseY_raw),
        "emo_path": emo_path,
        "emo_scale": float(emo_scale_raw),
        "emo_x": int(emo_x_raw),
        "emo_y": int(emo_y_raw)
    }
    var_result.append(var_item)

save_json(var_result, OUT_VAR_JSON)
print(f"✅ 照片变种样式配置已导出至: {OUT_VAR_JSON}")
print("全部导出完成！")