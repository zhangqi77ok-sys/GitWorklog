/**
 * backend/sys_probe.js
 * 轻量级系统负载探测脚本
 * 使用 Node.js 原生 os 模块，无任何第三方依赖
 *
 * 输出项：
 *   主机名 / 系统平台 / CPU 核心数
 *   空闲内存 / 总内存（GB）/ 系统运行时间
 */

const os = require('os');

/**
 * 将字节转换为 GB 字符串（保留两位小数）
 * @param {number} bytes
 * @returns {string}
 */
function toGB(bytes) {
  return (bytes / 1024 ** 3).toFixed(2);
}

/**
 * 将系统运行秒数格式化为人类可读的时长
 * @param {number} uptimeSeconds
 * @returns {string}
 */
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  return `${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`;
}

// ---- 数据采集 ----
const hostname = os.hostname();
const platform = os.platform();
const cpuCount = os.cpus().length; // 逻辑 CPU 核心数
const cpuModel = os.cpus()[0]?.model.trim() || '未知';
const totalMem = os.totalmem();
const freeMem = os.freemem();
const uptime = os.uptime();

// ---- 结果输出 ----
console.log('========== 系统负载探测结果 ==========');
console.log(`主机名:       ${hostname}`);
console.log(`系统平台:     ${platform}`);
console.log(`CPU 型号:     ${cpuModel}`);
console.log(`CPU 核心数:   ${cpuCount}`);
console.log(`总内存:       ${toGB(totalMem)} GB`);
console.log(`空闲内存:     ${toGB(freeMem)} GB`);
console.log(`内存使用率:   ${((1 - freeMem / totalMem) * 100).toFixed(2)}%`);
console.log(`系统运行时间: ${formatUptime(uptime)} (${Math.floor(uptime)} 秒)`);
console.log('=====================================');
