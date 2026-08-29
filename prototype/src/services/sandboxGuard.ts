import { evaluateSandboxCommandSafety, SandboxSafetyCheckResult } from '../types/contracts';

export class SandboxGuardService {
  private sudoWhitelist: Set<string> = new Set();

  public checkCommand(cmd: string): SandboxSafetyCheckResult {
    if (this.sudoWhitelist.has(cmd.trim())) {
      return {
        isSafe: true,
        command: cmd,
        requiresSudo: false
      };
    }
    return evaluateSandboxCommandSafety(cmd);
  }

  public grantTemporarySudo(cmd: string): void {
    this.sudoWhitelist.add(cmd.trim());
  }

  public revokeSudo(cmd: string): void {
    this.sudoWhitelist.delete(cmd.trim());
  }
}

export const defaultSandboxGuard = new SandboxGuardService();
