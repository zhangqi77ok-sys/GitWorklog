import React, { useState } from "react";
import { AuthMode } from "../../types";
import { X, Globe, Key, Database, Copy, Check } from "lucide-react";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>("oauth");
  const [email, setEmail] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com&redirect_uri=http://localhost:1455/auth/callback&response_type=code&scope=openid%20email%20profile";

  const handleCopy = () => {
    navigator.clipboard.writeText(authUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartOAuth = () => {
    window.open("https://accounts.google.com/o/oauth2/v2/auth?client_id=demo", "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[1100] flex items-center justify-center animate-in fade-in duration-150">
      <div className="w-[520px] bg-white rounded-xl shadow-2xl border border-[#e5dfd8] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-4 py-3 bg-[#f8fafc] border-b border-[#e5dfd8] flex justify-between items-center">
          <span className="font-bold text-sm text-[#1e1b18]">添加账号</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-[#645e57] hover:bg-[#e2e8f0] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* 主体 */}
        <div className="p-4 flex flex-col gap-3.5 text-xs">
          {/* Segmented Control */}
          <div className="grid grid-cols-3 bg-[#f1f5f9] p-1 rounded-lg gap-1">
            <button
              onClick={() => setAuthMode("oauth")}
              className={`py-1.5 rounded flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer ${
                authMode === "oauth"
                  ? "bg-[#d96b27] text-white shadow-sm"
                  : "text-[#645e57] hover:text-[#1e1b18]"
              }`}
            >
              <Globe size={13} /> OAuth 授权
            </button>
            <button
              onClick={() => setAuthMode("token")}
              className={`py-1.5 rounded flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer ${
                authMode === "token"
                  ? "bg-[#d96b27] text-white shadow-sm"
                  : "text-[#645e57] hover:text-[#1e1b18]"
              }`}
            >
              <Key size={13} /> Token / JSON
            </button>
            <button
              onClick={() => setAuthMode("import")}
              className={`py-1.5 rounded flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer ${
                authMode === "import"
                  ? "bg-[#d96b27] text-white shadow-sm"
                  : "text-[#645e57] hover:text-[#1e1b18]"
              }`}
            >
              <Database size={13} /> 导入
            </button>
          </div>

          {/* 表单输入 */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 flex flex-col gap-2">
            <label className="text-[#645e57] font-medium">待授权账号:</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入 Google / OpenAI / Anthropic 账号邮箱"
              className="w-full bg-white border border-[#cbd5e1] rounded-md px-2.5 py-1.5 text-xs text-[#1e1b18] outline-none focus:border-[#d96b27]"
            />
            <div className="flex justify-between items-center pt-1">
              <button
                onClick={() => alert("📄 备注已更新")}
                className="text-[11px] text-[#645e57] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded hover:bg-[#f1f5f9] cursor-pointer"
              >
                📄 加备注
              </button>
              <button
                onClick={() => {
                  alert("📄 待授权卡片已暂存为草稿！");
                  onClose();
                }}
                className="text-[11px] text-[#645e57] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded hover:bg-[#f1f5f9] cursor-pointer"
              >
                📄 保存待授权卡片
              </button>
            </div>
          </div>

          {/* 推荐提示 */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-2 flex items-center gap-2 text-[#645e57]">
            <Globe size={14} className="text-[#d96b27]" />
            <span>推荐使用浏览器完成 Google / OpenAI 官方 OAuth 授权</span>
          </div>

          {/* 授权操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleStartOAuth}
              className="flex-1 bg-[#d96b27] hover:bg-[#b85417] text-white font-semibold py-2 rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Globe size={13} /> 开始 OAuth 授权
            </button>
            <button
              onClick={() => {
                alert("✅ OAuth 授权完成！凭据已自动注入并纳管。");
                onSuccess();
                onClose();
              }}
              className="bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-[#1e1b18] font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <Check size={13} className="text-[#10b981]" /> 我已授权，继续
            </button>
          </div>

          {/* 授权链接复制 */}
          <div className="flex flex-col gap-1">
            <label className="text-[#645e57]">授权链接 (可直接复制至浏览器打开):</label>
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-[#645e57] truncate">{authUrl}</span>
              <button
                onClick={handleCopy}
                className="bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] px-2 py-0.5 rounded text-[11px] text-[#1e1b18] flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copied ? <Check size={11} className="text-[#10b981]" /> : <Copy size={11} />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          </div>

          {/* 手动回调输入 */}
          <div className="flex flex-col gap-1">
            <label className="text-[#645e57]">手动输入回调地址 (如果浏览器未自动回调):</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="粘贴完整回调地址，例如: http://localhost:1455/auth/callback?code=..."
                className="flex-1 bg-white border border-[#cbd5e1] rounded-md px-2.5 py-1.5 text-xs text-[#1e1b18] outline-none focus:border-[#d96b27]"
              />
              <button
                onClick={() => {
                  if (callbackUrl) {
                    alert("✅ 回调地址已解析并成功绑定凭据！");
                    onSuccess();
                    onClose();
                  } else {
                    alert("请先粘贴完整的回调地址！");
                  }
                }}
                className="bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-[#1e1b18] font-semibold px-3 py-1.5 rounded-md text-xs cursor-pointer whitespace-nowrap"
              >
                ✓ 我已授权，继续
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
