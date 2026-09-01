import { describe, it, expect } from 'vitest';
import { McpServerModal } from './McpServerModal';
import { SkillModal } from './SkillModal';
import { PLATFORM_SPECS, ALL_INGRESS_OPTIONS } from './SettingsModal';

describe('Settings Modals and Specifications', () => {
  it('exports McpServerModal component', () => {
    expect(McpServerModal).toBeDefined();
    expect(typeof McpServerModal).toBe('function');
  });

  it('exports SkillModal component', () => {
    expect(SkillModal).toBeDefined();
    expect(typeof SkillModal).toBe('function');
  });

  it('defines dynamic platform specifications with supported ingress types', () => {
    expect(PLATFORM_SPECS.length).toBeGreaterThan(5);
    const anthropic = PLATFORM_SPECS.find((p) => p.id === 'anthropic');
    expect(anthropic).toBeDefined();
    expect(anthropic?.supportedIngress).toContain('api_key');
    expect(anthropic?.supportedIngress).toContain('sub2');
    expect(anthropic?.supportedIngress).toContain('cap');

    const ollama = PLATFORM_SPECS.find((p) => p.id === 'ollama');
    expect(ollama).toBeDefined();
    expect(ollama?.supportedIngress).toContain('proxy');
  });

  it('contains comprehensive ingress options matching industry standards', () => {
    const ids = ALL_INGRESS_OPTIONS.map((o) => o.id);
    expect(ids).toContain('api_key');
    expect(ids).toContain('sub2');
    expect(ids).toContain('cap');
    expect(ids).toContain('oauth');
    expect(ids).toContain('proxy');
  });
});
