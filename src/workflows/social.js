/**
 * IvyLens Social Operator - Social Media Workflow
 * Phase 9: Full workflow integration
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import TavilyService from '../services/tavily.js';
import TopicSelector from '../agents/topicSelector.js';
import GroqService from '../services/groq.js';
import PlatformFormatter from '../agents/platformFormatter.js';
import PostFastService from '../services/postfast.js';
import TelegramService from '../services/telegram.js';
import StorageService, { STORAGE_KEYS, StorageUtils } from '../services/storage.js';

const log = logger.child('SocialWorkflow');

class SocialWorkflow {
  constructor() {
    this.tavily = new TavilyService();
    this.topicSelector = new TopicSelector();
    this.groq = new GroqService();
    this.formatter = new PlatformFormatter();
    this.PostFast = PostFastService;
    this.postfast = new this.PostFast();
    this.telegram = new TelegramService();
    this.storage = new StorageService();
  }

  /**
   * Execute full social media workflow
   */
  async execute(options = {}) {
    const workflowId = `workflow_${Date.now()}`;
    const startTime = new Date();
    
    // Resolve operating mode: explicit option > stored setting > config default
    const storedMode = await this.storage.get(STORAGE_KEYS.CURRENT_MODE);
    const resolvedMode = options.mode || storedMode || config.modes.default;

    log.workflowStart('Social Media Workflow', {
      workflowId,
      mode: resolvedMode,
      platforms: options.platforms || ['all'],
    });

    try {
      // Step 1: Research trending topics
      const researchResult = await this.researchPhase(options);
      
      if (!researchResult.success) {
        throw new Error('Research phase failed: ' + researchResult.error);
      }
      
      // Step 2: Select best topic
      const selectionResult = await this.selectionPhase(
        researchResult.topics,
        options
      );
      
      if (!selectionResult.success || selectionResult.selected.length === 0) {
        throw new Error('Topic selection failed: ' + selectionResult.error);
      }
      
      const selectedTopic = selectionResult.selected[0];
      
      // Step 3: Generate content
      const generationResult = await this.generationPhase(
        selectedTopic,
        options
      );
      
      if (!generationResult.success) {
        throw new Error('Content generation failed: ' + generationResult.error);
      }
      
      // Step 4: Format for platforms
      const formattingResult = await this.formattingPhase(
        generationResult.content,
        options
      );
      
      if (!formattingResult.success) {
        throw new Error('Formatting failed: ' + formattingResult.error);
      }
      
      // Step 5: Handle based on mode
      let publishResult;
      const mode = resolvedMode;
      
      switch (mode) {
        case 'auto':
          publishResult = await this.publishPhase(formattingResult.posts, options);
          break;
          
        case 'approval':
          publishResult = await this.approvalPhase(
            formattingResult.posts,
            options
          );
          break;
          
        case 'draft':
          publishResult = await this.draftPhase(formattingResult.posts, options);
          break;
          
        default:
          publishResult = await this.publishPhase(formattingResult.posts, options);
      }
      
      // Step 6: Store workflow results
      const workflowResult = {
        workflowId,
        success: publishResult.success,
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        topic: selectedTopic,
        posts: formattingResult.posts,
        publishResults: publishResult,
        stats: {
          topicsResearched: researchResult.stats.totalResearched,
          topicsSelected: 1,
          postsGenerated: Object.keys(formattingResult.posts).length,
          postsPublished: publishResult.stats?.successful || 0,
        },
      };
      
      await this.storeWorkflowResult(workflowResult);
      
      // Step 7: Send summary to Telegram
      if (options.chatId) {
        await this.sendWorkflowSummary(workflowResult, options.chatId);
      }
      
      log.workflowComplete('Social Media Workflow', workflowResult.stats);
      
      return {
        success: true,
        workflowId,
        ...workflowResult.stats,
        platforms: Object.keys(formattingResult.posts),
      };
      
    } catch (error) {
      log.workflowError('Social Media Workflow', error);
      
      // Send error notification
      if (options.chatId) {
        await this.telegram.sendErrorNotification(
          options.chatId,
          error,
          'Social Media Workflow'
        );
      }
      
      return {
        success: false,
        error: error.message,
        workflowId,
      };
    }
  }

  /**
   * Research phase
   */
  async researchPhase(options) {
    log.info('Starting research phase');
    
    const researchOptions = {
      sectors: options.sectors || config.content.sectors.slice(0, 3),
      focusAreas: options.focusAreas || config.content.focusAreas.slice(0, 3),
      limit: options.topicLimit || 10,
    };
    
    return await this.tavily.getTrendingTopics(researchOptions);
  }

  /**
   * Selection phase
   */
  async selectionPhase(topics, options) {
    log.info('Starting selection phase');
    
    const selectionOptions = {
      count: options.topicCount || 1,
      strategy: options.selectionStrategy || 'balanced',
      platforms: options.platforms || ['all'],
      preferences: options.preferences || {},
    };
    
    return await this.topicSelector.selectTopics(topics, selectionOptions);
  }

  /**
   * Generation phase
   */
  async generationPhase(topic, options) {
    log.info('Starting generation phase');
    
    const platforms = this.getPlatforms(options.platforms);
    const generatedContent = {};
    
    for (const platform of platforms) {
      const result = await this.groq.generateContent(topic, platform, {
        angle: options.angle,
        cta: options.cta,
      });
      
      if (result.success) {
        generatedContent[platform] = result.content;
      } else {
        log.warn(`Failed to generate content for ${platform}`);
      }
    }
    
    if (Object.keys(generatedContent).length === 0) {
      return {
        success: false,
        error: 'No content generated for any platform',
      };
    }
    
    return {
      success: true,
      content: generatedContent,
    };
  }

  /**
   * Formatting phase
   */
  async formattingPhase(content, options) {
    log.info('Starting formatting phase');
    
    const formattedPosts = {};
    
    for (const [platform, text] of Object.entries(content)) {
      const formatted = this.formatter.formatForPlatform(text, platform, {
        addEmoji: options.addEmoji !== false,
        cta: options.cta,
      });
      
      if (formatted && formatted.valid !== false) {
        formattedPosts[platform] = formatted;
      } else {
        log.warn(`Failed to format content for ${platform}`);
      }
    }
    
    if (Object.keys(formattedPosts).length === 0) {
      return {
        success: false,
        error: 'No content formatted successfully',
      };
    }
    
    return {
      success: true,
      posts: formattedPosts,
    };
  }

  /**
   * Publishing phase (auto mode)
   */
  async publishPhase(posts, options) {
    log.info('Starting publishing phase');
    
    const publishOptions = {
      mode: options.publishMode || 'parallel',
      delayBetween: options.delayBetween || 0,
    };
    
    // Convert formatted posts to publish format
    const postsToPublish = {};
    for (const [platform, post] of Object.entries(posts)) {
      postsToPublish[platform] = {
        content: post.content,
        hashtags: post.hashtags,
      };
    }
    
    const result = await this.postfast.publishToMultiple(postsToPublish, publishOptions);

    // Increment publish counters for statistics tracking
    if (result.stats?.successful > 0) {
      await this.incrementPublishCounters(result.stats.successful);
    }

    return result;
  }

  /**
   * Increment publish counters for today, this week, and this month
   */
  async incrementPublishCounters(count) {
    try {
      await Promise.all([
        StorageUtils.increment(this.storage, STORAGE_KEYS.POSTS_PUBLISHED_TODAY, count),
        StorageUtils.increment(this.storage, STORAGE_KEYS.POSTS_PUBLISHED_WEEK, count),
        StorageUtils.increment(this.storage, STORAGE_KEYS.POSTS_PUBLISHED_MONTH, count),
      ]);
    } catch (error) {
      log.warn('Failed to increment publish counters', error);
    }
  }

  /**
   * Approval phase
   */
  async approvalPhase(posts, options) {
    log.info('Starting approval phase');
    
    if (!options.chatId) {
      log.warn('No chat ID for approval, switching to draft mode');
      return this.draftPhase(posts, options);
    }
    
    const approvalRequests = [];
    
    for (const [platform, post] of Object.entries(posts)) {
      const postId = `${platform}_${Date.now()}`;
      
      // Send preview to Telegram
      await this.telegram.sendPostPreview(
        options.chatId,
        platform,
        post.content,
        postId
      );
      
      // Store for later approval
      approvalRequests.push({
        postId,
        platform,
        content: post.content,
        hashtags: post.hashtags,
      });
    }
    
    // Store pending approvals
    await this.storage.set(STORAGE_KEYS.PENDING_APPROVALS, approvalRequests);
    
    return {
      success: true,
      stats: {
        total: approvalRequests.length,
        pending: approvalRequests.length,
        successful: 0,
        failed: 0,
      },
      message: 'Posts sent for approval',
    };
  }

  /**
   * Draft phase
   */
  async draftPhase(posts, options) {
    log.info('Starting draft phase');
    
    const drafts = [];
    
    for (const [platform, post] of Object.entries(posts)) {
      const draft = {
        id: `draft_${platform}_${Date.now()}`,
        platform,
        content: post.content,
        hashtags: post.hashtags,
        createdAt: new Date().toISOString(),
      };
      
      drafts.push(draft);
    }
    
    // Store drafts
    await this.storage.set(STORAGE_KEYS.DRAFTS, drafts);
    
    // Send drafts to Telegram if chat ID provided
    if (options.chatId) {
      let message = '📝 *Drafts Created*\n\n';
      
      for (const draft of drafts) {
        message += `*${draft.platform}:*\n`;
        message += `${draft.content.substring(0, 200)}...\n\n`;
      }
      
      await this.telegram.sendMessage(options.chatId, message);
    }
    
    return {
      success: true,
      stats: {
        total: drafts.length,
        successful: drafts.length,
        failed: 0,
      },
      drafts,
    };
  }

  /**
   * Get platforms to use
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
    
    return ['linkedin']; // Default fallback
  }

  /**
   * Store workflow result
   */
  async storeWorkflowResult(result) {
    try {
      const key = `workflow_${result.workflowId}`;
      await this.storage.set(key, result);
      
      // Also update recent workflows list
      const recent = await this.storage.get(STORAGE_KEYS.RECENT_WORKFLOWS) || [];
      recent.unshift({
        workflowId: result.workflowId,
        timestamp: result.endTime,
        success: result.success,
        stats: result.stats,
      });

      // Keep only last 50 workflows
      await this.storage.set(STORAGE_KEYS.RECENT_WORKFLOWS, recent.slice(0, 50));
      
    } catch (error) {
      log.warn('Failed to store workflow result', error);
    }
  }

  /**
   * Send workflow summary to Telegram
   */
  async sendWorkflowSummary(result, chatId) {
    const report = {
      workflow: 'Social Media',
      success: result.success,
      stats: {
        'Topics Researched': result.stats.topicsResearched,
        'Posts Generated': result.stats.postsGenerated,
        'Posts Published': result.stats.postsPublished,
        'Duration': this.calculateDuration(result.startTime, result.endTime),
      },
    };
    
    if (!result.success && result.error) {
      report.error = result.error;
    }
    
    await this.telegram.sendStatusReport(chatId, report);
  }

  /**
   * Calculate duration
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const seconds = Math.floor((end - start) / 1000);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Execute scheduled workflow
   */
  async executeScheduled() {
    log.info('Executing scheduled workflow');
    
    // Get default Telegram chat ID for notifications
    const chatId = config.telegram.allowedUserIds[0]; // Use first allowed user
    
    return await this.execute({
      mode: config.modes.default,
      platforms: ['all'],
      chatId,
      scheduled: true,
    });
  }
}

export default SocialWorkflow;