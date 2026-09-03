export namespace agent {
	
	export class AuditReport {
	    status: string;
	    risk_level: string;
	    issues: string[];
	    files_scanned: number;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new AuditReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.risk_level = source["risk_level"];
	        this.issues = source["issues"];
	        this.files_scanned = source["files_scanned"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class TestReport {
	    status: string;
	    passed: number;
	    failed: number;
	    duration: string;
	    output: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new TestReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.passed = source["passed"];
	        this.failed = source["failed"];
	        this.duration = source["duration"];
	        this.output = source["output"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

export namespace ast {
	
	export class GraphNode {
	    id: string;
	    name: string;
	    type: string;
	    file: string;
	    changes: number;
	    details: string;
	    children?: string[];
	
	    static createFrom(source: any = {}) {
	        return new GraphNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.file = source["file"];
	        this.changes = source["changes"];
	        this.details = source["details"];
	        this.children = source["children"];
	    }
	}

}

export namespace config {
	
	export class ChannelConfig {
	    id: string;
	    name: string;
	    primary: boolean;
	    status: string;
	    auth_type: string;
	    endpoint: string;
	    api_key?: string;
	    model: string;
	    latency: string;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new ChannelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.primary = source["primary"];
	        this.status = source["status"];
	        this.auth_type = source["auth_type"];
	        this.endpoint = source["endpoint"];
	        this.api_key = source["api_key"];
	        this.model = source["model"];
	        this.latency = source["latency"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class MCPServerConfig {
	    id: string;
	    name: string;
	    type: string;
	    command: string;
	    args: string[];
	    env?: {[key: string]: string};
	    url?: string;
	    enabled: boolean;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new MCPServerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.env = source["env"];
	        this.url = source["url"];
	        this.enabled = source["enabled"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class RuleConfig {
	    id: string;
	    title: string;
	    content: string;
	    scope: string;
	    enabled: boolean;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new RuleConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.scope = source["scope"];
	        this.enabled = source["enabled"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class SkillConfig {
	    id: string;
	    name: string;
	    description: string;
	    prompt: string;
	    enabled: boolean;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new SkillConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.prompt = source["prompt"];
	        this.enabled = source["enabled"];
	        this.updated_at = source["updated_at"];
	    }
	}

}

export namespace diff {
	
	export class DiffLine {
	    type: string;
	    text: string;
	    label?: string;
	
	    static createFrom(source: any = {}) {
	        return new DiffLine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.text = source["text"];
	        this.label = source["label"];
	    }
	}
	export class DiffHunk {
	    index: number;
	    header: string;
	    lines: DiffLine[];
	    add_count: number;
	    del_count: number;
	    raw_patch: string;
	
	    static createFrom(source: any = {}) {
	        return new DiffHunk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.header = source["header"];
	        this.lines = this.convertValues(source["lines"], DiffLine);
	        this.add_count = source["add_count"];
	        this.del_count = source["del_count"];
	        this.raw_patch = source["raw_patch"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DiffReport {
	    file_path: string;
	    lang: string;
	    stats: string;
	    header: string;
	    lines: DiffLine[];
	    hunks: DiffHunk[];
	
	    static createFrom(source: any = {}) {
	        return new DiffReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.file_path = source["file_path"];
	        this.lang = source["lang"];
	        this.stats = source["stats"];
	        this.header = source["header"];
	        this.lines = this.convertValues(source["lines"], DiffLine);
	        this.hunks = this.convertValues(source["hunks"], DiffHunk);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace gitops {
	
	export class Snapshot {
	    id: string;
	    branch: string;
	    message: string;
	    time: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.branch = source["branch"];
	        this.message = source["message"];
	        this.time = source["time"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

export namespace main {
	
	export class ChatRequest {
	    session_id: string;
	    prompt: string;
	    model: string;
	    is_full_auto: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ChatRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.prompt = source["prompt"];
	        this.model = source["model"];
	        this.is_full_auto = source["is_full_auto"];
	    }
	}
	export class FileNode {
	    name: string;
	    path: string;
	    is_dir: boolean;
	    children?: FileNode[];
	
	    static createFrom(source: any = {}) {
	        return new FileNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.is_dir = source["is_dir"];
	        this.children = this.convertValues(source["children"], FileNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace mcp {
	
	export class MCPTestResult {
	    id: string;
	    name: string;
	    status: string;
	    latency: string;
	    tool_count: number;
	    tools: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new MCPTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.latency = source["latency"];
	        this.tool_count = source["tool_count"];
	        this.tools = source["tools"];
	        this.error = source["error"];
	    }
	}

}

export namespace session {
	
	export class ToolExecution {
	    name: string;
	    args: any;
	    output: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolExecution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.args = source["args"];
	        this.output = source["output"];
	    }
	}
	export class SessionMessage {
	    id: string;
	    role: string;
	    content: string;
	    thinking?: string;
	    tool?: ToolExecution;
	    time: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.role = source["role"];
	        this.content = source["content"];
	        this.thinking = source["thinking"];
	        this.tool = this.convertValues(source["tool"], ToolExecution);
	        this.time = source["time"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ChatSession {
	    id: string;
	    title: string;
	    model: string;
	    tag: string;
	    created_at: number;
	    updated_at: number;
	    messages: SessionMessage[];
	
	    static createFrom(source: any = {}) {
	        return new ChatSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.model = source["model"];
	        this.tag = source["tag"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.messages = this.convertValues(source["messages"], SessionMessage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SessionMeta {
	    id: string;
	    title: string;
	    model: string;
	    tag: string;
	    time: string;
	    desc: string;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new SessionMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.model = source["model"];
	        this.tag = source["tag"];
	        this.time = source["time"];
	        this.desc = source["desc"];
	        this.updated_at = source["updated_at"];
	    }
	}

}

export namespace telemetry {
	
	export class ModelUsage {
	    model: string;
	    calls: number;
	    total_tokens: number;
	    prompt_tokens: number;
	    comp_tokens: number;
	    avg_latency_ms: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.calls = source["calls"];
	        this.total_tokens = source["total_tokens"];
	        this.prompt_tokens = source["prompt_tokens"];
	        this.comp_tokens = source["comp_tokens"];
	        this.avg_latency_ms = source["avg_latency_ms"];
	    }
	}
	export class UsageMetrics {
	    total_tokens: number;
	    total_calls: number;
	    estimated_cost: string;
	    active_sessions: number;
	    per_model: {[key: string]: ModelUsage};
	    last_updated_time: string;
	
	    static createFrom(source: any = {}) {
	        return new UsageMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_tokens = source["total_tokens"];
	        this.total_calls = source["total_calls"];
	        this.estimated_cost = source["estimated_cost"];
	        this.active_sessions = source["active_sessions"];
	        this.per_model = this.convertValues(source["per_model"], ModelUsage, true);
	        this.last_updated_time = source["last_updated_time"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

