/**
 * IvyLens Social Operator - Telegram Service
 * Handles all Telegram Bot API interactions
 */

import axios from 'axios';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const log = logger.child('TelegramService');

class TelegramService {
  constructor() {
    this.token = config.telegram.botToken;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.system.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make API request to Telegram
   */
  async request(method, params = {}) {
    try {
      log.apiCall('Telegram', method, 'POST', params);
      
      const response = await this.client.post(`/${method}`, params);
      
      log.apiResponse('Telegram', response.status, response.data);
      
      if (!response.data.ok) {
        throw new Error(response.data.description || 'Telegram API error');
      }
      
      return {
        success: true,
        data: response.data.result,
      };
    } catch (error) {
      log.error(`Telegram API error: ${method}`, error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a message
   */
  async sendMessage(chatId, text, options = {}) {
    const params = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'Markdown',
      disable_web_page_preview: options.disable_web_page_preview || true,
      ...options,
    };
    
    return this.request('sendMessage', params);
  }

  /**
   * Send a message with inline keyboard
   */
  async sendMessageWithKeyboard(chatId, text, keyboard, options = {}) {
    const params = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
      ...options,
    };
    
    return this.request('sendMessage', params);
  }

  /**
   * Edit a message
   */
  async editMessage(chatId, messageId, text, options = {}) {
    const params = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode || 'Markdown',
      ...options,
    };
    
    return this.request('editMessageText', params);
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    const params = {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    };
    
    return this.request('answerCallbackQuery', params);
  }

  /**
   * Delete a message
   */
  async deleteMessage(chatId, messageId) {
    const params = {
      chat_id: chatId,
      message_id: messageId,
    };
    
    return this.request('deleteMessage', params);
  }

  /**
   * Send typing action
   */
  async sendTypingAction(chatId) {
    const params = {
      chat_id: chatId,
      action: 'typing',
    };
    
    return this.request('sendChatAction', params);
  }

  /**
   * Set webhook
   */
  async setWebhook(url, options = {}) {
    const params = {
      url,
      ...options,
    };
    
    return this.request('setWebhook', params);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook() {
    return this.request('deleteWebhook');
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo() {
    return this.request('getWebhookInfo');
  }

  /**
   * Get bot info
   */
  async getMe() {
    return this.request('getMe');
  }

  /**
   * Send a formatted status report
   */
  async sendStatusReport(chatId, report) {
    const { workflow, success, stats, error } = report;
    
    let message = `📊 *${workflow} Report*\n\n`;
    
    if (success) {
      message += '✅ *Status:* Completed Successfully\n\n';
      
      if (stats) {
        message += '*Statistics:*\n';
        for (const [key, value] of Object.entries(stats)) {
          message += `• ${key}: ${value}\n`;
        }
      }
    } else {
      message += '❌ *Status:* Failed\n\n';
      if (error) {
        message += `*Error:* ${error}\n`;
      }
    }
    
    message += `\n_Generated at ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}_`;
    
    return this.sendMessage(chatId, message);
  }

  /**
   * Send post preview with approval buttons
   */
  async sendPostPreview(chatId, platform, content, postId) {
    const message = `📝 *Post Preview - ${platform}*\n\n${content}\n\n_Do you want to publish this post?_`;
    
    const keyboard = [
      [
        { text: '✅ Publish', callback_data: `approve_${postId}` },
        { text: '✏️ Edit', callback_data: `edit_${postId}` },
        { text: '❌ Reject', callback_data: `reject_${postId}` },
      ],
    ];
    
    return this.sendMessageWithKeyboard(chatId, message, keyboard);
  }

  /**
   * Send command menu
   */
  async sendCommandMenu(chatId) {
    const message = `
🤖 *IvyLens Social Operator*

Available commands:

📱 *Social Media*
/run - Run social media workflow now
/schedule - View posting schedule
/pause - Pause auto-posting
/resume - Resume auto-posting
/status - System status

✍️ *Content*
/ideas - Generate post ideas
/draft - Create draft post
/preview - Preview scheduled posts

⚙️ *Settings*
/mode - Change operating mode
/platforms - Configure platforms
/help - Show this menu

_Select a command or type your request_
    `.trim();
    
    const keyboard = [
      [
        { text: '▶️ Run Now', callback_data: 'cmd_run' },
        { text: '⏸️ Pause', callback_data: 'cmd_pause' },
      ],
      [
        { text: '💡 Ideas', callback_data: 'cmd_ideas' },
        { text: '📊 Status', callback_data: 'cmd_status' },
      ],
      [
        { text: '⚙️ Settings', callback_data: 'cmd_settings' },
      ],
    ];
    
    return this.sendMessageWithKeyboard(chatId, message, keyboard);
  }

  /**
   * Send error notification
   */
  async sendErrorNotification(chatId, error, context = '') {
    const message = `
⚠️ *Error Notification*

${context ? `*Context:* ${context}\n` : ''}
*Error:* ${error.message || error}

_Please check the logs for more details_
    `.trim();
    
    return this.sendMessage(chatId, message);
  }

  /**
   * Send success notification
   */
  async sendSuccessNotification(chatId, action, details = '') {
    const message = `
✅ *Success*

*Action:* ${action}
${details ? `*Details:* ${details}` : ''}

_Operation completed successfully_
    `.trim();
    
    return this.sendMessage(chatId, message);
  }
}

export default TelegramService;