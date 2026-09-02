import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { downloadBackup } from '../../lib/backup';
import { useSnippetStore } from '../../stores/useSnippetStore';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[tcode] UI 渲染异常捕获:', error, info);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleExportEmergency = () => {
    try {
      const snippets = useSnippetStore.getState().snippets;
      downloadBackup(snippets);
    } catch (e) {
      console.warn('[tcode] 紧急导出失败', e);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-[280px] p-6 bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl flex flex-col items-center justify-center text-center shadow-xs m-4 select-none"
        >
          <div className="w-12 h-12 rounded-full bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27] mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-[#1E1C1A] mb-1">页面渲染出现异常</h2>
          <p className="text-xs text-[#8A847C] max-w-md mb-3 leading-relaxed">
            已成功拦截错误，避免工作区整页白屏。您可以尝试重试恢复；若问题持续，可先导出备份数据。
          </p>
          {this.state.error && (
            <pre className="p-3 bg-[#F4EFEA] border border-[#E6DFD5] rounded-xl text-[11px] font-mono text-[#6B665F] max-w-lg w-full overflow-x-auto whitespace-pre-wrap text-left mb-4 select-text">
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重新加载组件</span>
            </button>
            <button
              type="button"
              onClick={this.handleExportEmergency}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#F4EFEA] text-[#1E1C1A] border border-[#E6DFD5] rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#8A847C]" />
              <span>紧急导出数据备份</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
