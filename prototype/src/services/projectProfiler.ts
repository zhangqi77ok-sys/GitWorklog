import { hostFetch } from './hostClient';
import { ProjectProfile, DEFAULT_PROJECT_PROFILE, DirectoryItem } from '../types/contracts';

let cachedProjectProfile: ProjectProfile = { ...DEFAULT_PROJECT_PROFILE };

export function getCachedProjectProfile(): ProjectProfile {
  return cachedProjectProfile;
}

export function setCachedProjectProfile(profile: ProjectProfile): void {
  cachedProjectProfile = { ...profile };
}

/**
 * Universal language & build-tool rule registry covering 25+ mainstream & niche languages
 */
interface LanguageRule {
  name: string;
  manifests: string[];
  extensions: string[];
  packageManager: ProjectProfile['packageManager'];
  testFramework: ProjectProfile['testFramework'];
  testCommand: string;
  frameworkDetectors?: Array<{ name: string; match: (names: Set<string>, paths: string[]) => boolean }>;
}

const LANGUAGE_RULES: LanguageRule[] = [
  // 1. TypeScript & JavaScript
  {
    name: 'TypeScript',
    manifests: ['tsconfig.json', 'package.json'],
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    packageManager: 'npm',
    testFramework: 'vitest',
    testCommand: 'npm test',
    frameworkDetectors: [
      { name: 'React', match: (_, p) => p.some(x => x.endsWith('.tsx') || x.endsWith('.jsx')) },
      { name: 'Vite', match: (_, p) => p.some(x => x.includes('vite.config')) },
      { name: 'Next.js', match: (n, p) => n.has('next.config.js') || n.has('next.config.ts') || p.some(x => x.includes('next.config')) },
      { name: 'Vue', match: (_, p) => p.some(x => x.endsWith('.vue')) },
      { name: 'NestJS', match: (n, p) => n.has('nest-cli.json') || p.some(x => x.includes('nest-cli')) },
      { name: 'Electron', match: (n) => n.has('electron-builder.json') || n.has('electron-builder.yml') }
    ]
  },
  {
    name: 'JavaScript',
    manifests: ['package.json', 'jsconfig.json'],
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    packageManager: 'npm',
    testFramework: 'jest',
    testCommand: 'npm test'
  },
  // 2. Python
  {
    name: 'Python',
    manifests: ['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'environment.yml', 'tox.ini'],
    extensions: ['.py', '.pyi', '.ipynb'],
    packageManager: 'uv',
    testFramework: 'pytest',
    testCommand: 'pytest',
    frameworkDetectors: [
      { name: 'FastAPI', match: (_, p) => p.some(x => x.includes('fastapi')) },
      { name: 'Django', match: (n) => n.has('manage.py') },
      { name: 'Flask', match: (_, p) => p.some(x => x.includes('flask')) },
      { name: 'PyTorch', match: (_, p) => p.some(x => x.includes('torch')) }
    ]
  },
  // 3. Rust
  {
    name: 'Rust',
    manifests: ['cargo.toml', 'cargo.lock'],
    extensions: ['.rs'],
    packageManager: 'cargo',
    testFramework: 'cargo-test',
    testCommand: 'cargo test'
  },
  // 4. Go
  {
    name: 'Go',
    manifests: ['go.mod', 'go.sum', 'go.work'],
    extensions: ['.go'],
    packageManager: 'go',
    testFramework: 'go-test',
    testCommand: 'go test ./...'
  },
  // 5. Zig
  {
    name: 'Zig',
    manifests: ['build.zig', 'build.zig.zon'],
    extensions: ['.zig'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'zig build test'
  },
  // 6. C / C++
  {
    name: 'C / C++',
    manifests: ['cmakelists.txt', 'makefile', 'meson.build', 'conanfile.txt', 'conanfile.py'],
    extensions: ['.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', '.hxx'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'ctest'
  },
  // 7. C# / .NET
  {
    name: 'C# (.NET)',
    manifests: ['global.json', 'nuget.config'],
    extensions: ['.cs', '.csproj', '.sln', '.fsproj', '.vbproj'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'dotnet test'
  },
  // 8. Java / Kotlin
  {
    name: 'Java / Kotlin',
    manifests: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
    extensions: ['.java', '.kt', '.kts', '.scala', '.groovy'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'mvn test'
  },
  // 9. Dart / Flutter
  {
    name: 'Dart / Flutter',
    manifests: ['pubspec.yaml', 'pubspec.lock'],
    extensions: ['.dart'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'dart test'
  },
  // 10. Elixir / Erlang
  {
    name: 'Elixir',
    manifests: ['mix.exs', 'mix.lock', 'rebar.config'],
    extensions: ['.ex', '.exs', '.erl', '.hrl'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'mix test'
  },
  // 11. Swift
  {
    name: 'Swift',
    manifests: ['package.swift'],
    extensions: ['.swift'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'swift test'
  },
  // 12. PHP
  {
    name: 'PHP',
    manifests: ['composer.json', 'composer.lock'],
    extensions: ['.php'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'composer test'
  },
  // 13. Ruby
  {
    name: 'Ruby',
    manifests: ['gemfile', 'gemfile.lock', 'rakefile'],
    extensions: ['.rb', '.rake', '.gemspec'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'bundle exec rspec'
  },
  // 14. Lua
  {
    name: 'Lua',
    manifests: ['rockspec'],
    extensions: ['.lua'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'busted'
  },
  // 15. Julia
  {
    name: 'Julia',
    manifests: ['project.toml', 'manifest.toml'],
    extensions: ['.jl'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'julia --project -e "using Pkg; Pkg.test()"'
  },
  // 16. Haskell
  {
    name: 'Haskell',
    manifests: ['stack.yaml', 'cabal.project'],
    extensions: ['.hs', '.lhs', '.cabal'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'stack test'
  },
  // 17. Solidity (Web3 / Smart Contracts)
  {
    name: 'Solidity',
    manifests: ['hardhat.config.js', 'hardhat.config.ts', 'foundry.toml', 'truffle-config.js'],
    extensions: ['.sol'],
    packageManager: 'unknown',
    testFramework: 'custom',
    testCommand: 'forge test'
  }
];

/**
 * Detects host OS, shell, programming language, package manager and test runner.
 */
export async function detectProjectProfile(
  workspacePath?: string,
  fileTree?: DirectoryItem[]
): Promise<ProjectProfile> {
  const isDesktop = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
  const targetPath = workspacePath || '';

  if (isDesktop) {
    try {
      const res = await hostFetch(`/api/workspace/profile?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.profile) {
          const profile: ProjectProfile = {
            os: data.profile.os || DEFAULT_PROJECT_PROFILE.os,
            osName: data.profile.osName || DEFAULT_PROJECT_PROFILE.osName,
            shell: data.profile.shell || DEFAULT_PROJECT_PROFILE.shell,
            shellPath: data.profile.shellPath || DEFAULT_PROJECT_PROFILE.shellPath,
            languages: data.profile.languages || DEFAULT_PROJECT_PROFILE.languages,
            frameworks: data.profile.frameworks || DEFAULT_PROJECT_PROFILE.frameworks,
            packageManager: data.profile.packageManager || DEFAULT_PROJECT_PROFILE.packageManager,
            testFramework: data.profile.testFramework || DEFAULT_PROJECT_PROFILE.testFramework,
            testCommand: data.profile.testCommand || DEFAULT_PROJECT_PROFILE.testCommand,
            installedToolchains: data.profile.installedToolchains || DEFAULT_PROJECT_PROFILE.installedToolchains,
            activeWorkspacePath: targetPath
          };
          setCachedProjectProfile(profile);
          return profile;
        }
      }
    } catch (_) {}
  }

  const profile = analyzeFileTreeHeuristics(fileTree || [], targetPath);
  setCachedProjectProfile(profile);
  return profile;
}

/**
 * Comprehensive multi-language & extension-frequency heuristic analyzer
 */
export function analyzeFileTreeHeuristics(files: DirectoryItem[], workspacePath = ''): ProjectProfile {
  const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '');
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || '');
  const os: ProjectProfile['os'] = isWindows ? 'windows' : isMac ? 'macos' : 'linux';
  const osName = isWindows ? 'Windows 11 (NT 10.0)' : isMac ? 'macOS (Darwin)' : 'Linux / POSIX';
  const shell: ProjectProfile['shell'] = isWindows ? 'powershell' : 'bash';
  const shellPath = isWindows ? 'powershell.exe' : '/bin/bash';

  const fileNames = new Set(files.map(f => f.name.toLowerCase()));
  const allPaths = files.map(f => f.path.toLowerCase());

  // Count file extension frequencies across the project
  const extCounts: Record<string, number> = {};
  files.forEach(f => {
    const dotIdx = f.name.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = f.name.slice(dotIdx).toLowerCase();
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }
  });

  const langScores: Record<string, number> = {};
  const matchedFrameworks: string[] = [];
  let detectedPkgMgr: ProjectProfile['packageManager'] = 'unknown';
  let detectedTestFramework: ProjectProfile['testFramework'] = 'none';
  let detectedTestCommand = '';

  // 1. Evaluate all registered language rules with weighted scoring
  for (const rule of LANGUAGE_RULES) {
    const manifestHit = rule.manifests.some(m => fileNames.has(m) || allPaths.some(p => p.endsWith('/' + m)));
    const extCount = rule.extensions.reduce((sum, ext) => sum + (extCounts[ext] || 0), 0);

    if (manifestHit || extCount > 0) {
      let score = 0;
      if (manifestHit) {
        if (rule.name === 'Java / Kotlin') score += 200;
        else if (rule.name === 'Rust' || rule.name === 'Go') score += 200;
        else if (rule.name === 'TypeScript' || rule.name === 'JavaScript') score += 180;
        else if (rule.name === 'Python' && (fileNames.has('pyproject.toml') || fileNames.has('pipfile'))) score += 180;
        else score += 100;
      }
      if (extCount > 0) {
        score += Math.min(60, extCount * 4);
      }

      langScores[rule.name] = score;

      if (rule.frameworkDetectors) {
        for (const fd of rule.frameworkDetectors) {
          if (fd.match(fileNames, allPaths)) {
            matchedFrameworks.push(fd.name);
          }
        }
      }
    }
  }

  // Check Spring Boot / MyBatis in Java projects
  if (fileNames.has('pom.xml') || allPaths.some(p => p.includes('pom.xml'))) {
    if (allPaths.some(p => p.includes('spring') || p.includes('boot') || p.includes('application'))) {
      matchedFrameworks.push('Spring Boot');
    }
  }

  // Sort languages by score descending
  const sortedLanguages = Object.keys(langScores).sort((a, b) => langScores[b] - langScores[a]);
  const primaryLang = sortedLanguages[0] || 'Custom / Multi-Stack';

  // Determine primary package manager and test runner
  if (primaryLang === 'Java / Kotlin') {
    detectedPkgMgr = 'unknown';
    detectedTestFramework = 'custom';
    detectedTestCommand = fileNames.has('build.gradle') ? './gradlew test' : 'mvn test';
  } else if (primaryLang === 'Rust') {
    detectedPkgMgr = 'cargo';
    detectedTestFramework = 'cargo-test';
    detectedTestCommand = 'cargo test';
  } else if (primaryLang === 'Go') {
    detectedPkgMgr = 'go';
    detectedTestFramework = 'go-test';
    detectedTestCommand = 'go test ./...';
  } else if (primaryLang === 'TypeScript' || primaryLang === 'JavaScript') {
    if (fileNames.has('pnpm-lock.yaml')) detectedPkgMgr = 'pnpm';
    else if (fileNames.has('yarn.lock')) detectedPkgMgr = 'yarn';
    else detectedPkgMgr = 'npm';

    if (allPaths.some(p => p.includes('vitest') || p.includes('.test.ts') || p.includes('.test.tsx'))) {
      detectedTestFramework = 'vitest';
      detectedTestCommand = detectedPkgMgr === 'pnpm' ? 'pnpm test' : detectedPkgMgr === 'yarn' ? 'yarn test' : 'npm test';
    } else {
      detectedTestFramework = 'jest';
      detectedTestCommand = 'npm test';
    }
  } else if (primaryLang === 'Python') {
    detectedPkgMgr = fileNames.has('uv.lock') ? 'uv' : 'unknown';
    detectedTestFramework = 'pytest';
    detectedTestCommand = 'pytest';
  } else {
    const matchedRule = LANGUAGE_RULES.find(r => r.name === primaryLang);
    if (matchedRule) {
      if (detectedPkgMgr === 'unknown') detectedPkgMgr = matchedRule.packageManager;
      if (detectedTestFramework === 'none') detectedTestFramework = matchedRule.testFramework;
      if (!detectedTestCommand) detectedTestCommand = matchedRule.testCommand;
    }
  }

  // 2. Fallback
  const finalLanguages = sortedLanguages.length > 0 ? sortedLanguages : ['Custom / Multi-Stack'];
  const finalFrameworks = Array.from(new Set(matchedFrameworks));

  return {
    os,
    osName,
    shell,
    shellPath,
    languages: finalLanguages,
    frameworks: finalFrameworks,
    packageManager: detectedPkgMgr,
    testFramework: detectedTestFramework,
    testCommand: detectedTestCommand,
    installedToolchains: ['node', 'python', 'git', detectedPkgMgr].filter(x => x !== 'unknown'),
    activeWorkspacePath: workspacePath
  };
}

/**
 * Formats the project profile for inclusion in the AI System Prompt
 */
export function formatProfileForSystemPrompt(profile: ProjectProfile): string {
  const isWin = profile.os === 'windows';
  const shellConstraint = isWin
    ? '🚨 [Windows PowerShell 铁律]: 必须使用原生 PowerShell 语法；多条命令必须用分号 ";" 顺序连接，严禁使用 "&&" 运算符；严禁使用 Linux 专有命令 (如 grep, cat, rm -rf, touch, head, tail)；查看文件用 Get-Content/Get-ChildItem 或写自包含 Python 脚本执行！'
    : '🚨 [Unix/Bash 铁律]: 使用标准 Bash 语法与命令。';

  const testInstruction = profile.testCommand
    ? `契约验证单测框架: ${profile.testFramework} (推荐执行验证命令: \`${profile.testCommand}\`)`
    : `契约验证单测框架: 自定义/动态工程 (🚨 注意: 未检测到预设测试脚本，请在第一轮查看根目录构建文件以确认具体测试执行命令，严禁盲目臆造测试指令)`;

  return `
【🖥️ 宿主操作系统与当前工程画像 (Host OS & Project Profile)】:
- 宿主操作系统: ${profile.osName}
- 终端解释器 (Shell): ${profile.shellPath}
- 终端语法约束: ${shellConstraint}
- 项目主开发语言: ${profile.languages.join(' / ') || 'Custom Stack'}
- 应用框架/工具: ${profile.frameworks.length > 0 ? profile.frameworks.join(', ') : '标准工程架构'}
- 推荐包管理器: ${profile.packageManager}
- ${testInstruction}
- 🚨 严禁前置状态幻觉: 绝对禁止假设未经验证的中间临时文件存在！编写测试或修改代码时，严格遵循上述项目语言与单测规范。
`.trim();
}

/**
 * Generates a concise badge label for the chat header/input pill
 */
export function formatProfileBadge(profile: ProjectProfile): string {
  const osIcon = profile.os === 'windows' ? '🪟' : profile.os === 'macos' ? '🍎' : '🐧';
  const langText = profile.languages.slice(0, 2).join('+') || 'Multi-Stack';
  const testText = profile.testCommand ? ` · 🧪 ${profile.testCommand}` : '';
  return `${osIcon} ${profile.os === 'windows' ? 'Win' : 'Linux'} · ⚡ ${profile.shell} · 💻 ${langText}${testText}`;
}
