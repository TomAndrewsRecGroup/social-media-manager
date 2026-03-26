/**
 * IvyLens Social Operator - System Commands
 * Phase 12: Telegram Controls
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import StorageService, { STORAGE_KEYS, StorageUtils } from '../services/storage.js';
import { isValidMode } from '../lib/validators.js';

const log = logger.child('SystemCommands');

class SystemCommands {
  constructor() {
    this.storage = new StorageService();
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    try {
      const [
        isPaused,
        currentMode,
        lastRun,
        drafts,
        pending
      ] = await Promise.all([
        this.storage.get(STORAGE_KEYS.AUTOMATION_PAUSED),
        this.storage.get(STORAGE_KEYS.CURRENT_MODE),
        this.storage.get(STORAGE_KEYS.LAST_SOCIAL_RUN),
        this.storage.get(STORAGE_KEYS.DRAFTS),
        this.storage.get(STORAGE_KEYS.PENDING_APPROVALS),
      ]);
      
      let status = '📊 *System Status*\n\n';
      
      // Automation status
      status += `*Automation:* ${isPaused ? '⏸️ Paused' : '▶️ Running'}\n`;
      status += `*Mode:* ${currentMode || config.modes.default}\n`;
      
      // Last run
      if (lastRun) {
        const time = new Date(lastRun.timestamp).toLocaleString('en-GB', {
          timeZone: 'Europe/London',
        });
        status += `*Last Run:* ${time}\n`;
        status += `*Result:* ${lastRun.success ? '✅ Success' : '❌ Failed'}\n`;
      } else {
        status += `*Last Run:* Never\n`;
      }
      
      // Pending items
      status += `\n*Pending Items:*\n`;
      status += `• Drafts: ${drafts?.length || 0}\n`;
      status += `• Approvals: ${pending?.length || 0}\n`;
      
      // Platform status
      const platforms = Object.entries(config.content.platforms)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name]) => name);
      
      status += `\n*Active Platforms:*\n`;
      status += platforms.map(p => `• ${p}`).join('\n');
      
      return status;
      
    } catch (error) {
      log.error('Get system status error', error);
      return '❌ Failed to get system status';
    }
  }

  /**
   * Get posting schedule
   */
  async getSchedule() {
    try {
      const schedule = config.scheduling;
      
      let message = '📅 *Posting Schedule*\n\n';
      
      message += `*Research Time:* ${schedule.researchTime}\n\n`;
      
      message += '*Platform Times:*\n';
      for (const [platform, times] of Object.entries(schedule.defaultPostTimes)) {
        if (config.content.platforms[platform]?.enabled) {
          message += `\n*${platform}:*\n`;
          message += times.map(t => `• ${t}`).join('\n') + '\n';
        }
      }
      
      message += `\n*Timezone:* ${schedule.timezone}`;
      
      return message;
      
    } catch (error) {
      log.error('Get schedule error', error);
      return '❌ Failed to get schedule';
    }
  }

  /**
   * Pause automation
   */
  async pauseAutomation() {
    try {
      await this.storage.set(STORAGE_KEYS.AUTOMATION_PAUSED, true);
      log.info('Automation paused');
      
      return {
        success: true,
        message: 'Automation paused',
      };
      
    } catch (error) {
      log.error('Pause automation error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resume automation
   */
  async resumeAutomation() {
    try {
      await this.storage.delete(STORAGE_KEYS.AUTOMATION_PAUSED);
      log.info('Automation resumed');
      
      return {
        success: true,
        message: 'Automation resumed',
      };
      
    } catch (error) {
      log.error('Resume automation error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Set operating mode
   */
  async setMode(mode) {
    if (!isValidMode(mode)) {
      return {
        success: false,
        error: `Invalid mode: ${mode}. Valid modes are: auto, draft, approval`,
      };
    }
    
    try {
      await this.storage.set(STORAGE_KEYS.CURRENT_MODE, mode);
      log.info(`Mode changed to: ${mode}`);
      
      return {
        success: true,
        message: `✅ Mode changed to: *${mode}*`,
      };
      
    } catch (error) {
      log.error('Set mode error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get platform status
   */
  async getPlatformStatus() {
    try {
      const platformSettings = await this.storage.get(STORAGE_KEYS.PLATFORM_SETTINGS) || {};
      
      let message = '🌐 *Platform Status*\n\n';
      
      for (const [platform, platformCfg] of Object.entries(config.content.platforms)) {
        const customSettings = platformSettings[platform] || {};
        const enabled = customSettings.enabled !== undefined
          ? customSettings.enabled
          : platformCfg.enabled;

        message += `*${platform}:* ${enabled ? '✅' : '❌'}\n`;
        message += `• Max length: ${platformCfg.maxLength}\n`;
        message += `• Hashtag limit: ${platformCfg.hashtagLimit}\n\n`;
      }
      
      return message;
      
    } catch (error) {
      log.error('Get platform status error', error);
      return '❌ Failed to get platform status';
    }
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(count = 10) {
    try {
      const workflows = await StorageUtils.getPaginatedList(
        this.storage,
        STORAGE_KEYS.RECENT_WORKFLOWS,
        1,
        count
      );
      
      if (!workflows.items || workflows.items.length === 0) {
        return '📋 No recent activity';
      }
      
      let message = '📋 *Recent Activity*\n\n';
      
      for (const workflow of workflows.items) {
        const time = new Date(workflow.timestamp).toLocaleString('en-GB', {
          timeZone: 'Europe/London',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: 'short',
        });
        
        const icon = workflow.success ? '✅' : '❌';
        message += `${icon} ${time}\n`;
        
        if (workflow.stats) {
          message += `   Posts: ${workflow.stats.postsPublished || 0}/${workflow.stats.postsGenerated || 0}\n`;
        }
      }
      
      message += `\n_Showing ${workflows.items.length} of ${workflows.total} total_`;
      
      return message;
      
    } catch (error) {
      log.error('Get recent logs error', error);
      return '❌ Failed to get logs';
    }
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    try {
      const [
        today,
        week,
        month,
        workflows
      ] = await Promise.all([
        this.storage.get(STORAGE_KEYS.POSTS_PUBLISHED_TODAY),
        this.storage.get(STORAGE_KEYS.POSTS_PUBLISHED_WEEK),
        this.storage.get(STORAGE_KEYS.POSTS_PUBLISHED_MONTH),
        this.storage.get(STORAGE_KEYS.RECENT_WORKFLOWS),
      ]);
      
      let message = '📈 *Statistics*\n\n';
      
      message += '*Posts Published:*\n';
      message += `• Today: ${today || 0}\n`;
      message += `• This week: ${week || 0}\n`;
      message += `• This month: ${month || 0}\n\n`;
      
      if (workflows && workflows.length > 0) {
        const successful = workflows.filter(w => w.success).length;
        const successRate = Math.round((successful / workflows.length) * 100);
        
        message += '*Workflow Performance:*\n';
        message += `• Total runs: ${workflows.length}\n`;
        message += `• Success rate: ${successRate}%\n`;
      }
      
      return message;
      
    } catch (error) {
      log.error('Get statistics error', error);
      return '❌ Failed to get statistics';
    }
  }

  /**
   * Clear drafts
   */
  async clearDrafts() {
    try {
      await this.storage.delete(STORAGE_KEYS.DRAFTS);
      log.info('Drafts cleared');
      
      return {
        success: true,
        message: '✅ All drafts cleared',
      };
      
    } catch (error) {
      log.error('Clear drafts error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear pending approvals
   */
  async clearPendingApprovals() {
    try {
      await this.storage.delete(STORAGE_KEYS.PENDING_APPROVALS);
      log.info('Pending approvals cleared');
      
      return {
        success: true,
        message: '✅ All pending approvals cleared',
      };
      
    } catch (error) {
      log.error('Clear pending approvals error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Toggle platform
   */
  async togglePlatform(platform, enabled) {
    try {
      const settings = await this.storage.get(STORAGE_KEYS.PLATFORM_SETTINGS) || {};
      
      if (!settings[platform]) {
        settings[platform] = {};
      }
      
      settings[platform].enabled = enabled;
      
      await this.storage.set(STORAGE_KEYS.PLATFORM_SETTINGS, settings);
      
      log.info(`Platform ${platform} ${enabled ? 'enabled' : 'disabled'}`);
      
      return {
        success: true,
        message: `✅ ${platform} ${enabled ? 'enabled' : 'disabled'}`,
      };
      
    } catch (error) {
      log.error('Toggle platform error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reset system
   */
  async resetSystem() {
    try {
      // Clear non-essential data
      await Promise.all([
        this.storage.delete(STORAGE_KEYS.DRAFTS),
        this.storage.delete(STORAGE_KEYS.PENDING_APPROVALS),
        this.storage.delete(STORAGE_KEYS.RECENT_WORKFLOWS),
        this.storage.delete(STORAGE_KEYS.RECENT_TOPICS),
        this.storage.delete(STORAGE_KEYS.LATEST_RESEARCH),
      ]);
      
      log.info('System reset completed');
      
      return {
        success: true,
        message: '✅ System reset completed',
      };
      
    } catch (error) {
      log.error('Reset system error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default SystemCommands;