import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Terminal, Trash2, X, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export const TerminalDrawer: React.FC = () => {
  const { isTerminalOpen, toggleTerminal } = useWorkspaceStore()
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstance = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const currentLineRef = useRef<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // 运行命令
  const runCommand = async (cmd: string) => {
    const term = xtermInstance.current
    if (!term || !cmd.trim()) return

    setIsRunning(true)
    term.write(`\r\n\x1b[38;2;217;107;39m$\x1b[0m ${cmd}\r\n`)

    try {
      const res = await fetch('http://127.0.0.1:8765/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })

      if (!res.body) {
        term.write('\r\n\x1b[31m[执行失败: 无法获取流式响应]\x1b[0m\r\n$ ')
        setIsRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        // 规整 Windows CRLF 换行
        const normalized = text.replace(/(?<!\r)\n/g, '\r\n')
        term.write(normalized)
      }

      term.write('\r\n\x1b[38;2;217;107;39m$\x1b[0m ')
    } catch (err: any) {
      term.write(`\r\n\x1b[31m[网络错误: ${err.message}]\x1b[0m\r\n\x1b[38;2;217;107;39m$\x1b[0m `)
    } finally {
      setIsRunning(false)
      currentLineRef.current = ''
    }
  }

  // 初始化 Xterm 终端
  useEffect(() => {
    if (!terminalRef.current || xtermInstance.current) return

    const term = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.25,
      theme: {
        background: '#1E1C1A', // Warm Dark 暖炭黑
        foreground: '#FAF8F5', // Warm Cream 暖米白
        cursor: '#D96B27', // Terracotta Orange 陶土暖橙
        selectionBackground: 'rgba(217, 107, 39, 0.35)',
        black: '#1E1C1A',
        red: '#E04B4B',
        green: '#4CAF50',
        yellow: '#F0B429',
        blue: '#4E98E6',
        magenta: '#B87FE6',
        cyan: '#36B9CC',
        white: '#FAF8F5',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    xtermInstance.current = term
    fitAddonRef.current = fitAddon

    // 欢迎标题行
    term.write('\x1b[38;2;217;107;39m=== Tcode 受控集成终端 (Windows 静默零弹窗沙箱) ===\x1b[0m\r\n')
    term.write('\x1b[90m输入 shell 命令并按回车执行，支持 ANSI 彩色与流式输出。\x1b[0m\r\n\r\n')
    term.write('\x1b[38;2;217;107;39m$\x1b[0m ')

    // 键盘交互事件拦截
    term.onData((data) => {
      if (isRunning) return

      if (data === '\r') {
        // 回车执行
        const cmd = currentLineRef.current
        runCommand(cmd)
      } else if (data === '\u007F') {
        // 退格删除
        if (currentLineRef.current.length > 0) {
          currentLineRef.current = currentLineRef.current.slice(0, -1)
          term.write('\b \b')
        }
      } else if (data >= ' ') {
        // 普通可打印字符
        currentLineRef.current += data
        term.write(data)
      }
    })

    return () => {
      term.dispose()
      xtermInstance.current = null
      fitAddonRef.current = null
    }
  }, [])

  // 展开与折叠时重新计算视口尺寸
  useEffect(() => {
    if (isTerminalOpen && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
      }, 50)
    }
  }, [isTerminalOpen, isExpanded])

  if (!isTerminalOpen) return null

  return (
    <div
      style={{ height: isExpanded ? '480px' : '230px' }}
      className="bg-[#1E1C1A] border-t border-[#3A3632] flex flex-col z-20 shrink-0 transition-all duration-200 select-none shadow-2xl"
    >
      {/* 顶部控制栏 */}
      <div className="h-8 bg-[#2A2623] border-b border-[#3A3632] px-3 flex items-center justify-between text-xs text-[#FAF8F5] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-[#D96B27]" />
          <span className="font-semibold text-[11px] uppercase tracking-wider text-[#FAF8F5]">
            受控终端 (TERMINAL)
          </span>

          {/* 预设指令快捷胶囊 */}
          <div className="flex items-center gap-1 ml-3">
            <button
              onClick={() => runCommand('git status --short')}
              disabled={isRunning}
              className="text-[10px] bg-[#3A3632] hover:bg-[#D96B27] hover:text-white px-2 py-0.5 rounded text-[#C7BFB6] transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
            >
              <Play size={8} />
              <span>git status</span>
            </button>
            <button
              onClick={() => runCommand('git log -n 3 --oneline')}
              disabled={isRunning}
              className="text-[10px] bg-[#3A3632] hover:bg-[#D96B27] hover:text-white px-2 py-0.5 rounded text-[#C7BFB6] transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
            >
              <Play size={8} />
              <span>git log</span>
            </button>
            <button
              onClick={() => runCommand('npm test')}
              disabled={isRunning}
              className="text-[10px] bg-[#3A3632] hover:bg-[#D96B27] hover:text-white px-2 py-0.5 rounded text-[#C7BFB6] transition-colors flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
            >
              <Play size={8} />
              <span>npm test</span>
            </button>
          </div>
        </div>

        {/* 右侧动作按钮 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              xtermInstance.current?.clear()
              xtermInstance.current?.write('\x1b[38;2;217;107;39m$\x1b[0m ')
              currentLineRef.current = ''
            }}
            title="清空终端屏幕"
            className="p-1 text-[#A89F96] hover:text-white hover:bg-[#3A3632] rounded transition-colors"
          >
            <Trash2 size={12} />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? '缩小终端高度' : '放大终端高度'}
            className="p-1 text-[#A89F96] hover:text-white hover:bg-[#3A3632] rounded transition-colors"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          <button
            onClick={toggleTerminal}
            title="关闭终端抽屉 (Ctrl + `)"
            className="p-1 text-[#A89F96] hover:text-[#E04B4B] hover:bg-[#3A3632] rounded transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 终端主体渲染区 */}
      <div className="flex-1 overflow-hidden p-2 relative bg-[#1E1C1A]">
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  )
}
