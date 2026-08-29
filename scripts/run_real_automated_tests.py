from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
import sys
import time
import json
import urllib.request
import urllib.error
from pathlib import Path

BASE_URL = "https://platform.ai.hixinghai.com/api/v1"
API_KEY = "sk-xh-ZVKvOZcvzLKxUSWECPQ3mUKfP9q9sxrz14NQmtoQ000"
TARGET_MODEL = "deepseek-v4-flash"

print("=" * 80)
print("🚀 Tcode 全链路真实自动化测试套件 (Real Automated Testing)")
print("=" * 80)

passed = 0
failed = 0

def test_step(step_name, func):
    global passed, failed
    print(f"\n▶ [TEST] {step_name} ...")
    start = time.time()
    try:
        res = func()
        duration_ms = (time.time() - start) * 1000
        print(f"  ✅ PASSED ({duration_ms:.1f}ms): {res}")
        passed += 1
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        print(f"  ❌ FAILED ({duration_ms:.1f}ms): {e}")
        failed += 1

# 1. Real Gateway Connectivity Test (/models)
def test_real_models_endpoint():
    req = urllib.request.Request(f"{BASE_URL}/models")
    req.add_header("Authorization", f"Bearer {API_KEY}")
    with urllib.request.urlopen(req, timeout=10) as response:
        assert response.status == 200, f"Expected 200, got {response.status}"
        body = json.loads(response.read().decode("utf-8"))
        models = body.get("data", [])
        model_ids = [m.get("id") for m in models]
        assert TARGET_MODEL in model_ids, f"{TARGET_MODEL} not found in {model_ids}"
        return f"真实探测成功: HTTP 200 OK · 返回 {len(models)} 个可用大模型 (包含 {TARGET_MODEL})"

test_step("1. 真实大模型网关连通性与模型列表获取 (/models)", test_real_models_endpoint)

# 2. Real Streaming Chat Completion Test (SSE stream: true)
def test_real_stream_chat():
    payload = {
        "model": TARGET_MODEL,
        "messages": [
            {"role": "system", "content": "You are a test assistant. Answer in one short sentence."},
            {"role": "user", "content": "Ping: Tcode real automated test"}
        ],
        "stream": True
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/chat/completions", data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    })
    
    chunks_count = 0
    accumulated_text = ""
    with urllib.request.urlopen(req, timeout=15) as response:
        assert response.status == 200, f"Expected 200, got {response.status}"
        for line in response:
            line_str = line.decode("utf-8").strip()
            if line_str.startswith("data: "):
                raw_data = line_str[6:]
                if raw_data == "[DONE]":
                    break
                try:
                    parsed = json.loads(raw_data)
                    delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if delta:
                        chunks_count += 1
                        accumulated_text += delta
                except:
                    pass
                    
    assert chunks_count > 0, "No stream chunks received"
    assert len(accumulated_text.strip()) > 0, "Accumulated text is empty"
    return f"真实 SSE 流式响应接收完毕: 接收 {chunks_count} 个 Chunk · 内容: '{accumulated_text.strip()[:60]}...'"

test_step("2. 真实 DeepSeek V4 Flash SSE 打字机流式对话调用", test_real_stream_chat)

# 3. Real Security API Key Failure Branch Test (Invalid Key -> 401)
def test_real_auth_failure_handling():
    req = urllib.request.Request(f"{BASE_URL}/models")
    req.add_header("Authorization", "Bearer sk-invalid-key-test-999")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raise Exception("Expected HTTP 401, but succeeded!")
    except urllib.error.HTTPError as e:
        assert e.code == 401 or e.code == 403, f"Expected 401 or 403, got {e.code}"
        return f"真实异常凭据拦截验证通过: 准确返回 HTTP {e.code} ({e.reason})"

test_step("3. 真实异常凭据鉴权防御与 401 错误链路校验", test_real_auth_failure_handling)

# 4. Real Windows Executable Binary Integrity
def test_executable_integrity():
    exe_file = ROOT / "release" / "Tcode-v1.0.4.exe"
    zip_file = ROOT / "release" / "Tcode-v1.0.4-windows-x64.zip"
    assert exe_file.exists(), f"{exe_file} does not exist"
    assert zip_file.exists(), f"{zip_file} does not exist"
    exe_size_mb = exe_file.stat().st_size / (1024 * 1024)
    zip_size_mb = zip_file.stat().st_size / (1024 * 1024)
    assert exe_size_mb > 10, f"Executable too small: {exe_size_mb}MB"
    return f"Windows 原生可执行文件校验通过: Tcode-v1.0.4.exe ({exe_size_mb:.2f} MB)"

test_step("4. Windows 桌面原生独立可执行安装包物理校验", test_executable_integrity)

print("\n" + "=" * 80)
print(f"🏁 真实自动化测试结果: {passed} PASSED, {failed} FAILED")
print("=" * 80)

if failed > 0:
    sys.exit(1)
