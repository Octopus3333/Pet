import pandas as pd
import json

def export_scene_config(excel_path, output_path):
    # 读取Excel
    df = pd.read_excel(excel_path)
    
    # 字段映射
    field_map = {
        '场景模版ID': 'map_id',
        '地点ID': 'location',
        '切片配置序列': 'order',
        '权重': 'rate',
        '备注': 'des'
    }
    
    # 筛选需要的列并重命名
    result = []
    for _, row in df.iterrows():
        item = {}
        for src, dst in field_map.items():
            val = row.get(src)
            # 空值跳过或置空
            if pd.isna(val):
                item[dst] = ""
            else:
                # order字段按逗号分割为数组
                if dst == 'order' and isinstance(val, str):
                    item[dst] = [int(x.strip()) for x in val.split(',') if x.strip()]
                # 数字类型保持原样
                elif isinstance(val, float) and val.is_integer():
                    item[dst] = int(val)
                else:
                    item[dst] = val
        result.append(item)
    
    # 写入JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"导出完成，共 {len(result)} 条配置，已保存到 {output_path}")

if __name__ == '__main__':
    export_scene_config('场景图配置表.xlsx', 'map_bg_cfg.json')
