/**
 * IvyLens Social Operator - Business Task Agent
 * Phase 15: Foundation for ad hoc business task execution
 *
 * This module provides the extensible framework for non-social business tasks.
 * Each task capability is modelled as a discrete, pluggable handler.
 *
 * Architecture:
 * - Tasks are registered as named capabilities (e.g. 'email.reply', 'report.generate')
 * - The agent receives a parsed intent and routes to the correct handler
 * - Unsupported tasks return a clear "not yet enabled" message
 * - New capabilities can be added by registering a handler function
 */

import logger from '../lib/logger.js';
import StorageService, { STORAGE_KEYS } from '../services/storage.js';
import OutreachService from '../services/outreach.js';
import JobAdGenerator from '../services/jobAdGenerator.js';
import ATSService from '../services/ats.js';
import brandManager from '../config/brands.js';

const log = logger.child('BusinessTaskAgent');

class BusinessTaskAgent {
  constructor() {
    this.storage = new StorageService();
    this.outreach = new OutreachService();
    this.jobAdGenerator = new JobAdGenerator();
    this.ats = new ATSService();

    // Registry of task capabilities
    // Each key is a dot-separated capability name
    // Each value is { handler, description, enabled }
    this.capabilities = new Map();

    // Register built-in placeholder capabilities
    this.registerDefaults();
  }

  /**
   * Register default task capabilities (placeholders for future implementation)
   */
  registerDefaults() {
    // --- Outreach ---
    this.register('outreach.candidate', {
      description: 'Draft a candidate outreach message (LinkedIn/email)',
      enabled: true,
      handler: this.handleCandidateOutreach.bind(this),
    });

    this.register('outreach.client', {
      description: 'Draft a client/BD outreach message',
      enabled: true,
      handler: this.handleClientOutreach.bind(this),
    });

    this.register('outreach.followup', {
      description: 'Draft a follow-up message for a candidate or client',
      enabled: true,
      handler: this.handleFollowUp.bind(this),
    });

    // --- Job Ads ---
    this.register('jobad.generate', {
      description: 'Generate a full job ad from a brief',
      enabled: true,
      handler: this.handleJobAdGenerate.bind(this),
    });

    this.register('jobad.variants', {
      description: 'Generate job ad in multiple formats (full, LinkedIn, short)',
      enabled: true,
      handler: this.handleJobAdVariants.bind(this),
    });

    // --- ATS ---
    this.register('ats.candidates', {
      description: 'Search or list candidates in the ATS',
      enabled: true,
      handler: this.handleATSCandidates.bind(this),
    });

    this.register('ats.jobs', {
      description: 'List active jobs from the ATS',
      enabled: true,
      handler: this.handleATSJobs.bind(this),
    });

    this.register('ats.pipeline', {
      description: 'Get pipeline summary from the ATS',
      enabled: true,
      handler: this.handleATSPipeline.bind(this),
    });

    this.register('ats.clients', {
      description: 'List client organisations from the ATS',
      enabled: true,
      handler: this.handleATSClients.bind(this),
    });

    // --- Brand ---
    this.register('brand.info', {
      description: 'View active brand configuration',
      enabled: true,
      handler: this.handleBrandInfo.bind(this),
    });

    this.register('brand.list', {
      description: 'List all registered brands',
      enabled: true,
      handler: this.handleBrandList.bind(this),
    });

    // --- System ---
    this.register('system.status', {
      description: 'Get system health and status information',
      enabled: true,
      handler: this.handleSystemStatus.bind(this),
    });

    this.register('system.diagnostics', {
      description: 'Run system diagnostics and health checks',
      enabled: true,
      handler: this.handleDiagnostics.bind(this),
    });

    this.register('research.topic', {
      description: 'Research a specific topic using Tavily',
      enabled: true,
      handler: this.handleResearchTopic.bind(this),
    });

    // --- Future placeholders ---
    this.register('email.reply', {
      description: 'Draft or send an email reply in Tom\'s tone',
      enabled: false,
      handler: this.notYetEnabled,
    });

    this.register('email.search', {
      description: 'Search emails by sender, subject, or keyword',
      enabled: false,
      handler: this.notYetEnabled,
    });

    this.register('browser.open', {
      description: 'Open a URL in a headless browser',
      enabled: false,
      handler: this.notYetEnabled,
    });

    this.register('report.generate', {
      description: 'Generate a business or performance report',
      enabled: false,
      handler: this.notYetEnabled,
    });
  }

  /**
   * Register a new task capability
   */
  register(name, { description, enabled = false, handler }) {
    this.capabilities.set(name, { description, enabled, handler });
    log.debug(`Registered capability: ${name}`, { enabled });
  }

  /**
   * Execute a business task
   */
  async execute(taskName, params = {}) {
    log.info('Executing business task', { taskName, params: Object.keys(params) });

    const capability = this.capabilities.get(taskName);

    if (!capability) {
      return {
        success: false,
        error: `Unknown task: ${taskName}`,
        message: this.getSuggestionMessage(taskName),
      };
    }

    if (!capability.enabled) {
      return {
        success: false,
        error: 'Capability not yet enabled',
        message: `⚠️ *${taskName}* is not yet enabled.\n\n${capability.description}\n\nThis capability is planned for a future release.`,
      };
    }

    try {
      const result = await capability.handler(params);

      // Log the execution
      await this.logTaskExecution(taskName, params, result);

      return result;
    } catch (error) {
      log.error(`Business task failed: ${taskName}`, error);

      return {
        success: false,
        error: error.message,
        message: `❌ Task failed: ${error.message}`,
      };
    }
  }

  /**
   * List all available capabilities
   */
  listCapabilities(includeDisabled = true) {
    const capabilities = [];

    for (const [name, cap] of this.capabilities) {
      if (includeDisabled || cap.enabled) {
        capabilities.push({
          name,
          description: cap.description,
          enabled: cap.enabled,
        });
      }
    }

    return capabilities;
  }

  /**
   * Get formatted capabilities list for Telegram
   */
  getCapabilitiesMessage() {
    const caps = this.listCapabilities();

    let message = '🔧 *Business Task Capabilities*\n\n';

    const enabled = caps.filter(c => c.enabled);
    const disabled = caps.filter(c => !c.enabled);

    if (enabled.length > 0) {
      message += '*Available Now:*\n';
      for (const cap of enabled) {
        message += `✅ \`${cap.name}\` — ${cap.description}\n`;
      }
    }

    if (disabled.length > 0) {
      message += '\n*Coming Soon:*\n';
      for (const cap of disabled) {
        message += `⏳ \`${cap.name}\` — ${cap.description}\n`;
      }
    }

    return message;
  }

  /**
   * Suggest similar capabilities
   */
  getSuggestionMessage(taskName) {
    const allNames = Array.from(this.capabilities.keys());
    const prefix = taskName.split('.')[0];
    const related = allNames.filter(n => n.startsWith(prefix));

    let message = `❓ Unknown task: \`${taskName}\`\n\n`;

    if (related.length > 0) {
      message += 'Did you mean one of these?\n';
      for (const name of related) {
        const cap = this.capabilities.get(name);
        message += `• \`${name}\` — ${cap.description}\n`;
      }
    } else {
      message += 'Use /tasks to see all available capabilities.';
    }

    return message;
  }

  // --- Outreach handlers ---

  async handleCandidateOutreach(params) {
    if (params.rawText) {
      const parsed = this.outreach.parseOutreachRequest(params.rawText);
      params = { ...parsed.params, channel: parsed.channel, ...params };
    }
    const result = await this.outreach.draftCandidateOutreach(params);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    return {
      success: true,
      message: `✉️ *Candidate Outreach Draft*\n_(${params.channel || 'linkedin'})_\n\n${result.message}`,
    };
  }

  async handleClientOutreach(params) {
    if (params.rawText) {
      const parsed = this.outreach.parseOutreachRequest(params.rawText);
      params = { ...parsed.params, channel: parsed.channel, purpose: parsed.purpose || 'introduction', ...params };
    }
    const result = await this.outreach.draftClientOutreach(params);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    return {
      success: true,
      message: `✉️ *Client Outreach Draft*\n_(${params.purpose || 'introduction'} via ${params.channel || 'email'})_\n\n${result.message}`,
    };
  }

  async handleFollowUp(params) {
    const result = await this.outreach.draftFollowUp(params);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    return {
      success: true,
      message: `🔄 *Follow-Up Draft*\n\n${result.message}`,
    };
  }

  // --- Job Ad handlers ---

  async handleJobAdGenerate(params) {
    if (params.rawText) {
      const parsed = this.jobAdGenerator.parseJobAdRequest(params.rawText);
      params = { ...parsed, ...params };
    }
    const result = await this.jobAdGenerator.generateJobAd(params);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    return {
      success: true,
      message: `📋 *Job Ad — ${params.jobTitle || 'Generated'}*\n_(${params.format || 'full'} format)_\n\n${result.message}`,
    };
  }

  async handleJobAdVariants(params) {
    if (params.rawText) {
      const parsed = this.jobAdGenerator.parseJobAdRequest(params.rawText);
      params = { ...parsed, ...params };
    }
    const result = await this.jobAdGenerator.generateVariants(params);
    if (!result.success) return { success: false, message: '❌ Failed to generate variants' };

    let message = `📋 *Job Ad Variants — ${params.jobTitle || 'Generated'}*\n\n`;
    for (const [format, content] of Object.entries(result.variants)) {
      message += `━━━ *${format.toUpperCase()}* ━━━\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}\n\n`;
    }
    return { success: true, message };
  }

  // --- ATS handlers ---

  async handleATSCandidates(params) {
    if (!this.ats.isConfigured()) {
      return { success: false, message: '⚠️ ATS not configured. Set MANATAL_API_KEY in environment.' };
    }
    const result = await this.ats.listCandidates(params);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    return {
      success: true,
      message: this.ats.formatCandidatesForTelegram(result.candidates, result.total),
      data: result.candidates,
    };
  }

  async handleATSJobs(params) {
    if (!this.ats.isConfigured()) {
      return { success: false, message: '⚠️ ATS not configured. Set MANATAL_API_KEY in environment.' };
    }
    const filters = { status: 'active', ...params };
    const result = await this.ats.listJobs(filters);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    return {
      success: true,
      message: this.ats.formatJobsForTelegram(result.jobs, result.total),
      data: result.jobs,
    };
  }

  async handleATSPipeline(params) {
    if (!this.ats.isConfigured()) {
      return { success: false, message: '⚠️ ATS not configured. Set MANATAL_API_KEY in environment.' };
    }
    return await this.ats.getPipelineSummary();
  }

  async handleATSClients(params) {
    if (!this.ats.isConfigured()) {
      return { success: false, message: '⚠️ ATS not configured. Set MANATAL_API_KEY in environment.' };
    }
    const result = await this.ats.listOrganisations(params);
    if (!result.success) return { success: false, message: `❌ ${result.error}` };

    if (!result.organisations?.length) {
      return { success: true, message: '📭 No client organisations found.' };
    }

    let message = `🏢 *Client Organisations* (${result.total} total)\n\n`;
    for (const org of result.organisations) {
      message += `*${org.name}*\n`;
      if (org.website) message += `  🌐 ${org.website}\n`;
      if (org.address) message += `  📍 ${org.address}\n`;
      message += '\n';
    }
    return { success: true, message, data: result.organisations };
  }

  // --- Brand handlers ---

  async handleBrandInfo(params) {
    return { success: true, message: brandManager.getActiveBrandInfo() };
  }

  async handleBrandList(params) {
    const brands = brandManager.listBrands();
    let message = '🏷️ *Registered Brands*\n\n';
    for (const b of brands) {
      const isActive = b.slug === brandManager.activeBrandSlug ? ' ✅' : '';
      message += `*${b.name}*${isActive}\n`;
      message += `  Slug: ${b.slug} | Owner: ${b.owner}\n`;
      message += `  Sectors: ${b.sectors} | Platforms: ${b.platforms}\n\n`;
    }
    return { success: true, message };
  }

  // --- Built-in handlers ---

  /**
   * Placeholder handler for not-yet-enabled capabilities
   */
  async notYetEnabled(params) {
    return {
      success: false,
      message: '⏳ This capability is not yet enabled. It will be available in a future update.',
    };
  }

  /**
   * Handle system status task
   */
  async handleSystemStatus(params) {
    const SystemCommands = (await import('../commands/system.js')).default;
    const systemCommands = new SystemCommands();
    const status = await systemCommands.getSystemStatus();

    return {
      success: true,
      message: status,
    };
  }

  /**
   * Handle diagnostics task
   */
  async handleDiagnostics(params) {
    const checks = {
      storage: false,
      config: false,
      timestamp: new Date().toISOString(),
    };

    // Check storage
    try {
      await this.storage.set('_diagnostics_test', 'ok');
      const val = await this.storage.get('_diagnostics_test');
      checks.storage = val === 'ok';
      await this.storage.delete('_diagnostics_test');
    } catch (_) {
      checks.storage = false;
    }

    // Check config
    try {
      const config = (await import('../config/index.js')).default;
      checks.config = !!(config.telegram.botToken && config.apis.groq.apiKey && config.apis.tavily.apiKey);
    } catch (_) {
      checks.config = false;
    }

    const allPassing = Object.values(checks).every(v => v === true || typeof v === 'string');

    let message = '🔍 *System Diagnostics*\n\n';
    message += `Storage: ${checks.storage ? '✅' : '❌'}\n`;
    message += `Config: ${checks.config ? '✅' : '❌'}\n`;
    message += `\n_Run at ${checks.timestamp}_`;

    return {
      success: allPassing,
      message,
      checks,
    };
  }

  /**
   * Handle research topic task
   */
  async handleResearchTopic(params) {
    const { topic } = params;

    if (!topic) {
      return {
        success: false,
        message: '❌ Please provide a topic to research.',
      };
    }

    const TavilyService = (await import('../services/tavily.js')).default;
    const tavily = new TavilyService();

    const result = await tavily.search(topic, { maxResults: 5 });

    if (!result.success || !result.data?.topics?.length) {
      return {
        success: false,
        message: `❌ No results found for: ${topic}`,
      };
    }

    let message = `🔍 *Research: ${topic}*\n\n`;
    for (const t of result.data.topics.slice(0, 5)) {
      message += `• *${t.title}*\n  ${t.description?.substring(0, 150)}...\n\n`;
    }

    return {
      success: true,
      message,
      data: result.data.topics,
    };
  }

  /**
   * Log task execution for audit trail
   */
  async logTaskExecution(taskName, params, result) {
    try {
      const logEntry = {
        taskName,
        params: Object.keys(params),
        success: result.success,
        timestamp: new Date().toISOString(),
      };

      const history = await this.storage.get('task_execution_history') || [];
      history.unshift(logEntry);

      // Keep last 100 entries
      if (history.length > 100) {
        history.splice(100);
      }

      await this.storage.set('task_execution_history', history);
    } catch (error) {
      log.warn('Failed to log task execution', error);
    }
  }
}

export default BusinessTaskAgent;
