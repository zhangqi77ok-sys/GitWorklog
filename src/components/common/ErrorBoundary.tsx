import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, FileText, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isCopied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isCopied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, isCopied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught uncaught UI error:', error, errorInfo);
    this.setState({ errorInfo });

    // Send error log to backend logging system
    try {
      fetch('/api/system/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: error?.message || 'Uncaught React UI Exception',
          stack: errorInfo?.componentStack || error?.stack || '',
        }),
      }).catch(() => {});
    } catch (e) {}
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isCopied: false });
    window.location.reload();
  };

  private handleCopyError = () => {
    const errText = `[Tcode UI Error]\nMessage: ${this.state.error?.message}\nStack: ${this.state.errorInfo?.componentStack || this.state.error?.stack}`;
    navigator.clipboard.writeText(errText);
    this.setState({ isCopied: true });
    setTimeout(() => this.setState({ isCopied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#FAF8F5] p-6 text-center select-none">
          <div className="w-14 h-14 rounded-2xl bg-[#FFEBEE] border border-[#FFCDD2] flex items-center justify-center text-[#C62828] mb-4 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-[#1E1C1A] mb-2">
            {this.props.fallbackTitle || '界面渲染遇到异常'}
          </h2>
          <p className="text-xs text-[#C62828] font-bold max-w-md mb-2 leading-relaxed font-mono bg-[#FFEBEE]/80 p-3 rounded-lg border border-[#FFCDD2] text-left overflow-auto max-h-32">
            {this.state.error?.message || '未知渲染错误'}
          </p>
          <p className="text-[11px] text-[#8A847C] mb-4">
            该错误已自动记录到系统日志文件 (只保留近 7 天日志)。
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重新加载工作台</span>
            </button>
            <button
              onClick={this.handleCopyError}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] text-[#1E1C1A] rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {this.state.isCopied ? <Check className="w-4 h-4 text-[#2E7D32]" /> : <FileText className="w-4 h-4 text-[#D96B27]" />}
              <span>{this.state.isCopied ? '已复制报错' : '复制报错信息'}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
