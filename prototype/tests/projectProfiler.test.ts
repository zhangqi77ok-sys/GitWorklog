import { describe, expect, it } from 'vitest';
import {
  analyzeFileTreeHeuristics,
  formatProfileForSystemPrompt,
  formatProfileBadge,
  getCachedProjectProfile,
  setCachedProjectProfile
} from '../src/services/projectProfiler';
import { DirectoryItem, DEFAULT_PROJECT_PROFILE } from '../src/types/contracts';

describe('Autonomous Project and Environment Profiler', () => {
  it('detects TypeScript + React + Vite + Vitest project stack', () => {
    const mockFiles: DirectoryItem[] = [
      { id: '1', name: 'package.json', path: 'package.json', type: 'file' },
      { id: '2', name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
      { id: '3', name: 'vite.config.ts', path: 'vite.config.ts', type: 'file' },
      { id: '4', name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
      { id: '5', name: 'app.test.ts', path: 'tests/app.test.ts', type: 'file' }
    ];

    const profile = analyzeFileTreeHeuristics(mockFiles, 'E:/projects/my-ts-app');

    expect(profile.languages).toContain('TypeScript');
    expect(profile.frameworks).toContain('React');
    expect(profile.frameworks).toContain('Vite');
    expect(profile.testFramework).toBe('vitest');
    expect(profile.testCommand).toBe('npm test');
  });

  it('detects Python + Pytest project stack with uv lock', () => {
    const mockFiles: DirectoryItem[] = [
      { id: '1', name: 'pyproject.toml', path: 'pyproject.toml', type: 'file' },
      { id: '2', name: 'uv.lock', path: 'uv.lock', type: 'file' },
      { id: '3', name: 'main.py', path: 'agent/main.py', type: 'file' },
      { id: '4', name: 'test_agent.py', path: 'tests/test_agent.py', type: 'file' }
    ];

    const profile = analyzeFileTreeHeuristics(mockFiles, 'E:/projects/my-python-service');

    expect(profile.languages).toContain('Python');
    expect(profile.packageManager).toBe('uv');
    expect(profile.testFramework).toBe('pytest');
    expect(profile.testCommand).toBe('pytest');
  });

  it('detects Rust project stack', () => {
    const mockFiles: DirectoryItem[] = [
      { id: '1', name: 'Cargo.toml', path: 'Cargo.toml', type: 'file' },
      { id: '2', name: 'main.rs', path: 'src/main.rs', type: 'file' }
    ];

    const profile = analyzeFileTreeHeuristics(mockFiles, 'E:/projects/my-rust-app');

    expect(profile.languages).toContain('Rust');
    expect(profile.packageManager).toBe('cargo');
    expect(profile.testFramework).toBe('cargo-test');
    expect(profile.testCommand).toBe('cargo test');
  });

  it('detects Go project stack', () => {
    const mockFiles: DirectoryItem[] = [
      { id: '1', name: 'go.mod', path: 'go.mod', type: 'file' },
      { id: '2', name: 'main.go', path: 'main.go', type: 'file' }
    ];

    const profile = analyzeFileTreeHeuristics(mockFiles, 'E:/projects/my-go-app');

    expect(profile.languages).toContain('Go');
    expect(profile.packageManager).toBe('go');
    expect(profile.testFramework).toBe('go-test');
    expect(profile.testCommand).toBe('go test ./...');
  });

  it('detects niche languages: Zig, Elixir, Julia, Solidity, Haskell, C/C++', () => {
    // 1. Zig
    const zigFiles: DirectoryItem[] = [
      { id: '1', name: 'build.zig', path: 'build.zig', type: 'file' },
      { id: '2', name: 'main.zig', path: 'src/main.zig', type: 'file' }
    ];
    const zigProf = analyzeFileTreeHeuristics(zigFiles, 'E:/zig-app');
    expect(zigProf.languages).toContain('Zig');
    expect(zigProf.testCommand).toBe('zig build test');

    // 2. Elixir
    const elixirFiles: DirectoryItem[] = [
      { id: '1', name: 'mix.exs', path: 'mix.exs', type: 'file' },
      { id: '2', name: 'app.ex', path: 'lib/app.ex', type: 'file' }
    ];
    const elixirProf = analyzeFileTreeHeuristics(elixirFiles, 'E:/elixir-app');
    expect(elixirProf.languages).toContain('Elixir');
    expect(elixirProf.testCommand).toBe('mix test');

    // 3. Solidity
    const solFiles: DirectoryItem[] = [
      { id: '1', name: 'foundry.toml', path: 'foundry.toml', type: 'file' },
      { id: '2', name: 'Token.sol', path: 'contracts/Token.sol', type: 'file' }
    ];
    const solProf = analyzeFileTreeHeuristics(solFiles, 'E:/web3-app');
    expect(solProf.languages).toContain('Solidity');
    expect(solProf.testCommand).toBe('forge test');

    // 4. Julia
    const juliaFiles: DirectoryItem[] = [
      { id: '1', name: 'Project.toml', path: 'Project.toml', type: 'file' },
      { id: '2', name: 'model.jl', path: 'src/model.jl', type: 'file' }
    ];
    const juliaProf = analyzeFileTreeHeuristics(juliaFiles, 'E:/julia-app');
    expect(juliaProf.languages).toContain('Julia');
    expect(juliaProf.testCommand).toContain('using Pkg; Pkg.test()');
  });

  it('handles custom/unknown workspace gracefully without hallucinating npm test', () => {
    const unknownFiles: DirectoryItem[] = [
      { id: '1', name: 'notes.txt', path: 'notes.txt', type: 'file' },
      { id: '2', name: 'data.csv', path: 'data.csv', type: 'file' }
    ];
    const prof = analyzeFileTreeHeuristics(unknownFiles, 'E:/custom-workspace');
    expect(prof.languages).toContain('Custom / Multi-Stack');
    expect(prof.testFramework).toBe('none');
    expect(prof.testCommand).toBe('');

    const prompt = formatProfileForSystemPrompt(prof);
    expect(prompt).toContain('未检测到预设测试脚本');
  });

  it('renders strict shell rules in formatProfileForSystemPrompt', () => {
    const prompt = formatProfileForSystemPrompt({
      ...DEFAULT_PROJECT_PROFILE,
      os: 'windows',
      osName: 'Windows 11',
      shell: 'powershell',
      shellPath: 'powershell.exe',
      languages: ['TypeScript', 'Python'],
      frameworks: ['React', 'Vite'],
      packageManager: 'npm',
      testFramework: 'vitest',
      testCommand: 'npm test',
      installedToolchains: ['node', 'python', 'git'],
      activeWorkspacePath: 'E:/pro/agent-learning'
    });

    expect(prompt).toContain('【🖥️ 宿主操作系统与当前工程画像');
    expect(prompt).toContain('Windows PowerShell 铁律');
    expect(prompt).toContain('严禁使用 "&&"');
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('npm test');
  });

  it('generates a concise badge label', () => {
    const badge = formatProfileBadge({
      ...DEFAULT_PROJECT_PROFILE,
      os: 'windows',
      shell: 'powershell',
      languages: ['TypeScript'],
      testCommand: 'npm test'
    });

    expect(badge).toContain('Win');
    expect(badge).toContain('powershell');
    expect(badge).toContain('TypeScript');
    expect(badge).toContain('npm test');
  });

  it('correctly prioritizes Java Spring Boot project even when auxiliary python scripts exist', () => {
    const mockFiles: DirectoryItem[] = [
      { id: '1', name: 'pom.xml', path: 'pom.xml', type: 'file' },
      { id: '2', name: 'Application.java', path: 'src/main/java/com/geek/Application.java', type: 'file' },
      { id: '3', name: 'UserController.java', path: 'src/main/java/com/geek/UserController.java', type: 'file' },
      { id: '4', name: 'build_installer.py', path: 'build_installer.py', type: 'file' },
      { id: '5', name: 'test_helper.py', path: 'scripts/test_helper.py', type: 'file' }
    ];

    const profile = analyzeFileTreeHeuristics(mockFiles, 'D:/weihu/agent-learning');

    // Primary language MUST be Java
    expect(profile.languages[0]).toBe('Java / Kotlin');
    expect(profile.testCommand).toBe('mvn test');
    expect(profile.languages).toContain('Python'); // Auxiliary python is preserved in array
  });

  it('manages in-memory cache correctly', () => {
    setCachedProjectProfile({
      ...DEFAULT_PROJECT_PROFILE,
      languages: ['Go', 'Rust']
    });

    const cached = getCachedProjectProfile();
    expect(cached.languages).toEqual(['Go', 'Rust']);
  });
});
