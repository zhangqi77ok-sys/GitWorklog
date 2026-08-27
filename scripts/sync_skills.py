from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
login_resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
token = login_resp.json()["data"]["token"]
headers = {"Authorization": f"Bearer {token}"}

sync_resp = client.post("/api/skills/sync", headers=headers)
skills = sync_resp.json()["data"]
print(f"\n🎉 成功同步并注册 {len(skills)} 个垂直领域技能：\n")
for s in sorted(skills, key=lambda x: x["name"]):
    print(f"  • /{s['name']:25} | {s['description'][:45]}... (就绪状态: {s['enabled']})")