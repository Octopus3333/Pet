import pandas as pd
import json
import re

def parse_drop_pos(text):
    """
    解析 [(2,9)],[(1,1),(2,2)] 格式字符串
    返回 [[{"x":2,"y":9}], [{"x":1,"y":1},{"x":2,"y":2}]]
    """
    if pd.isna(text) or str(text).strip() == "":
        return []
    s = str(text).strip()
    # 提取所有 (数字,数字) 坐标
    pattern = r"\((\d+),(\d+)\)"
    coords = re.findall(pattern, s)
    # 按 ],[ 分割外层分组
    groups_raw = re.split(r"\],\s*\[", s.strip("[]"))
    result = []
    for g in groups_raw:
        group_coords = re.findall(pattern, g)
        obj_list = []
        for x_str, y_str in group_coords:
            obj_list.append({
                "x": int(x_str),
                "y": int(y_str)
            })
        result.append(obj_list)
    return result

def export_route_config(excel_path="./基础路线配置表.xlsx", json_out="route_config.json"):
    df = pd.read_excel(excel_path)
    output_list = []
    for _, row in df.iterrows():
        # 处理路线节奏 events
        event_str = str(row["路线节奏"]).strip()
        events = [int(num) for num in event_str.split(",") if num.strip()]
        
        item = {
            "route_id": int(row["路线ID"]),
            "location": int(row["地点ID"]),
            "count": int(row["节点数量"]),
            "rate": int(row["权重"]),
            "events": events,
            "DropPos": parse_drop_pos(row["事件掉落物位置"])
        }
        output_list.append(item)
    
    # 写入json，格式化输出
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump(output_list, f, ensure_ascii=False, indent=2)
    print(f"导出完成，输出文件：{json_out}")

if __name__ == "__main__":
    export_route_config()