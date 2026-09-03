import React, { useRef, useEffect, useState } from 'react'

interface HoverPoint {
  hour: number
  inTokens: number
  outTokens: number
  x: number
  y: number
}

export const ThroughputCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hoverData, setHoverData] = useState<HoverPoint | null>(null)

  // 模拟 24 小时真实吞吐分布数据 (0点 ~ 23点)
  const hourlyData = [
    { hour: 0, inT: 4200, outT: 1800 },
    { hour: 1, inT: 2100, outT: 900 },
    { hour: 2, inT: 1200, outT: 400 },
    { hour: 3, inT: 800, outT: 300 },
    { hour: 4, inT: 950, outT: 350 },
    { hour: 5, inT: 1500, outT: 600 },
    { hour: 6, inT: 3800, outT: 1400 },
    { hour: 7, inT: 8200, outT: 3600 },
    { hour: 8, inT: 16400, outT: 7800 },
    { hour: 9, inT: 28500, outT: 14200 },
    { hour: 10, inT: 36200, outT: 18400 },
    { hour: 11, inT: 31000, outT: 15600 },
    { hour: 12, inT: 22000, outT: 9800 },
    { hour: 13, inT: 29800, outT: 14600 },
    { hour: 14, inT: 38900, outT: 19800 },
    { hour: 15, inT: 42500, outT: 22400 },
    { hour: 16, inT: 37800, outT: 18900 },
    { hour: 17, inT: 34100, outT: 16700 },
    { hour: 18, inT: 26500, outT: 12800 },
    { hour: 19, inT: 21000, outT: 10400 },
    { hour: 20, inT: 28400, outT: 14200 },
    { hour: 21, inT: 31200, outT: 15800 },
    { hour: 22, inT: 24600, outT: 11800 },
    { hour: 23, inT: 14800, outT: 7200 },
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 处理高分屏 Retina
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const paddingBottom = 24
    const paddingTop = 16
    const chartHeight = h - paddingBottom - paddingTop
    const barWidth = Math.max(6, (w - 40) / 24 - 4)

    ctx.clearRect(0, 0, w, h)

    // 找出最大值
    const maxTotal = Math.max(...hourlyData.map((d) => d.inT + d.outT))

    // 绘制背景虚线
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    for (let i = 1; i <= 3; i++) {
      const y = paddingTop + (chartHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(20, y)
      ctx.lineTo(w - 20, y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // 绘制 24 小时柱状图
    hourlyData.forEach((d, i) => {
      const x = 20 + i * ((w - 40) / 24)
      const total = d.inT + d.outT
      const totalBarHeight = (total / maxTotal) * chartHeight
      const inBarHeight = (d.inT / total) * totalBarHeight
      const outBarHeight = totalBarHeight - inBarHeight

      const yBottom = h - paddingBottom
      const yIn = yBottom - inBarHeight
      const yOut = yIn - outBarHeight

      // 输入 Tokens 柱 (深色底)
      ctx.fillStyle = 'rgba(217, 107, 39, 0.75)'
      ctx.fillRect(x, yIn, barWidth, inBarHeight)

      // 输出 Tokens 柱 (亮色顶)
      ctx.fillStyle = 'rgba(217, 107, 39, 0.95)'
      ctx.fillRect(x, yOut, barWidth, outBarHeight)

      // X 轴时间标签 (每隔 3 小时绘制一次)
      if (i % 3 === 0) {
        ctx.fillStyle = '#A1A1AA'
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`${d.hour}:00`, x + barWidth / 2, h - 6)
      }
    })
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const w = rect.width
    const step = (w - 40) / 24
    const index = Math.floor((x - 20) / step)

    if (index >= 0 && index < hourlyData.length) {
      const d = hourlyData[index]
      if (d) {
        setHoverData({
          hour: d.hour,
          inTokens: d.inT,
          outTokens: d.outT,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    } else {
      setHoverData(null)
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-white border border-black/[0.08] shadow-2xs space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
            <span>📈</span>
            <span>24 小时高帧率时序吞吐走势 (Throughput Timeline)</span>
          </h3>
          <p className="text-[11px] text-[#71717A]">
            展示今日每小时输入与输出 Tokens 分布，悬浮可探针具体调用数值
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#D96B27]/75" />
            <span className="text-[#71717A]">输入 Tokens</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#D96B27]" />
            <span className="text-[#71717A]">输出 Tokens</span>
          </div>
        </div>
      </div>

      {/* Canvas 容器 */}
      <div className="relative h-44 w-full">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
          className="w-full h-full cursor-crosshair"
        />

        {/* 鼠标悬停浮动数据卡片 */}
        {hoverData && (
          <div
            style={{
              left: `${Math.min(hoverData.x + 12, 380)}px`,
              top: `${Math.max(hoverData.y - 65, 8)}px`,
            }}
            className="absolute z-10 bg-[#18181B] text-white p-2.5 rounded-xl shadow-xl pointer-events-none text-xs space-y-1 font-mono border border-white/10"
          >
            <div className="text-[10px] text-white/50 border-b border-white/10 pb-0.5">
              时刻: {hoverData.hour}:00 - {hoverData.hour}:59
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-white/70">输入 Tokens:</span>
              <span className="text-amber-400 font-bold">{hoverData.inTokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-white/70">输出 Tokens:</span>
              <span className="text-emerald-400 font-bold">{hoverData.outTokens.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-[#D96B27] pt-0.5 font-sans font-medium border-t border-white/10">
              合计: {(hoverData.inTokens + hoverData.outTokens).toLocaleString()} Tokens
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
