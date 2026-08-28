from typing import Any

class SkillRegistry:
    def __init__(self):
        self._skills = [
            {"id": "skill-pytest", "name": "PyTest 自动化单测规范", "desc": "自动化生成覆盖边界与异常的 pytest 测试套件", "category": "testing", "enabled": True},
            {"id": "skill-ast", "name": "AST 语义重构引擎", "desc": "解析抽象语法树并安全重命名与提取函数", "category": "refactor", "enabled": True},
            {"id": "skill-doc", "name": "OpenAPI & Markdown 文档生成", "desc": "根据代码自动生成标准化交互式接口文档", "category": "docs", "enabled": True},
        ]

    def list_skills(self) -> list[dict[str, Any]]:
        return list(self._skills)

    def toggle_skill(self, skill_id: str, enabled: bool) -> bool:
        for s in self._skills:
            if s["id"] == skill_id:
                s["enabled"] = enabled
                return True
        return False

_skill_registry = SkillRegistry()
def get_skill_registry() -> SkillRegistry:
    return _skill_registry
