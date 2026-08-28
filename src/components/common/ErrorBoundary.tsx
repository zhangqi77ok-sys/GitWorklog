import { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary] Unhandled runtime crash caught:", error, errorInfo);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("session-status-changed", {
          detail: { status: "error", errorMessage: error.message },
        })
      );
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyStack = () => {
    const stack = `${this.state.error?.toString()}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(stack);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#18181b] text-white flex flex-col items-center justify-center p-6 font-sans select-text">
          <div className="max-w-xl w-full bg-[#27272a] border border-[#3f3f46] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertOctagon size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {this.props.fallbackTitle || "CodeMind 工作区捕获意外运行时异常"}
                </h2>
                <p className="text-xs text-[#a1a1aa]">
                  已通过全局异常边界保护主线程，防止白屏崩溃与数据丢失
                </p>
              </div>
            </div>

            <div className="bg-[#18181b] p-3 rounded-xl border border-[#3f3f46] max-h-48 overflow-y-auto font-mono text-xs text-red-300 leading-relaxed scrollbar-thin">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack && (
                <div className="text-[11px] text-[#71717a] mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#3f3f46]">
              <button
                type="button"
                onClick={this.handleCopyStack}
                className="px-3 py-1.5 bg-[#3f3f46] hover:bg-[#52525b] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {this.state.copied ? (
                  <>
                    <Check size={13} className="text-green-400" />
                    <span>已复制错误堆栈</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>复制错误堆栈</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-1.5 bg-[#d96b27] hover:bg-[#b85417] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <RotateCcw size={13} />
                <span>刷新并重启工作区</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
