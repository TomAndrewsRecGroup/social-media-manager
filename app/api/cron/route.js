/**
 * IvyLens Social Operator - Cron Route (Next.js App Router)
 * Delegates to the main cron handler for Vercel cron job execution
 */

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const job = searchParams.get('job') || 'social';
    const secret = searchParams.get('secret') || request.headers.get('x-cron-secret');

    // Dynamically import the cron handler modules
    const config = (await import('../../../src/config/index.js')).default;
    const SocialWorkflow = (await import('../../../src/workflows/social.js')).default;
    const TelegramService = (await import('../../../src/services/telegram.js')).default;
    const StorageService = (await import('../../../src/services/storage.js')).default;

    // Validate cron secret
    if (secret !== config.app.cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storage = new StorageService();
    const telegram = new TelegramService();

    // Check if automation is paused
    const isPaused = await storage.get('automation_paused');
    if (isPaused && job !== 'cleanup') {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Automation paused',
        job,
      });
    }

    let result;

    switch (job) {
      case 'social':
      case 'morning': {
        const workflow = new SocialWorkflow();
        const mode = job === 'morning' ? 'draft' : config.modes.default;
        result = await workflow.execute({
          mode,
          platforms: ['all'],
          chatId: config.telegram.allowedUserIds[0],
          scheduled: true,
        });
        await storage.set(`last_${job}_run`, {
          timestamp: new Date().toISOString(),
          success: result.success,
          stats: result.stats || {},
        });
        break;
      }

      case 'afternoon': {
        const drafts = await storage.get('drafts');
        if (!drafts || drafts.length === 0) {
          result = { success: true, message: 'No drafts available' };
        } else {
          const PostFastService = (await import('../../../src/services/postfast.js')).default;
          const postfast = new PostFastService();
          const posts = {};
          for (const draft of drafts) {
            posts[draft.platform] = {
              content: draft.content,
              hashtags: draft.hashtags,
            };
          }
          result = await postfast.publishToMultiple(posts);
          if (result.success) {
            await storage.set('drafts', []);
          }
          const chatId = config.telegram.allowedUserIds[0];
          if (chatId) {
            await telegram.sendStatusReport(chatId, {
              workflow: 'Afternoon Publishing',
              success: result.success,
              stats: result.stats,
            });
          }
        }
        break;
      }

      case 'cleanup': {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        let cleaned = 0;
        const workflows = await storage.get('recent_workflows') || [];
        const recentWorkflows = workflows.filter(w =>
          new Date(w.timestamp).getTime() > sevenDaysAgo
        );
        if (recentWorkflows.length < workflows.length) {
          await storage.set('recent_workflows', recentWorkflows);
          cleaned += workflows.length - recentWorkflows.length;
        }
        const topics = await storage.get('recent_topics') || [];
        const recentTopics = topics.filter(t =>
          new Date(t.selectedAt).getTime() > sevenDaysAgo
        );
        if (recentTopics.length < topics.length) {
          await storage.set('recent_topics', recentTopics);
          cleaned += topics.length - recentTopics.length;
        }
        result = { success: true, cleaned };
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown job type', job }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      job,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Cron route error:', error);

    try {
      const config = (await import('../../../src/config/index.js')).default;
      const TelegramService = (await import('../../../src/services/telegram.js')).default;
      const telegram = new TelegramService();
      const chatId = config.telegram.allowedUserIds[0];
      if (chatId) {
        await telegram.sendErrorNotification(chatId, error, 'Cron Job Failed');
      }
    } catch (_) {
      // Notification failed silently
    }

    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
