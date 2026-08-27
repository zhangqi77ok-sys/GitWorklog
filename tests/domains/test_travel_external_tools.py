from __future__ import annotations

from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.domains.travel.business.policy import PolicyKey, PolicyLimit, TravelPolicyEngine
from app.domains.travel.tools.external_tools import query_city_info, query_weather
from app.domains.travel.tools.travel_tools import TravelAgentContext, TravelTools


def test_query_city_info_known_city():
    info = query_city_info("上海")
    assert "上海差旅指南" in info
    assert "虹桥国际机场" in info
    assert "陆家嘴金融区" in info


def test_query_city_info_fallback():
    info = query_city_info("未知小镇")
    assert "未知小镇" in info
    assert "主要差旅目的地城市" in info


def test_query_weather_offline_fallback():
    with patch("httpx.get", side_effect=Exception("Network error")):
        w = query_weather("北京")
        assert "北京 当前天气状态良好" in w


def test_query_weather_mocked_online():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = "晴 +22°C 东南风 45%"

    with patch("httpx.get", return_value=mock_resp):
        w = query_weather("深圳")
        assert "深圳 当前天气：晴 +22°C 东南风 45%" in w


def test_travel_tools_weather_integration():
    engine = create_engine("sqlite:///:memory:")
    f = sessionmaker(bind=engine)
    rules = {PolicyKey("P7", 1): PolicyLimit(hotel_budget=60000, flight_class="economy")}
    policy = TravelPolicyEngine(rules)
    ctx = TravelAgentContext(session=f(), user_id=1, dept_id=1, policy=policy)
    tools = TravelTools(ctx)

    res_city = tools.query_city_info("广州")
    assert "白云国际机场" in res_city

    res_weather = tools.query_weather("成都")
    assert "成都" in res_weather
