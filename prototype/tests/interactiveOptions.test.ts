import { describe, it, expect } from 'vitest';
import { extractInteractiveOptions } from '../src/services/interactiveOptions';

describe('Interactive Options Resolver (WP-Q)', () => {
  it('should parse numbered decision steps from model response', () => {
    const content = `三、一句话总结
> new-api 的模型服务商 = 一张 channels 表 + 一个 Adaptor 接口 + 一个 switch 注册表。

需要我继续做以下哪一步？
1. 读完 model-gateway-v2-contract.md 全文并输出精读摘要（我会用 Python UTF-8 可靠读取）；
2. 把 new-api 的 Channel + Adaptor 骨架翻译成 TypeScript/Python 代码，直接落地到 Tcode；
3. 写一份 new-api ↔ Tcode 服务商设计对照表存入 docs/。`;

    const options = extractInteractiveOptions(content);
    expect(options.length).toBe(3);
    expect(options[0].index).toBe(1);
    expect(options[0].label).toContain('1. 读完 model-gateway-v2-contract.md');
    expect(options[0].promptText).toBe('执行第 1 步：读完 model-gateway-v2-contract.md 全文并输出精读摘要（我会用 Python UTF-8 可靠读取）；');

    expect(options[1].index).toBe(2);
    expect(options[1].label).toContain('2. 把 new-api 的 Channel + Adaptor');
    expect(options[1].promptText).toBe('执行第 2 步：把 new-api 的 Channel + Adaptor 骨架翻译成 TypeScript/Python 代码，直接落地到 Tcode；');

    expect(options[2].index).toBe(3);
    expect(options[2].label).toContain('3. 写一份 new-api ↔ Tcode');
  });

  it('should parse alternate trigger patterns like 请选择以下方案', () => {
    const content = `架构已分析完毕。
请选择后续步骤：
[1] 先执行编译检查
[2] 直接运行全量测试套件
[3] 重构模型网关模块`;

    const options = extractInteractiveOptions(content);
    expect(options.length).toBe(3);
    expect(options[0].promptText).toBe('执行第 1 步：先执行编译检查');
    expect(options[1].promptText).toBe('执行第 2 步：直接运行全量测试套件');
    expect(options[2].promptText).toBe('执行第 3 步：重构模型网关模块');
  });

  it('should not parse normal text without decision trigger as interactive options', () => {
    const normalContent = `这里是三个优势：
1. 速度快
2. 内存占用低
3. 易于扩展`;

    const options = extractInteractiveOptions(normalContent);
    expect(options.length).toBe(0);
  });
});
