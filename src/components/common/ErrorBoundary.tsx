import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught uncaught UI error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
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
          <p className="text-xs text-[#8A847C] max-w-md mb-4 leading-relaxed font-mono bg-white p-3 rounded-lg border border-[#E6DFD5] text-left overflow-auto max-h-32">
            {this.state.error?.message || '未知渲染错误'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>重新加载工作台</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
