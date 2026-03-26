/**
 * IvyLens Social Operator - Validators Module
 * Input validation and sanitization utilities
 */

import { z } from 'zod';
import config from '../config/index.js';

/**
 * Telegram message validation
 */
export const telegramMessageSchema = z.object({
  message_id: z.number(),
  from: z.object({
    id: z.number(),
    is_bot: z.boolean(),
    first_name: z.string(),
    last_name: z.string().optional(),
    username: z.string().optional(),
  }),
  chat: z.object({
    id: z.number(),
    type: z.string(),
  }),
  date: z.number(),
  text: z.string().optional(),
});

/**
 * Command validation
 */
export const commandSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  userId: z.number(),
});

/**
 * Research topic validation
 */
export const researchTopicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  source: z.string().url().optional(),
  relevanceScore: z.number().min(0).max(100),
  freshness: z.enum(['breaking', 'recent', 'evergreen']),
  sector: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

/**
 * Generated content validation
 */
export const generatedContentSchema = z.object({
  platform: z.enum(['linkedin', 'facebook', 'instagram', 'x']),
  content: z.string().min(1),
  hashtags: z.array(z.string()).optional(),
  mediaUrl: z.string().url().optional(),
  scheduledTime: z.string().datetime().optional(),
});

/**
 * Workflow result validation
 */
export const workflowResultSchema = z.object({
  success: z.boolean(),
  workflow: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  results: z.record(z.any()).optional(),
  error: z.string().optional(),
});

/**
 * Validate Telegram user authorization
 */
export function isAuthorizedUser(userId) {
  const userIdStr = userId.toString();
  return config.telegram.allowedUserIds.includes(userIdStr);
}

/**
 * Validate platform name
 */
export function isValidPlatform(platform) {
  return ['linkedin', 'facebook', 'instagram', 'x'].includes(platform.toLowerCase());
}

/**
 * Validate content length for platform
 */
export function validateContentLength(content, platform) {
  const platformConfig = config.content.platforms[platform.toLowerCase()];
  if (!platformConfig) {
    throw new Error(`Invalid platform: ${platform}`);
  }
  
  if (content.length > platformConfig.maxLength) {
    return {
      valid: false,
      error: `Content exceeds maximum length for ${platform} (${content.length}/${platformConfig.maxLength})`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate hashtag count for platform
 */
export function validateHashtags(hashtags, platform) {
  const platformConfig = config.content.platforms[platform.toLowerCase()];
  if (!platformConfig) {
    throw new Error(`Invalid platform: ${platform}`);
  }
  
  if (hashtags.length > platformConfig.hashtagLimit) {
    return {
      valid: false,
      error: `Too many hashtags for ${platform} (${hashtags.length}/${platformConfig.hashtagLimit})`,
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove any potential script tags or HTML
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Parse command from message text
 */
export function parseCommand(text) {
  if (!text || !text.startsWith('/')) {
    return null;
  }
  
  const parts = text.split(' ');
  const command = parts[0].substring(1).toLowerCase(); // Remove '/' and lowercase
  const args = parts.slice(1);
  
  return {
    command,
    args: args.length > 0 ? args : undefined,
  };
}

/**
 * Validate cron secret
 */
export function validateCronSecret(secret) {
  return secret === config.app.cronSecret;
}

/**
 * Validate webhook signature
 * Telegram sends the secret_token as the X-Telegram-Bot-Api-Secret-Token header.
 * We compare it against the configured webhook secret.
 */
export function validateWebhookSignature(signature, body) {
  if (!config.telegram.webhookSecret) {
    return true; // Skip validation if no secret configured
  }

  if (!signature) {
    return false; // Secret is configured but header is missing
  }

  // Telegram uses a simple secret token comparison (not HMAC)
  // The secret_token we set via setWebhook is sent back as-is in the header
  return signature === config.telegram.webhookSecret;
}

/**
 * Validate operating mode
 */
export function isValidMode(mode) {
  return ['auto', 'draft', 'approval'].includes(mode);
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTime(time) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Validate research parameters
 */
export const researchParamsSchema = z.object({
  sectors: z.array(z.string()).optional(),
  focusAreas: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(50).optional(),
  timeframe: z.enum(['today', 'week', 'month']).optional(),
});

/**
 * Validate publish parameters
 */
export const publishParamsSchema = z.object({
  platforms: z.array(z.enum(['linkedin', 'facebook', 'instagram', 'x'])),
  content: z.string().min(1),
  scheduledTime: z.string().datetime().optional(),
  mode: z.enum(['auto', 'draft', 'approval']).optional(),
});

export default {
  telegramMessageSchema,
  commandSchema,
  researchTopicSchema,
  generatedContentSchema,
  workflowResultSchema,
  researchParamsSchema,
  publishParamsSchema,
  isAuthorizedUser,
  isValidPlatform,
  validateContentLength,
  validateHashtags,
  sanitizeInput,
  parseCommand,
  validateCronSecret,
  validateWebhookSignature,
  isValidMode,
  isValidTime,
};