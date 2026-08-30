import { WorkMode, PermissionPolicy, loadSavedProviders } from '../types/contracts';
import { loadSavedGlobalSettings } from './settingsStore';
import { loadSavedRules, buildPromptRulesSnapshot } from './rulesStore';
import { loadSavedOfficialSkills, buildTier1SkillsSystemPrompt } from './skillsEngine';
import { loadSavedMcpConfigs, initializeMcpServer, buildMcpToolsModelPrompt } from './mcpGateway';
import { ContextSnapshot, ContextSource } from '../types/agentRuntimeTypes';
import { buildModelCatalogEntry, type ModelAdapter, type ModelProtocol } from './modelGateway';

export interface RuntimeConfigSnapshot {
  id: string;
  createdAt: number;
  providerId: string;
  modelId: string;
  adapter: ModelAdapter;
  protocol: ModelProtocol;
  endpointPath: string;
  workMode: WorkMode;
  permissionPolicy: PermissionPolicy;
  isAirGapped: boolean;
  autoShadowSnapshot: boolean;
  dataDesensitize: boolean;
  
  // Context snapshot for the prompt
  contextSnapshot: ContextSnapshot;
}

export class RuntimeConfigResolver {
  public static async resolveCurrentConfig(
    providerId: string,
    modelId: string,
    workMode: WorkMode = 'act',
    permissionPolicy: PermissionPolicy = 'autonomous_agent',
    projectPath: string = ''
  ): Promise<RuntimeConfigSnapshot> {
    const globalSettings = loadSavedGlobalSettings();
    const rules = loadSavedRules();
    const skills = loadSavedOfficialSkills();
    const mcpConfigs = loadSavedMcpConfigs();

    // 1. Filter Rules by scope (project / global)
    const activeRules = rules.filter(r => r.enabled);
    const rulesSnapshot = buildPromptRulesSnapshot(activeRules);

    // 2. Resolve Active Skills (Tier 1 Metadata only)
    const activeSkills = skills.filter(s => s.enabled);
    const skillsPrompt = buildTier1SkillsSystemPrompt();

    // 3. Resolve Active MCP Runtimes and Tools
    const activeMcpConfigs = mcpConfigs.filter(m => m.enabled);
    const mcpRuntimes = await Promise.all(activeMcpConfigs.map(c => initializeMcpServer(c)));
    const mcpPrompt = buildMcpToolsModelPrompt(mcpRuntimes);

    // 4. Form Immutable Context Sources
    const contextSources: ContextSource[] = [];
    activeRules.forEach(r => {
      contextSources.push({
        id: r.id,
        type: 'rule',
        name: r.title,
        path: r.sourceFile,
        reason: 'always',
        injected: true,
        tokenCount: Math.ceil(r.description.length / 3)
      });
    });

    activeSkills.forEach(s => {
      contextSources.push({
        id: `skill-${s.name}`,
        type: 'skill',
        name: s.name,
        path: s.path,
        reason: 'selected',
        injected: true,
        tokenCount: Math.ceil(s.description.length / 3)
      });
    });

    const mcpCapabilities = mcpRuntimes.map(r => ({
      name: r.config.name,
      toolsCount: r.tools.length
    }));

    // 5. Construct Unified System Prompt
    const systemPromptParts = [
      '你是 Tcode 资深全栈研发 Agent，拥有自主规划、代码编写、终端执行与目标验证的完整闭环能力。',
      `当前执行工作模式: 【${workMode}】`,
      `当前权限策略: 【${permissionPolicy}】`,
      rulesSnapshot.rulesSnapshotText,
      skillsPrompt,
      mcpPrompt
    ].filter(Boolean);

    const systemPromptText = systemPromptParts.join('\n\n');
    const estimatedTokens = Math.ceil(systemPromptText.length / 3.2);

    const snapshotId = `ctx-snap-${Date.now()}`;
    const contextSnapshot: ContextSnapshot = {
      id: snapshotId,
      runId: '',
      systemRules: contextSources.filter(c => c.type === 'rule'),
      steeringFiles: [],
      selectedSkills: contextSources.filter(c => c.type === 'skill'),
      mcpCapabilities,
      referencedFiles: [],
      systemPromptText,
      estimatedTokens,
      contextLimit: 128000,
      createdAt: Date.now()
    };

    const providers = loadSavedProviders();
    const provider = providers.find(item => item.id === providerId) || providers[0];
    const model = provider?.models?.find(item => item.id === modelId) || {
      id: modelId,
      name: modelId,
      enabled: true,
      contextLimit: 128000,
      capabilities: []
    };
    const modelEntry = provider
      ? buildModelCatalogEntry(provider, model)
      : buildModelCatalogEntry({ id: providerId, name: providerId, enabled: true, baseUrl: '', apiKey: '' }, model);

    return {
      id: `rc-snap-${Date.now()}`,
      createdAt: Date.now(),
      providerId,
      modelId,
      adapter: modelEntry.adapter,
      protocol: modelEntry.protocol,
      endpointPath: modelEntry.endpointPath,
      workMode: globalSettings.defaultWorkMode || workMode,
      permissionPolicy: globalSettings.defaultPermissionPolicy || permissionPolicy,
      isAirGapped: globalSettings.isAirGapped,
      autoShadowSnapshot: globalSettings.autoShadowSnapshot,
      dataDesensitize: globalSettings.dataDesensitize,
      contextSnapshot
    };
  }
}
