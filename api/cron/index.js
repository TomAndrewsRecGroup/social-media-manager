/**
 * IvyLens Social Operator - Cron Handler
 * Phase 10: Vercel Cron Scheduling
 */

import config from '../../src/config/index.js';
import logger from '../../src/lib/logger.js';
import { validateCronSecret } from '../../src/lib/validators.js';
import SocialWorkflow from '../../src/workflows/social.js';
import TelegramService from '../../src/services/telegram.js';
import StorageService from '../../src/services/storage.js';

const log = logger.child('CronHandler');
const telegram = new TelegramService();
const storage = new StorageService();

/**
 * Main cron handler
 */
export default async function handler(req, res) {
  const { method, headers, query } = req;
  
  // Only accept GET or POST requests
  if (method !== 'GET' && method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Validate cron secret
  const secret = headers['x-cron-secret'] || query.secret;
  if (!validateCronSecret(secret)) {
    log.warn('Invalid cron secret attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Determine which cron job to run
  const job = query.job || 'social';
  
  log.info('Cron job triggered', { job });
  
  try {
    let result;
    
    switch (job) {
      case 'social':
        result = await runSocialWorkflow();
        break;
        
      case 'morning':
        result = await runMorningWorkflow();
        break;
        
      case 'afternoon':
        result = await runAfternoonWorkflow();
        break;
        
      case 'research':
        result = await runResearchOnly();
        break;
        
      case 'cleanup':
        result = await runCleanup();
        break;
        
      default:
        return res.status(400).json({ 
          error: 'Unknown job type',
          job,
        });
    }
    
    log.success('Cron job completed', { job, result });
    
    return res.status(200).json({
      success: true,
      job,
      result,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    log.error('Cron job failed', error);
    
    // Notify via Telegram
    const chatId = config.telegram.allowedUserIds[0];
    if (chatId) {
      await telegram.sendErrorNotification(
        chatId,
        error,
        `Cron Job Failed: ${job}`
      ).catch(err => log.error('Failed to send error notification', err));
    }
    
    return res.status(500).json({
      success: false,
      error: error.message,
      job,
    });
  }
}

/**
 * Run full social media workflow
 */
async function runSocialWorkflow() {
  log.workflowStart('Scheduled Social Workflow');
  
  // Check if automation is paused
  const isPaused = await storage.get('automation_paused');
  if (isPaused) {
    log.info('Automation is paused, skipping workflow');
    return {
      skipped: true,
      reason: 'Automation paused',
    };
  }
  
  const workflow = new SocialWorkflow();
  const result = await workflow.executeScheduled();
  
  // Store last run time
  await storage.set('last_social_run', {
    timestamp: new Date().toISOString(),
    success: result.success,
    stats: result.stats,
  });
  
  return result;
}

/**
 * Run morning workflow (research + draft)
 */
async function runMorningWorkflow() {
  log.workflowStart('Morning Workflow');
  
  const isPaused = await storage.get('automation_paused');
  if (isPaused) {
    return {
      skipped: true,
      reason: 'Automation paused',
    };
  }
  
  const workflow = new SocialWorkflow();
  
  // Run in draft mode for morning
  const result = await workflow.execute({
    mode: 'draft',
    platforms: ['all'],
    chatId: config.telegram.allowedUserIds[0],
    scheduled: true,
  });
  
  // Store morning run
  await storage.set('last_morning_run', {
    timestamp: new Date().toISOString(),
    success: result.success,
    drafts: result.drafts?.length || 0,
  });
  
  return result;
}

/**
 * Run afternoon workflow (publish from drafts)
 */
async function runAfternoonWorkflow() {
  log.workflowStart('Afternoon Workflow');
  
  const isPaused = await storage.get('automation_paused');
  if (isPaused) {
    return {
      skipped: true,
      reason: 'Automation paused',
    };
  }
  
  // Get morning drafts
  const drafts = await storage.get('drafts');
  
  if (!drafts || drafts.length === 0) {
    log.info('No drafts to publish');
    return {
      success: true,
      message: 'No drafts available',
    };
  }
  
  // Publish drafts
  const PostFastService = (await import('../../src/services/postfast.js')).default;
  const postfast = new PostFastService();
  
  const posts = {};
  for (const draft of drafts) {
    posts[draft.platform] = {
      content: draft.content,
      hashtags: draft.hashtags,
    };
  }
  
  const result = await postfast.publishToMultiple(posts);
  
  // Clear published drafts
  if (result.success) {
    await storage.set('drafts', []);
  }
  
  // Notify via Telegram
  const chatId = config.telegram.allowedUserIds[0];
  if (chatId) {
    await telegram.sendStatusReport(chatId, {
      workflow: 'Afternoon Publishing',
      success: result.success,
      stats: result.stats,
    });
  }
  
  return result;
}

/**
 * Run research only (no publishing)
 */
async function runResearchOnly() {
  log.workflowStart('Research Only');
  
  const TavilyService = (await import('../../src/services/tavily.js')).default;
  const tavily = new TavilyService();
  
  const result = await tavily.getTrendingTopics({
    limit: 20,
  });
  
  if (result.success) {
    // Store research results
    await storage.set('latest_research', {
      timestamp: new Date().toISOString(),
      topics: result.topics,
      stats: result.stats,
    });
    
    // Send summary to Telegram
    const chatId = config.telegram.allowedUserIds[0];
    if (chatId) {
      let message = '🔍 *Research Complete*\n\n';
      message += `Topics found: ${result.stats.totalResearched}\n`;
      message += `Topics selected: ${result.stats.topicsSelected}\n\n`;
      message += '*Top Topics:*\n';
      
      for (const topic of result.topics.slice(0, 5)) {
        message += `• ${topic.title}\n`;
      }
      
      await telegram.sendMessage(chatId, message);
    }
  }
  
  return result;
}

/**
 * Run cleanup tasks
 */
async function runCleanup() {
  log.workflowStart('Cleanup');
  
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  let cleaned = 0;
  
  // Clean old workflows
  const workflows = await storage.get('recent_workflows') || [];
  const recentWorkflows = workflows.filter(w => 
    new Date(w.timestamp).getTime() > sevenDaysAgo
  );
  
  if (recentWorkflows.length < workflows.length) {
    await storage.set('recent_workflows', recentWorkflows);
    cleaned += workflows.length - recentWorkflows.length;
  }
  
  // Clean old topics
  const topics = await storage.get('recent_topics') || [];
  const recentTopics = topics.filter(t => 
    new Date(t.selectedAt).getTime() > sevenDaysAgo
  );
  
  if (recentTopics.length < topics.length) {
    await storage.set('recent_topics', recentTopics);
    cleaned += topics.length - recentTopics.length;
  }
  
  // Clean old logs (if stored)
  // This would depend on your logging implementation
  
  log.info('Cleanup complete', { itemsCleaned: cleaned });
  
  return {
    success: true,
    cleaned,
  };
}

/**
 * Vercel cron configuration
 * Add this to vercel.json:
 * 
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron?job=morning&secret=your-secret",
 *       "schedule": "0 7 * * *"
 *     },
 *     {
 *       "path": "/api/cron?job=afternoon&secret=your-secret",
 *       "schedule": "0 14 * * *"
 *     },
 *     {
 *       "path": "/api/cron?job=cleanup&secret=your-secret",
 *       "schedule": "0 3 * * 0"
 *     }
 *   ]
 * }
 */