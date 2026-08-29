import { redactSensitivePii, unredactSensitivePii, RedactionResult } from '../types/contracts';

export class SecurityShield {
  public sanitizePrompt(prompt: string): RedactionResult {
    return redactSensitivePii(prompt);
  }

  public restoreResponse(response: string, secretMap: Record<string, string>): string {
    return unredactSensitivePii(response, secretMap);
  }
}

export const defaultSecurityShield = new SecurityShield();
