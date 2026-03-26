/**
 * IvyLens Social Operator - Command Router
 * Phase 3: Routes commands to appropriate handlers
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import { sanitizeInput } from '../lib/validators.js';
import SocialWorkflow from '../workflows/social.js';
import SystemCommands from '../commands/system.js';
import ContentCommands from '../commands/content.js';
import StorageService, { STORAGE_KEYS } from '../services/storage.js';
import BusinessTaskAgent from './businessTaskAgent.js';

const log = logger.child('CommandRouter');

class CommandRouter {
  constructor() {
    this.socialWorkflow = new SocialWorkflow();
    this.systemCommands = new SystemCommands();
    this.contentCommands = new ContentCommands();
    this.storage = new StorageService();
    this.businessTaskAgent = new BusinessTaskAgent();
    
    // Command mapping
    this.commands = {
      // Social media commands
      'run': this.handleRun.bind(this),
      'schedule': this.handleSchedule.bind(this),
      'pause': this.handlePause.bind(this),
      'resume': this.handleResume.bind(this),
      
      // Content commands
      'ideas': this.handleIdeas.bind(this),
      'draft': this.handleDraft.bind(this),
      'preview': this.handlePreview.bind(this),
      
      // System commands
      'status': this.handleStatus.bind(this),
      'mode': this.handleMode.bind(this),
      'platforms': this.handlePlatforms.bind(this),
      'help': this.handleHelp.bind(this),
      'start': this.handleStart.bind(this),
      
      // Admin commands
      'test': this.handleTest.bind(this),
      'logs': this.handleLogs.bind(this),
      'tasks': this.handleTasks.bind(this),
      'research': this.handleResearch.bind(this),
    };
    
    // Callback handlers
    this.callbackHandlers = {
      'cmd_': this.handleCommandCallback.bind(this),
      'approve_': this.handleApprovalCallback.bind(this),
      'edit_': this.handleEditCallback.bind(this),
      'reject_': this.handleRejectCallback.bind(this),
    };
  }

  /**
   * Route command to appropriate handler
   */
  async route({ command, args, userId, chatId }) {
    try {
      log.info('Routing command', { command, args, userId });
      
      // Sanitize inputs
      const cleanCommand = sanitizeInput(command).toLowerCase();
      const cleanArgs = args ? args.map(arg => sanitizeInput(arg)) : [];
      
      // Check if command exists
      const handler = this.commands[cleanCommand];
      
      if (!handler) {
        return {
          success: false,
          error: `Unknown command: /${cleanCommand}. Type /help for available commands.`,
        };
      }
      
      // Execute command handler
      const result = await handler({
        args: cleanArgs,
        userId,
        chatId,
      });
      
      return result;
      
    } catch (error) {
      log.error('Command routing error', error);
      
      return {
        success: false,
        error: 'Failed to execute command. Please try again.',
      };
    }
  }

  /**
   * Route conversational message
   */
  async routeConversational({ text, userId, chatId }) {
    try {
      const cleanText = sanitizeInput(text);

      log.info('Processing conversational message', { userId, preview: cleanText.substring(0, 50) });

      // Check if we're awaiting an edit
      const awaitingEdit = await this.storage.get('awaiting_edit');
      if (awaitingEdit && awaitingEdit.chatId === chatId) {
        await this.storage.delete('awaiting_edit');
        const editResult = await this.contentCommands.editDraft(awaitingEdit.postId, cleanText);
        return {
          success: true,
          message: editResult.success
            ? '✅ Draft updated with your new content.'
            : `❌ Failed to update draft: ${editResult.error}`,
        };
      }

      // Analyze intent
      const intent = await this.analyzeIntent(cleanText);
      
      // Route based on intent
      switch (intent.category) {
        case 'social':
          return await this.handleSocialRequest(intent, chatId);
        
        case 'content':
          return await this.handleContentRequest(intent, chatId);
        
        case 'question':
          return await this.handleQuestion(intent, chatId);
        
        case 'task':
          return await this.handleTaskRequest(intent, chatId);
        
        default:
          return {
            success: true,
            message: "I understand you're trying to communicate, but I'm not sure what you need. Try:\n\n• Type /help for commands\n• Ask me to 'run social posts'\n• Request 'post ideas about X'\n• Ask 'what's the status?'",
          };
      }
      
    } catch (error) {
      log.error('Conversational routing error', error);
      
      return {
        success: false,
        message: 'Sorry, I had trouble understanding that. Please try rephrasing or use /help for commands.',
      };
    }
  }

  /**
   * Route callback query
   */
  async routeCallback({ data, userId, chatId, messageId }) {
    try {
      log.info('Routing callback', { data, userId });
      
      // Find matching handler based on prefix
      for (const [prefix, handler] of Object.entries(this.callbackHandlers)) {
        if (data.startsWith(prefix)) {
          return await handler({
            data: data.substring(prefix.length),
            fullData: data,
            userId,
            chatId,
            messageId,
          });
        }
      }
      
      return {
        notification: 'Unknown action',
        updateMessage: false,
      };
      
    } catch (error) {
      log.error('Callback routing error', error);
      
      return {
        notification: 'Error processing action',
        updateMessage: false,
      };
    }
  }

  /**
   * Analyze message intent
   */
  async analyzeIntent(text) {
    const lowerText = text.toLowerCase();
    
    // Social media keywords
    if (lowerText.includes('post') || lowerText.includes('social') || 
        lowerText.includes('publish') || lowerText.includes('linkedin') ||
        lowerText.includes('facebook') || lowerText.includes('instagram')) {
      return { category: 'social', action: 'request' };
    }
    
    // Content keywords
    if (lowerText.includes('idea') || lowerText.includes('draft') || 
        lowerText.includes('write') || lowerText.includes('create')) {
      return { category: 'content', action: 'generate' };
    }
    
    // Status/question keywords
    if (lowerText.includes('status') || lowerText.includes('what') || 
        lowerText.includes('show') || lowerText.includes('how')) {
      return { category: 'question', action: 'query' };
    }
    
    // Task keywords
    if (lowerText.includes('do') || lowerText.includes('run') || 
        lowerText.includes('execute') || lowerText.includes('start')) {
      return { category: 'task', action: 'execute' };
    }
    
    return { category: 'unknown', action: null };
  }

  // Command Handlers

  async handleRun({ args, userId, chatId }) {
    log.info('Running social workflow', { userId });
    
    const platforms = args.length > 0 ? args : ['all'];
    const result = await this.socialWorkflow.execute({
      platforms,
      mode: config.modes.default,
      userId,
      chatId,
    });
    
    if (result.success) {
      return {
        success: true,
        message: `✅ Social workflow completed!\n\nTopics researched: ${result.topicsFound}\nPosts generated: ${result.postsGenerated}\nPlatforms: ${result.platforms.join(', ')}`,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Workflow failed',
      };
    }
  }

  async handleSchedule({ userId, chatId }) {
    const schedule = await this.systemCommands.getSchedule();
    
    return {
      success: true,
      message: schedule,
    };
  }

  async handlePause({ userId, chatId }) {
    const result = await this.systemCommands.pauseAutomation();
    
    return {
      success: result.success,
      message: result.success ? '⏸️ Auto-posting paused' : 'Failed to pause automation',
    };
  }

  async handleResume({ userId, chatId }) {
    const result = await this.systemCommands.resumeAutomation();
    
    return {
      success: result.success,
      message: result.success ? '▶️ Auto-posting resumed' : 'Failed to resume automation',
    };
  }

  async handleIdeas({ args, userId, chatId }) {
    const topic = args.join(' ') || 'UK recruitment';
    const ideas = await this.contentCommands.generateIdeas(topic);
    
    return {
      success: true,
      message: ideas,
    };
  }

  async handleDraft({ args, userId, chatId }) {
    const topic = args.join(' ');
    
    if (!topic) {
      return {
        success: false,
        error: 'Please provide a topic. Example: /draft salary inflation in engineering',
      };
    }
    
    const draft = await this.contentCommands.createDraft(topic);
    
    return {
      success: true,
      message: draft,
    };
  }

  async handlePreview({ userId, chatId }) {
    const previews = await this.contentCommands.getScheduledPreviews();
    
    return {
      success: true,
      message: previews,
    };
  }

  async handleStatus({ userId, chatId }) {
    const status = await this.systemCommands.getSystemStatus();
    
    return {
      success: true,
      message: status,
    };
  }

  async handleMode({ args, userId, chatId }) {
    if (args.length === 0) {
      return {
        success: true,
        message: `Current mode: *${config.modes.default}*\n\nAvailable modes:\n• auto - Fully automatic\n• draft - Create drafts only\n• approval - Require approval`,
      };
    }
    
    const newMode = args[0].toLowerCase();
    const result = await this.systemCommands.setMode(newMode);
    
    return result;
  }

  async handlePlatforms({ userId, chatId }) {
    const platforms = await this.systemCommands.getPlatformStatus();
    
    return {
      success: true,
      message: platforms,
    };
  }

  async handleHelp({ userId, chatId }) {
    const helpText = `🤖 *IvyLens Social Operator*

*Social Media Commands:*
/run — Run the full social media workflow now
/run linkedin — Run for a specific platform
/schedule — View the posting schedule
/pause — Pause automatic posting
/resume — Resume automatic posting

*Content Commands:*
/ideas [topic] — Generate post ideas
/draft [topic] — Create a draft post
/preview — Preview scheduled/draft posts

*System Commands:*
/status — View system status
/mode — View or change operating mode
/mode auto|draft|approval — Set mode
/platforms — View platform status
/logs — View recent activity
/test — Run a system test

*Business Tasks:*
/tasks — View all business capabilities
/research [topic] — Research a specific topic

*Conversational:*
You can also send plain text requests like:
• "Run today's LinkedIn post"
• "Give me 5 ideas about salary inflation"
• "What posted today?"

Type any command to get started.`;

    return {
      success: true,
      message: helpText,
      options: {
        parse_mode: 'Markdown',
      },
    };
  }

  async handleStart({ userId, chatId }) {
    return {
      success: true,
      message: "Welcome to IvyLens Social Operator! 🚀\n\nI'm your AI-powered business assistant, ready to automate your social media and handle business tasks.\n\nType /help to see available commands.",
    };
  }

  async handleTest({ userId, chatId }) {
    return {
      success: true,
      message: '🧪 Test mode activated. All systems operational.',
    };
  }

  async handleLogs({ args, userId, chatId }) {
    const logs = await this.systemCommands.getRecentLogs(args[0] || 10);
    
    return {
      success: true,
      message: logs,
    };
  }

  async handleTasks({ userId, chatId }) {
    const message = this.businessTaskAgent.getCapabilitiesMessage();
    return {
      success: true,
      message,
    };
  }

  async handleResearch({ args, userId, chatId }) {
    const topic = args.join(' ');

    if (!topic) {
      return {
        success: false,
        error: 'Please provide a topic. Example: /research salary inflation UK engineering',
      };
    }

    const result = await this.businessTaskAgent.execute('research.topic', { topic });

    return {
      success: result.success,
      message: result.message,
    };
  }

  // Callback Handlers

  async handleCommandCallback({ data, userId, chatId }) {
    // Map callback data to command
    const commandMap = {
      'run': 'run',
      'pause': 'pause',
      'ideas': 'ideas',
      'status': 'status',
      'settings': 'mode',
    };
    
    const command = commandMap[data];
    
    if (command) {
      const result = await this.route({
        command,
        args: [],
        userId,
        chatId,
      });
      
      return {
        notification: 'Command executed',
        updateMessage: true,
        message: result.message || result.error,
      };
    }
    
    return {
      notification: 'Unknown command',
      updateMessage: false,
    };
  }

  async handleApprovalCallback({ data, userId, chatId }) {
    const postId = data;

    try {
      const result = await this.contentCommands.approvePost(postId);

      if (result.success) {
        return {
          notification: 'Post approved',
          updateMessage: true,
          message: `✅ ${result.message}`,
        };
      } else {
        return {
          notification: 'Approval failed',
          updateMessage: true,
          message: `❌ Failed to approve: ${result.error}`,
        };
      }
    } catch (error) {
      log.error('Approval callback error', error);
      return {
        notification: 'Error',
        updateMessage: true,
        message: '❌ Failed to process approval. Please try again.',
      };
    }
  }

  async handleEditCallback({ data, userId, chatId }) {
    const postId = data;

    try {
      // Store the post ID awaiting edit so next message is treated as the edited content
      await this.storage.set('awaiting_edit', {
        postId,
        chatId,
        userId,
        requestedAt: new Date().toISOString(),
      });

      return {
        notification: 'Edit mode activated',
        updateMessage: true,
        message: `✏️ *Edit Mode*\n\nSend the edited version of the post now.\nThe next message you send will replace the current draft.\n\nPost ID: \`${postId}\``,
      };
    } catch (error) {
      log.error('Edit callback error', error);
      return {
        notification: 'Error',
        updateMessage: true,
        message: '❌ Failed to enter edit mode. Please try again.',
      };
    }
  }

  async handleRejectCallback({ data, userId, chatId }) {
    const postId = data;

    try {
      const result = await this.contentCommands.rejectPost(postId);

      if (result.success) {
        return {
          notification: 'Post rejected',
          updateMessage: true,
          message: '❌ Post rejected and removed from the queue.',
        };
      } else {
        return {
          notification: 'Rejection failed',
          updateMessage: true,
          message: `❌ Failed to reject: ${result.error}`,
        };
      }
    } catch (error) {
      log.error('Reject callback error', error);
      return {
        notification: 'Error',
        updateMessage: true,
        message: '❌ Failed to process rejection. Please try again.',
      };
    }
  }

  // Conversational Handlers

  async handleSocialRequest(intent, chatId) {
    return {
      success: true,
      message: "I'll help you with social media. You can:\n\n• Say 'run social posts now'\n• Ask for 'post ideas about [topic]'\n• Request 'draft a post about [topic]'\n\nWhat would you like to do?",
    };
  }

  async handleContentRequest(intent, chatId) {
    return {
      success: true,
      message: "I can help create content. Tell me:\n\n• What topic you want to post about\n• Which platforms to target\n• Any specific angle or message\n\nExample: 'Create a post about engineering salary trends for LinkedIn'",
    };
  }

  async handleQuestion(intent, chatId) {
    return {
      success: true,
      message: "I can provide information about:\n\n• System status (/status)\n• Posting schedule (/schedule)\n• Recent activity (/logs)\n• Current settings (/mode)\n\nWhat would you like to know?",
    };
  }

  async handleTaskRequest(intent, chatId) {
    return {
      success: true,
      message: "I can execute these tasks:\n\n*Social:*\n• /run — Run social media workflow\n• /ideas — Generate content ideas\n• /draft — Create draft posts\n• /pause / /resume — Control automation\n\n*Business:*\n• /tasks — View all capabilities\n• /research [topic] — Research a topic\n\nWhich task should I perform?",
    };
  }
}

export default CommandRouter;