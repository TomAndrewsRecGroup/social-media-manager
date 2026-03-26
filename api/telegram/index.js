/**
 * IvyLens Social Operator - Telegram Webhook Handler
 * Phase 2: Telegram Interface
 */

import config from '../../src/config/index.js';
import logger from '../../src/lib/logger.js';
import { 
  telegramMessageSchema, 
  isAuthorizedUser, 
  parseCommand,
  validateWebhookSignature 
} from '../../src/lib/validators.js';
import TelegramService from '../../src/services/telegram.js';
import CommandRouter from '../../src/agents/commandRouter.js';

const log = logger.child('TelegramWebhook');
const telegram = new TelegramService();
const commandRouter = new CommandRouter();

/**
 * Telegram webhook handler
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Validate webhook signature if configured
    const signature = req.headers['x-telegram-bot-api-secret-token'];
    if (!validateWebhookSignature(signature, req.body)) {
      log.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Parse and validate the update
    const update = req.body;
    
    // Handle different update types
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.edited_message) {
      // Ignore edited messages for now
      log.debug('Ignoring edited message');
    }
    
    // Always return 200 to Telegram
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    log.error('Webhook handler error', error);
    
    // Still return 200 to prevent Telegram from retrying
    return res.status(200).json({ ok: true });
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(message) {
  try {
    // Validate message structure
    const validatedMessage = telegramMessageSchema.parse(message);
    
    const userId = validatedMessage.from.id;
    const chatId = validatedMessage.chat.id;
    const text = validatedMessage.text;
    
    // Check if user is authorized
    if (!isAuthorizedUser(userId)) {
      log.warn('Unauthorized user attempted access', { userId });
      await telegram.sendMessage(
        chatId,
        '⛔ Unauthorized. This bot is private.'
      );
      return;
    }
    
    // Log the command
    log.telegramCommand(userId, text);
    
    // Handle empty messages
    if (!text) {
      await telegram.sendMessage(
        chatId,
        'Please send a text command. Type /help for available commands.'
      );
      return;
    }
    
    // Parse command if it starts with /
    const command = parseCommand(text);
    
    if (command) {
      // Route command to appropriate handler
      const result = await commandRouter.route({
        command: command.command,
        args: command.args,
        userId,
        chatId,
      });
      
      // Send response
      if (result.success) {
        await telegram.sendMessage(chatId, result.message, result.options);
      } else {
        await telegram.sendMessage(
          chatId,
          `❌ ${result.error || 'Command failed'}`,
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      // Handle non-command messages (conversational)
      const result = await commandRouter.routeConversational({
        text,
        userId,
        chatId,
      });
      
      await telegram.sendMessage(chatId, result.message, result.options);
    }
    
  } catch (error) {
    log.error('Message handling error', error);
    
    // Try to send error message to user
    if (message.chat?.id) {
      await telegram.sendMessage(
        message.chat.id,
        '❌ An error occurred processing your message. Please try again.'
      ).catch(err => log.error('Failed to send error message', err));
    }
  }
}

/**
 * Handle callback queries (button presses)
 */
async function handleCallbackQuery(callbackQuery) {
  try {
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;
    
    // Check authorization
    if (!isAuthorizedUser(userId)) {
      await telegram.answerCallbackQuery(
        callbackQuery.id,
        'Unauthorized',
        true
      );
      return;
    }
    
    log.info('Callback query received', { userId, data });
    
    // Route callback to appropriate handler
    const result = await commandRouter.routeCallback({
      data,
      userId,
      chatId,
      messageId,
    });
    
    // Answer the callback query
    await telegram.answerCallbackQuery(
      callbackQuery.id,
      result.notification
    );
    
    // Update message if needed
    if (result.updateMessage) {
      await telegram.editMessage(
        chatId,
        messageId,
        result.message,
        result.options
      );
    }
    
  } catch (error) {
    log.error('Callback query handling error', error);
    
    if (callbackQuery.id) {
      await telegram.answerCallbackQuery(
        callbackQuery.id,
        'Error processing action',
        true
      ).catch(err => log.error('Failed to answer callback', err));
    }
  }
}

/**
 * Set up webhook (called during deployment)
 */
export async function setupWebhook() {
  try {
    const webhookUrl = `${config.app.url}/api/telegram`;
    
    const result = await telegram.setWebhook(webhookUrl, {
      secret_token: config.telegram.webhookSecret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    
    if (result.success) {
      log.success('Webhook configured', { url: webhookUrl });
    } else {
      log.error('Failed to set webhook', result);
    }
    
    return result;
  } catch (error) {
    log.error('Webhook setup error', error);
    throw error;
  }
}