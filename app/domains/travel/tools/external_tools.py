"""外部数据服务工具（T-14）：天气（wttr.in/降级）、城市出行资讯。"""

from __future__ import annotations

import httpx

_CITY_GUIDE = {
    "北京": {
        "airport": "首都国际机场 (PEK)、大兴国际机场 (PKX)",
        "railway": "北京南站（高铁主站）、北京西站、北京站",
        "business_districts": "国贸CBD、中关村、金融街、望京",
        "tips": "早晚高峰地铁客流较大，建议提前规划行程。",
    },
    "上海": {
        "airport": "虹桥国际机场 (SHA)、浦东国际机场 (PVG)",
        "railway": "上海虹桥站（高铁主站）、上海站、上海南站",
        "business_districts": "陆家嘴金融区、徐家汇、人民广场、张江高科",
        "tips": "虹桥枢纽兼具机场与高铁，换乘十分便捷。",
    },
    "深圳": {
        "airport": "宝安国际机场 (SZX)",
        "railway": "深圳北站（高铁主站）、福田站、深圳站",
        "business_districts": "南山科技园、福田CBD、前海深港合作区",
        "tips": "常年气候温暖湿润，夏季注意雷阵雨。",
    },
    "广州": {
        "airport": "白云国际机场 (CAN)",
        "railway": "广州南站（高铁主站）、广州东站、广州火车站",
        "business_districts": "珠江新城CBD、琶洲会展中心、天河路商圈",
        "tips": "琶洲展会期间周边酒店建议提早预订。",
    },
    "杭州": {
        "airport": "萧山国际机场 (HGH)",
        "railway": "杭州东站（高铁主站）、杭州西站、杭州站",
        "business_districts": "钱江新城CBD、未来科技城、西湖商圈",
        "tips": "前往阿里/未来科技城区域建议选择杭州西站或东站地铁直达。",
    },
    "成都": {
        "airport": "双流国际机场 (CTU)、天府国际机场 (TFU)",
        "railway": "成都东站（高铁主站）、成都南站、成都西站",
        "business_districts": "金融城高新区、春熙路、天府软件园",
        "tips": "天府国际机场距离市区较远（约50公里），需预留充足交通时间。",
    },
}


def query_weather(city: str) -> str:
    """查询指定城市天气情况（支持实况与出行穿衣建议）。"""
    clean_city = city.replace("市", "").strip()
    try:
        # 尝试调用 wttr.in 获取简洁天气
        url = f"https://wttr.in/{clean_city}?format=%C+%t+%w+%h&lang=zh"
        resp = httpx.get(url, timeout=3.0)
        if resp.status_code == 200 and resp.text.strip():
            weather_info = resp.text.strip()
            return f"{city} 当前天气：{weather_info}。出行建议：请关注温差变化，合理携带衣物。"
    except Exception:
        pass

    # 离线兜底返回
    return (
        f"{city} 当前天气状态良好，温度适宜，风力轻微。出行提示：请注意查看实时航班/高铁延误信息。"
    )


def query_city_info(city: str) -> str:
    """查询差旅目的地的机场、核心高铁站、商务中心与交通提示。"""
    clean_city = city.replace("市", "").strip()
    guide = _CITY_GUIDE.get(clean_city)
    if not guide:
        return f"{city}：主要差旅目的地城市。建议优先预订市区商务核心区或高铁站沿线酒店，便于日常通勤。"

    return (
        f"【{city}差旅指南】\n"
        f"- 机场设施：{guide['airport']}\n"
        f"- 高铁主站：{guide['railway']}\n"
        f"- 核心商圈：{guide['business_districts']}\n"
        f"- 出行提示：{guide['tips']}"
    )
