import pandas as pd
import json

def parse_value(val):
    """将单元格值转为合适的类型，'-'转为None"""
    if pd.isna(val) or val == '-' or val == '':
        return None
    return val

def parse_int(val):
    """转为int，'-'或空值转为None"""
    v = parse_value(val)
    if v is None:
        return None
    return int(v)

def parse_animal_limit(val):
    """将 '1,2,3' 格式转为int数组"""
    v = parse_value(val)
    if v is None:
        return []
    if isinstance(v, (int, float)):
        return [int(v)]
    return [int(x.strip()) for x in str(v).split(',') if x.strip()]

def excel_to_json(excel_path, sheet_name, output_path):
    # 读取Excel，不设表头，自己处理
    df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
    
    result = []
    
    # 数据从第3行开始（索引2）
    for idx in range(2, len(df)):
        row = df.iloc[idx]
        
        # A列为空的行跳过
        if pd.isna(row.iloc[0]):
            continue
        
        item = {
            "item_id": int(row.iloc[0]),
            "name": parse_value(row.iloc[1]),
            "quality": parse_int(row.iloc[5]),
            "type": parse_int(row.iloc[3]),
            "des": parse_value(row.iloc[4]),
            "animal_limit": parse_animal_limit(row.iloc[6]),
            "can_send": parse_int(row.iloc[7]),
            "can_sale": parse_int(row.iloc[8]),
            "energy": parse_int(row.iloc[9]),
            "clean": parse_int(row.iloc[10]),
            "intimacy": parse_int(row.iloc[11]),
            "pink": parse_int(row.iloc[12]),
            "sale_pink": parse_int(row.iloc[13]),
            "sale_gold": parse_int(row.iloc[14]),
            "recycle_pink": parse_int(row.iloc[15]),
            "total_use_count": parse_int(row.iloc[16]),
            "market": parse_int(row.iloc[17])
        }
        
        result.append(item)
    
    # 写入JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"转换完成，共 {len(result)} 条数据")
    print(f"输出文件: {output_path}")
    return result

if __name__ == "__main__":
    excel_path = "./道具_羁绊物.xlsx"
    sheet_name = "道具"
    output_path = "./item_config.json"
    
    data = excel_to_json(excel_path, sheet_name, output_path)
    
    # 打印前3条预览
    print("\n前3条数据预览:")
    print(json.dumps(data[:3], ensure_ascii=False, indent=2))
