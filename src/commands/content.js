/**
 * IvyLens Social Operator - Content Commands
 * Phase 13: Operating Modes and Content Management
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import StorageService, { STORAGE_KEYS } from '../services/storage.js';
import GroqService from '../services/groq.js';
import TavilyService from '../services/tavily.js';
import TopicSelector from '../agents/topicSelector.js';
import PlatformFormatter from '../agents/platformFormatter.js';

const log = logger.child('ContentCommands');

class ContentCommands {
  constructor() {
    this.storage = new StorageService();
    this.groq = new GroqService();
    this.tavily = new TavilyService();
    this.topicSelector = new TopicSelector();
    this.formatter = new PlatformFormatter();
  }

  /**
   * Generate content ideas
   */
  async generateIdeas(topic) {
    try {
      log.info('Generating ideas', { topic });
      
      const result = await this.groq.generateIdeas(topic);
      
      if (result.success) {
        return `💡 *Content Ideas for: ${topic}*\n\n${result.ideas}`;
      } else {
        return `❌ Failed to generate ideas: ${result.error}`;
      }
      
    } catch (error) {
      log.error('Generate ideas error', error);
      return '❌ Failed to generate ideas';
    }
  }

  /**
   * Create draft post
   */
  async createDraft(topic, platforms = ['all']) {
    try {
      log.info('Creating draft', { topic, platforms });
      
      // Research the topic first
      const searchResult = await this.tavily.search(topic, { maxResults: 3 });
      
      if (!searchResult.success || !searchResult.data?.topics?.length) {
        return '❌ Could not find information about this topic';
      }
      
      // Select best topic
      const selectionResult = await this.topicSelector.selectTopics(
        searchResult.data.topics,
        { count: 1 }
      );
      
      if (!selectionResult.success || !selectionResult.selected?.length) {
        return '❌ Could not select a suitable topic';
      }
      
      const selectedTopic = selectionResult.selected[0];
      
      // Generate content for requested platforms
      const targetPlatforms = this.getPlatforms(platforms);
      let drafts = '📝 *Draft Posts Created*\n\n';
      
      for (const platform of targetPlatforms) {
        const contentResult = await this.groq.generateContent(selectedTopic, platform);
        
        if (contentResult.success) {
          // Format the content
          const formatted = this.formatter.formatForPlatform(
            contentResult.content,
            platform
          );
          
          // Store draft
          const draft = {
            id: `draft_${platform}_${Date.now()}`,
            platform,
            content: formatted.content,
            hashtags: formatted.hashtags,
            topic: topic,
            createdAt: new Date().toISOString(),
          };
          
          await this.storeDraft(draft);
          
          // Add to response
          drafts += `*${platform}:*\n`;
          drafts += `${formatted.content.substring(0, 200)}...\n\n`;
        }
      }
      
      return drafts;
      
    } catch (error) {
      log.error('Create draft error', error);
      return '❌ Failed to create draft';
    }
  }

  /**
   * Get scheduled previews
   */
  async getScheduledPreviews() {
    try {
      const drafts = await this.storage.get(STORAGE_KEYS.DRAFTS) || [];
      const pending = await this.storage.get(STORAGE_KEYS.PENDING_APPROVALS) || [];
      
      if (drafts.length === 0 && pending.length === 0) {
        return '📭 No scheduled posts';
      }
      
      let message = '📅 *Scheduled Content*\n\n';
      
      if (drafts.length > 0) {
        message += '*📝 Drafts:*\n';
        for (const draft of drafts.slice(0, 5)) {
          const time = new Date(draft.createdAt).toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
          });
          
          message += `\n*${draft.platform}* (${time})\n`;
          message += `${draft.content.substring(0, 100)}...\n`;
        }
        
        if (drafts.length > 5) {
          message += `\n_...and ${drafts.length - 5} more drafts_\n`;
        }
      }
      
      if (pending.length > 0) {
        message += '\n*⏳ Pending Approval:*\n';
        for (const item of pending.slice(0, 3)) {
          message += `• ${item.platform}: ${item.content.substring(0, 50)}...\n`;
        }
        
        if (pending.length > 3) {
          message += `_...and ${pending.length - 3} more pending_\n`;
        }
      }
      
      return message;
      
    } catch (error) {
      log.error('Get scheduled previews error', error);
      return '❌ Failed to get previews';
    }
  }

  /**
   * Edit draft
   */
  async editDraft(draftId, newContent) {
    try {
      const drafts = await this.storage.get(STORAGE_KEYS.DRAFTS) || [];
      const draftIndex = drafts.findIndex(d => d.id === draftId);
      
      if (draftIndex === -1) {
        return {
          success: false,
          error: 'Draft not found',
        };
      }
      
      // Update draft content
      drafts[draftIndex].content = newContent;
      drafts[draftIndex].editedAt = new Date().toISOString();
      
      await this.storage.set(STORAGE_KEYS.DRAFTS, drafts);
      
      return {
        success: true,
        message: '✅ Draft updated',
      };
      
    } catch (error) {
      log.error('Edit draft error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Approve post
   */
  async approvePost(postId) {
    try {
      const pending = await this.storage.get(STORAGE_KEYS.PENDING_APPROVALS) || [];
      const post = pending.find(p => p.postId === postId);
      
      if (!post) {
        return {
          success: false,
          error: 'Post not found',
        };
      }
      
      // Move to publishing queue
      const PostFastService = (await import('../services/postfast.js')).default;
      const postfast = new PostFastService();
      
      const result = await postfast.publishToPlatform(
        post.platform,
        post.content,
        { hashtags: post.hashtags }
      );
      
      if (result.success) {
        // Remove from pending
        const updatedPending = pending.filter(p => p.postId !== postId);
        await this.storage.set(STORAGE_KEYS.PENDING_APPROVALS, updatedPending);
        
        return {
          success: true,
          message: `✅ Published to ${post.platform}`,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
      
    } catch (error) {
      log.error('Approve post error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reject post
   */
  async rejectPost(postId) {
    try {
      const pending = await this.storage.get(STORAGE_KEYS.PENDING_APPROVALS) || [];
      const updatedPending = pending.filter(p => p.postId !== postId);
      
      await this.storage.set(STORAGE_KEYS.PENDING_APPROVALS, updatedPending);
      
      return {
        success: true,
        message: '✅ Post rejected',
      };
      
    } catch (error) {
      log.error('Reject post error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get content variations
   */
  async getVariations(topic, platform, count = 3) {
    try {
      log.info('Generating variations', { topic, platform, count });
      
      // Research topic
      const searchResult = await this.tavily.search(topic, { maxResults: 1 });
      
      if (!searchResult.success || !searchResult.data?.topics?.length) {
        return '❌ Could not find information about this topic';
      }
      
      const topicData = searchResult.data.topics[0];
      
      // Generate variations
      const variations = await this.groq.generateVariations(topicData, platform, count);
      
      if (variations.length === 0) {
        return '❌ Could not generate variations';
      }
      
      let message = `🔄 *Content Variations for ${platform}*\n\n`;
      
      for (let i = 0; i < variations.length; i++) {
        const variation = variations[i];
        message += `*Option ${i + 1} (${variation.angle}):*\n`;
        message += `${variation.content.substring(0, 200)}...\n\n`;
      }
      
      return message;
      
    } catch (error) {
      log.error('Get variations error', error);
      return '❌ Failed to generate variations';
    }
  }

  /**
   * Refine content
   */
  async refineContent(content, platform, instructions) {
    try {
      log.info('Refining content', { platform, instructions });
      
      const result = await this.groq.refineContent(content, platform, instructions);
      
      if (result.success) {
        // Format the refined content
        const formatted = this.formatter.formatForPlatform(result.content, platform);
        
        return {
          success: true,
          content: formatted.content,
          message: '✅ Content refined',
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
      
    } catch (error) {
      log.error('Refine content error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Store draft
   */
  async storeDraft(draft) {
    const drafts = await this.storage.get(STORAGE_KEYS.DRAFTS) || [];
    drafts.unshift(draft);
    
    // Keep only last 50 drafts
    if (drafts.length > 50) {
      drafts.splice(50);
    }
    
    await this.storage.set(STORAGE_KEYS.DRAFTS, drafts);
  }

  /**
   * Get platforms
   */
  getPlatforms(platformsOption) {
    if (!platformsOption || platformsOption.includes('all')) {
      return Object.keys(config.content.platforms).filter(
        p => config.content.platforms[p].enabled
      );
    }
    
    if (Array.isArray(platformsOption)) {
      return platformsOption.filter(p => 
        config.content.platforms[p]?.enabled
      );
    }
    
    return ['linkedin']; // Default
  }

  /**
   * Get trending topics
   */
  async getTrendingTopics() {
    try {
      log.info('Getting trending topics');
      
      const result = await this.tavily.getTrendingTopics({ limit: 10 });
      
      if (!result.success || !result.topics?.length) {
        return '❌ No trending topics found';
      }
      
      let message = '🔥 *Trending Topics*\n\n';
      
      for (let i = 0; i < Math.min(5, result.topics.length); i++) {
        const topic = result.topics[i];
        message += `${i + 1}. *${topic.title}*\n`;
        
        if (topic.sector) {
          message += `   Sector: ${topic.sector}\n`;
        }
        
        message += `   Score: ${topic.contentScore || topic.relevanceScore}/100\n`;
        message += `   Freshness: ${topic.freshness}\n\n`;
      }
      
      return message;
      
    } catch (error) {
      log.error('Get trending topics error', error);
      return '❌ Failed to get trending topics';
    }
  }
}

export default ContentCommands;