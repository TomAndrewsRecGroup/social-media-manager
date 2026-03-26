/**
 * IvyLens Social Operator - Storage Service
 * Phase 11: Logging and Persistence using Vercel KV or fallback
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';

const log = logger.child('StorageService');

/**
 * Abstract storage interface
 */
class StorageService {
  constructor() {
    // Determine which storage backend to use
    if (config.database.kv.url && config.database.kv.restApiToken) {
      this.backend = new VercelKVStorage();
    } else {
      this.backend = new InMemoryStorage();
      log.warn('Using in-memory storage - data will not persist between deployments');
    }
  }

  async get(key) {
    return this.backend.get(key);
  }

  async set(key, value, ttl = null) {
    return this.backend.set(key, value, ttl);
  }

  async delete(key) {
    return this.backend.delete(key);
  }

  async exists(key) {
    return this.backend.exists(key);
  }

  async keys(pattern = '*') {
    return this.backend.keys(pattern);
  }

  async clear() {
    return this.backend.clear();
  }
}

/**
 * Vercel KV Storage Backend
 */
class VercelKVStorage {
  constructor() {
    this.initializeKV();
  }

  async initializeKV() {
    try {
      const { kv } = await import('@vercel/kv');
      this.kv = kv;
      log.info('Vercel KV storage initialized');
    } catch (error) {
      log.error('Failed to initialize Vercel KV', error);
      throw error;
    }
  }

  async get(key) {
    try {
      const value = await this.kv.get(key);
      return value;
    } catch (error) {
      log.error(`Storage get error for key: ${key}`, error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const options = ttl ? { ex: ttl } : undefined;
      await this.kv.set(key, value, options);
      return true;
    } catch (error) {
      log.error(`Storage set error for key: ${key}`, error);
      return false;
    }
  }

  async delete(key) {
    try {
      await this.kv.del(key);
      return true;
    } catch (error) {
      log.error(`Storage delete error for key: ${key}`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.kv.exists(key);
      return result === 1;
    } catch (error) {
      log.error(`Storage exists error for key: ${key}`, error);
      return false;
    }
  }

  async keys(pattern = '*') {
    try {
      const keys = await this.kv.keys(pattern);
      return keys;
    } catch (error) {
      log.error('Storage keys error', error);
      return [];
    }
  }

  async clear() {
    try {
      const keys = await this.keys();
      for (const key of keys) {
        await this.delete(key);
      }
      return true;
    } catch (error) {
      log.error('Storage clear error', error);
      return false;
    }
  }
}

/**
 * In-Memory Storage Backend (Fallback)
 */
class InMemoryStorage {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    // Check if key has expired
    if (this.ttls.has(key)) {
      const expiry = this.ttls.get(key);
      if (Date.now() > expiry) {
        this.store.delete(key);
        this.ttls.delete(key);
        return null;
      }
    }
    
    const value = this.store.get(key);
    return value !== undefined ? value : null;
  }

  async set(key, value, ttl = null) {
    this.store.set(key, value);
    
    if (ttl) {
      const expiry = Date.now() + (ttl * 1000);
      this.ttls.set(key, expiry);
    } else {
      this.ttls.delete(key);
    }
    
    return true;
  }

  async delete(key) {
    this.store.delete(key);
    this.ttls.delete(key);
    return true;
  }

  async exists(key) {
    if (this.ttls.has(key)) {
      const expiry = this.ttls.get(key);
      if (Date.now() > expiry) {
        this.store.delete(key);
        this.ttls.delete(key);
        return false;
      }
    }
    
    return this.store.has(key);
  }

  async keys(pattern = '*') {
    const allKeys = Array.from(this.store.keys());
    
    if (pattern === '*') {
      return allKeys;
    }
    
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async clear() {
    this.store.clear();
    this.ttls.clear();
    return true;
  }
}

/**
 * Storage utilities
 */
export class StorageUtils {
  /**
   * Get with default value
   */
  static async getWithDefault(storage, key, defaultValue) {
    const value = await storage.get(key);
    return value !== null ? value : defaultValue;
  }

  /**
   * Increment counter
   */
  static async increment(storage, key, amount = 1) {
    const current = await storage.get(key) || 0;
    const newValue = current + amount;
    await storage.set(key, newValue);
    return newValue;
  }

  /**
   * Add to list with max size
   */
  static async pushToList(storage, key, item, maxSize = 100) {
    const list = await storage.get(key) || [];
    list.unshift(item);
    
    if (list.length > maxSize) {
      list.splice(maxSize);
    }
    
    await storage.set(key, list);
    return list;
  }

  /**
   * Get paginated list
   */
  static async getPaginatedList(storage, key, page = 1, pageSize = 10) {
    const list = await storage.get(key) || [];
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      items: list.slice(start, end),
      total: list.length,
      page,
      pageSize,
      totalPages: Math.ceil(list.length / pageSize),
    };
  }

  /**
   * Set with expiry
   */
  static async setWithExpiry(storage, key, value, expirySeconds) {
    return storage.set(key, value, expirySeconds);
  }

  /**
   * Get multiple keys
   */
  static async getMultiple(storage, keys) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await storage.get(key);
    }
    
    return results;
  }

  /**
   * Set multiple keys
   */
  static async setMultiple(storage, items) {
    const results = {};
    
    for (const [key, value] of Object.entries(items)) {
      results[key] = await storage.set(key, value);
    }
    
    return results;
  }

  /**
   * Delete multiple keys
   */
  static async deleteMultiple(storage, keys) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await storage.delete(key);
    }
    
    return results;
  }
}

/**
 * Predefined storage keys
 */
export const STORAGE_KEYS = {
  // Automation state
  AUTOMATION_PAUSED: 'automation_paused',
  CURRENT_MODE: 'current_mode',
  
  // Workflow data
  RECENT_WORKFLOWS: 'recent_workflows',
  RECENT_TOPICS: 'recent_topics',
  PENDING_APPROVALS: 'pending_approvals',
  DRAFTS: 'drafts',
  
  // Run history
  LAST_SOCIAL_RUN: 'last_social_run',
  LAST_MORNING_RUN: 'last_morning_run',
  LAST_AFTERNOON_RUN: 'last_afternoon_run',
  LAST_CLEANUP_RUN: 'last_cleanup_run',
  
  // Research data
  LATEST_RESEARCH: 'latest_research',
  TOPIC_HISTORY: 'topic_history',
  
  // Statistics
  POSTS_PUBLISHED_TODAY: 'posts_published_today',
  POSTS_PUBLISHED_WEEK: 'posts_published_week',
  POSTS_PUBLISHED_MONTH: 'posts_published_month',
  
  // Settings
  PLATFORM_SETTINGS: 'platform_settings',
  SCHEDULE_SETTINGS: 'schedule_settings',
  TONE_SETTINGS: 'tone_settings',
};

export default StorageService;