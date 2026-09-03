const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

const PORT = 8765;
const WORKSPACE_ROOT = path.resolve(__dirname, "..");

// AgentRouter WAF 穿透请求头
const AGENTROUTER_HEADERS = {
  "User-Agent": "claude-cli/1.0.108 (external, cli)",
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
  "anthropic-dangerous-direct-browser-access": "true",
  "x-app": "cli",
  "x-stainless-lang": "js",
  "x-stainless-package-version": "0.55.1",
  "x-stainless-os": "Windows",
  "x-stainless-arch": "x64",
  "x-stainless-runtime": "node",
  "x-stainless-runtime-version": "v22.0.0",
};

// 跨域设置
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// 物理安全路径检查
function validatePath(relPath) {
  const full = path.resolve(WORKSPACE_ROOT, relPath);
  if (!full.startsWith(WORKSPACE_ROOT)) {
    throw new Error("SECURITY: path escapes workspace sandbox");
  }
  return full;
}

// 执行 Git 命令
function execGit(args) {
  try {
    return execSync(`git ${args}`, { cwd: WORKSPACE_ROOT, encoding: "utf8" }).trim();
  } catch (e) {
    return "";
  }
}

// 真实物理工具执行器
async function executeTool(name, args = {}) {
  const start = Date.now();
  if (name === "run_command") {
    const { command } = args;
    if (!command) return { output: "Missing command parameter", duration_ms: 0, is_error: true };
    const isWin = process.platform === "win32";
    const shell = isWin ? "cmd.exe" : "/bin/sh";
    const shellArgs = isWin ? ["/d", "/s", "/c", command] : ["-c", command];
    return new Promise((resolve) => {
      let out = "";
      const child = spawn(shell, shellArgs, {
        cwd: WORKSPACE_ROOT,
        windowsHide: true,
      });
      child.stdout.on("data", (c) => (out += c));
      child.stderr.on("data", (c) => (out += c));
      child.on("close", (code) => {
        resolve({
          output: out.trim() || `[Exited with code ${code}]`,
          duration_ms: Date.now() - start,
          is_error: code !== 0,
        });
      });
      child.on("error", (err) => {
        resolve({
          output: `Execution error: ${err.message}`,
          duration_ms: Date.now() - start,
          is_error: true,
        });
      });
    });
  }

  if (name === "read_file") {
    try {
      const full = validatePath(args.path);
      const content = fs.readFileSync(full, "utf8");
      return {
        output: content.length > 3000 ? content.slice(0, 3000) + "\n...[truncated]" : content,
        duration_ms: Date.now() - start,
        is_error: false,
      };
    } catch (e) {
      return { output: e.message, duration_ms: Date.now() - start, is_error: true };
    }
  }

  if (name === "write_file") {
    try {
      const full = validatePath(args.path);
      const dir = path.dirname(full);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(full, args.content, "utf8");
      return {
        output: `Successfully wrote ${args.content ? args.content.length : 0} bytes to ${args.path}`,
        duration_ms: Date.now() - start,
        is_error: false,
      };
    } catch (e) {
      return { output: e.message, duration_ms: Date.now() - start, is_error: true };
    }
  }

  if (name === "git_status") {
    const raw = execGit("status -s");
    return { output: raw || "Working directory clean", duration_ms: Date.now() - start, is_error: false };
  }

  return { output: `Unknown tool: ${name}`, duration_ms: Date.now() - start, is_error: true };
}

// 向上游大模型发送流式推理
function callUpstreamChatStream({ baseUrl, apiKey, model, messages, onChunk }) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL("/v1/chat/completions", baseUrl);
    const headers = {
      "Content-Type": "application/json",
      "Authorization": apiKey ? "Bearer " + apiKey : "",
    };
    if (baseUrl.includes("agentrouter.org")) {
      Object.assign(headers, AGENTROUTER_HEADERS);
    }
    const payload = JSON.stringify({
      model: model || "deepseek-v4-flash",
      messages,
      stream: true,
      max_tokens: 4096,
    });

    const client = urlObj.protocol === "https:" ? https : http;
    const req = client.request(
      urlObj,
      {
        method: "POST",
        headers,
        timeout: 60000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (c) => (errBody += c));
          res.on("end", () => reject(new Error(`Upstream HTTP ${res.statusCode}: ${errBody}`)));
          return;
        }

        let buffer = "";
        res.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              onChunk({ done: true });
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices && parsed.choices[0];
              if (choice && choice.delta) {
                onChunk({
                  reasoning: choice.delta.reasoning_content || "",
                  content: choice.delta.content || "",
                });
              }
            } catch (e) {}
          }
        });
        res.on("end", resolve);
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// HTTP 本地网关服务
const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. 探活
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", timestamp: Date.now() }));
    return;
  }

  // 1.1 针对外部上游大模型网关的连通性测速探针
  if (pathname === "/api/config/ping" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { baseUrl = "https://agentrouter.org", apiKey = "", model = "deepseek-v4-flash" } = JSON.parse(body || "{}");
        const start = Date.now();

        const urlObj = new URL("/v1/chat/completions", baseUrl);
        const headers = {
          "Content-Type": "application/json",
          "Authorization": apiKey ? "Bearer " + apiKey : "",
        };

        if (baseUrl.includes("agentrouter.org")) {
          Object.assign(headers, AGENTROUTER_HEADERS);
        }

        const payload = JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        });

        const client = urlObj.protocol === "https:" ? https : http;
        const pingReq = client.request(urlObj, {
          method: "POST",
          headers: headers,
          timeout: 10000,
        }, (pingRes) => {
          let data = "";
          pingRes.on("data", (c) => (data += c));
          pingRes.on("end", () => {
            const latency = Date.now() - start;
            if (pingRes.statusCode === 200) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true, latency_ms: latency, status: pingRes.statusCode }));
            } else {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, latency_ms: latency, status: pingRes.statusCode, error: data.slice(0, 200) }));
            }
          });
        });

        pingReq.on("error", (err) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });

        pingReq.on("timeout", () => {
          pingReq.destroy();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Connection timeout (10s)" }));
        });

        pingReq.write(payload);
        pingReq.end();
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 1.2 受控终端执行器 (零弹窗 CREATE_NO_WINDOW windowsHide: true)
  if (pathname === "/api/terminal/exec" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { command = "" } = JSON.parse(body || "{}");
        if (!command.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "command is required" }));
          return;
        }

        // 以流式分块形式返回执行输出
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        });

        const isWin = process.platform === "win32";
        const shell = isWin ? "cmd.exe" : "/bin/sh";
        const shellArgs = isWin ? ["/d", "/s", "/c", command] : ["-c", command];

        // 强制注入 windowsHide: true，杜绝 Windows 黑色黑框弹出
        const child = spawn(shell, shellArgs, {
          cwd: WORKSPACE_ROOT,
          windowsHide: true,
          env: process.env,
        });

        child.stdout.on("data", (chunk) => {
          res.write(chunk);
        });

        child.stderr.on("data", (chunk) => {
          res.write(chunk);
        });

        child.on("close", (code) => {
          res.end(`\r\n[Process exited with code ${code}]\r\n`);
        });

        child.on("error", (err) => {
          res.end(`\r\n[Process error: ${err.message}]\r\n`);
        });
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. 文件树
  if (pathname === "/api/fs/tree") {
    const ignoreDirs = new Set([".git", "node_modules", "dist", "target", ".gemini", ".vscode"]);
    function buildTree(dirRel) {
      const dirFull = validatePath(dirRel);
      const entries = fs.readdirSync(dirFull, { withFileTypes: true });
      const nodes = [];
      for (const e of entries) {
        if (ignoreDirs.has(e.name) || e.name.startsWith(".tcode_tmp_")) continue;
        const childRel = path.join(dirRel, e.name).replace(/\\/g, "/");
        const node = {
          name: e.name,
          path: childRel,
          is_dir: e.isDirectory(),
        };
        if (e.isDirectory()) {
          node.children = buildTree(childRel);
        }
        nodes.push(node);
      }
      return nodes;
    }

    try {
      const tree = buildTree("");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tree));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. 文件读取
  if (pathname === "/api/fs/read") {
    const targetPath = parsedUrl.searchParams.get("path");
    try {
      const full = validatePath(targetPath);
      const content = fs.readFileSync(full, "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: targetPath, content }));
    } catch (err) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. 获取 Git 原始基准 (用于 Monaco Diff)
  if (pathname === "/api/fs/original") {
    const targetPath = parsedUrl.searchParams.get("path");
    try {
      const slashPath = targetPath.replace(/\\/g, "/");
      const original = execGit(`show HEAD:${slashPath}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: targetPath, original }));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: targetPath, original: "" }));
    }
    return;
  }

  // 5. 文件保存 (原子写)
  if (pathname === "/api/fs/write" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { path: targetPath, content } = JSON.parse(body);
        const full = validatePath(targetPath);
        const tmp = path.join(path.dirname(full), `.${path.basename(full)}.tcode_tmp_${Date.now()}`);
        fs.writeFileSync(tmp, content, "utf8");
        fs.renameSync(tmp, full);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. Git 状态
  if (pathname === "/api/git/status") {
    const branch = execGit("branch --show-current") || "main";
    const raw = execGit("status --porcelain=v2");
    const staged = [];
    const working = [];
    const lines = raw.split("\n");
    for (const l of lines) {
      const parts = l.trim().split(/\s+/);
      if (parts[0] === "1" && parts.length >= 9) {
        const sc = parts[1][0];
        const wc = parts[1][1];
        const fp = parts[8];
        if (sc !== ".") staged.push({ path: fp, staged_code: sc });
        if (wc !== ".") working.push({ path: fp, work_code: wc });
      } else if (parts[0] === "?" && parts.length >= 2) {
        working.push({ path: parts[1], work_code: "U" });
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ branch, staged, working }));
    return;
  }

  // 7. Git 暂存/撤销/放弃
  if (pathname === "/api/git/stage" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { path: p } = JSON.parse(body);
      execGit(`add -- "${p}"`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (pathname === "/api/git/unstage" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { path: p } = JSON.parse(body);
      execGit(`restore --staged -- "${p}"`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (pathname === "/api/git/restore" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { path: p } = JSON.parse(body);
      execGit(`restore -- "${p}"`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // 8. ReAct 多阶段 SSE 流式推理 (真实大模型与自主工具调用闭环)
  if (pathname === "/api/chat/stream" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body: " + e.message }));
        return;
      }

      const {
        model = "deepseek-v4-flash",
        prompt = "",
        messages: history = [],
        apiKey: clientKey,
        baseUrl: clientBase,
      } = parsed;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      const apiKey = clientKey || process.env.OPENAI_API_KEY;
      const baseUrl = clientBase || process.env.OPENAI_BASE_URL || "https://agentrouter.org";

      if (!apiKey) {
        res.write(`event: error\ndata: "未配置 API Key 凭据，请在右上角「模型与设置」中配置凭据后重试。"\n\n`);
        res.end();
        return;
      }

      const systemPrompt = `你是由 DeepMind 设计的高级自主编程架构师 Tcode Agent。
当前运行于本地工程仓库：${WORKSPACE_ROOT}

你可以通过在回答中显式输出以下标签来自主调用本地工程工具（系统会在后台执行并将输出结果反馈给你）：
1. 运行命令：<<<TOOL_CALL: run_command {"command": "git status -s"}>>>
2. 读取文件：<<<TOOL_CALL: read_file {"path": "README.md"}>>>
3. 写入文件：<<<TOOL_CALL: write_file {"path": "path/to/file", "content": "..."}>>>
4. 查询 Git：<<<TOOL_CALL: git_status {}>>>

行为准则：
- 默认使用简体中文回复，语气专业、克制、严谨。
- 当用户提出查看代码、审查变更、执行测试、修复 Bug 时，优先使用上述标签调用工具获取真实上下文。
- 解释修改原因与架构设计思路。`;

      let conversation = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: prompt },
      ];

      try {
        let maxLoops = 4;
        let loopCount = 0;

        while (loopCount < maxLoops) {
          loopCount++;
          let accumulatedContent = "";
          let accumulatedReasoning = "";

          await callUpstreamChatStream({
            baseUrl,
            apiKey,
            model,
            messages: conversation,
            onChunk: ({ reasoning, content, done }) => {
              if (reasoning) {
                accumulatedReasoning += reasoning;
                res.write(`event: chunk\ndata: ${JSON.stringify({ thinking: reasoning })}\n\n`);
              }
              if (content) {
                accumulatedContent += content;
                res.write(`event: chunk\ndata: ${JSON.stringify({ delta_content: content })}\n\n`);
              }
            },
          });

          // 检查大模型是否输出了工具调用
          const toolRegex = /<<<TOOL_CALL:\s*([a-zA-Z0-9_]+)\s*(\{.*?\})>>>/s;
          const match = accumulatedContent.match(toolRegex);

          if (!match) {
            // 没有触发工具调用，回答自然收敛完成
            break;
          }

          const toolName = match[1];
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(match[2]);
          } catch (e) {
            toolArgs = {};
          }

          const toolId = `call_${Date.now()}_${loopCount}`;
          res.write(
            `event: tool_start\ndata: ${JSON.stringify({ id: toolId, name: toolName, args: toolArgs })}\n\n`
          );

          // 真实物理执行
          const toolResult = await executeTool(toolName, toolArgs);

          res.write(
            `event: tool_end\ndata: ${JSON.stringify({
              id: toolId,
              name: toolName,
              output: toolResult.output,
              is_error: toolResult.is_error,
            })}\n\n`
          );

          // 将工具执行结果作为 Tool 消息追加进对话，继续进入下一轮推理
          conversation.push({ role: "assistant", content: accumulatedContent });
          conversation.push({
            role: "user",
            content: `[工具 ${toolName} 执行结果 (耗时 ${toolResult.duration_ms}ms)]:\n${toolResult.output}\n\n请根据上述工具执行输出，继续给出后续动作或总结结论。`,
          });
        }

        res.write("event: done\ndata: [DONE]\n\n");
        res.end();
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`);
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [Tcode Daemon] 本地微内核服务已启动: http://127.0.0.1:${PORT}`);
  console.log(`📁 工作区根目录: ${WORKSPACE_ROOT}`);
  console.log(`======================================================\n`);
});
