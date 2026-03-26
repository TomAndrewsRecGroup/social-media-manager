/**
 * IvyLens Social Operator - PostFast Publishing Service
 * Phase 8: Publishes content to social media platforms
 */

import axios from 'axios';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const log = logger.child('PostFastService');

class PostFastService {
  constructor() {
    this.apiKey = config.apis.postfast.apiKey;
    this.baseUrl = config.apis.postfast.baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.system.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Publish content to a single platform
   */
  async publishToPlatform(platform, content, options = {}) {
    try {
      log.apiCall('PostFast', `/publish/${platform}`, 'POST', {
        contentLength: content.length,
        hasMedia: !!options.mediaUrl,
      });
      
      const payload = this.buildPayload(platform, content, options);
      
      const response = await this.client.post(`/publish/${platform}`, payload);
      
      log.apiResponse('PostFast', response.status, {
        postId: response.data?.postId,
        platform,
      });
      
      if (response.data?.success) {
        log.postPublished(platform, response.data.postId, content);
        
        return {
          success: true,
          platform,
          postId: response.data.postId,
          url: response.data.url,
          publishedAt: new Date().toISOString(),
        };
      } else {
        throw new Error(response.data?.error || 'Publishing failed');
      }
      
    } catch (error) {
      log.error(`Publishing failed for ${platform}`, error);
      
      return {
        success: false,
        platform,
        error: error.message,
        publishedAt: null,
      };
    }
  }

  /**
   * Publish to multiple platforms
   */
  async publishToMultiple(posts, options = {}) {
    const results = [];
    const { mode = 'parallel' } = options;
    
    log.workflowStart('Multi-platform Publishing', {
      platforms: Object.keys(posts),
      mode,
    });
    
    if (mode === 'parallel') {
      // Publish to all platforms simultaneously
      const promises = Object.entries(posts).map(([platform, content]) =>
        this.publishToPlatform(platform, content.content || content, {
          hashtags: content.hashtags,
          ...options,
        })
      );
      
      const publishResults = await Promise.allSettled(promises);
      
      for (const result of publishResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }
    } else {
      // Publish sequentially
      for (const [platform, content] of Object.entries(posts)) {
        const result = await this.publishToPlatform(
          platform,
          content.content || content,
          {
            hashtags: content.hashtags,
            ...options,
          }
        );
        results.push(result);
        
        // Add delay between posts if specified
        if (options.delayBetween) {
          await this.delay(options.delayBetween);
        }
      }
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    log.workflowComplete('Multi-platform Publishing', {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
    });
    
    return {
      success: failed.length === 0,
      results,
      stats: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        platforms: {
          successful: successful.map(r => r.platform),
          failed: failed.map(r => r.platform),
        },
      },
    };
  }

  /**
   * Schedule a post for future publishing
   */
  async schedulePost(platform, content, scheduledTime, options = {}) {
    try {
      log.info(`Scheduling post for ${platform} at ${scheduledTime}`);
      
      const payload = {
        ...this.buildPayload(platform, content, options),
        scheduled_time: scheduledTime,
      };
      
      const response = await this.client.post(`/schedule/${platform}`, payload);
      
      if (response.data?.success) {
        return {
          success: true,
          platform,
          scheduleId: response.data.scheduleId,
          scheduledTime,
        };
      } else {
        throw new Error(response.data?.error || 'Scheduling failed');
      }
      
    } catch (error) {
      log.error(`Scheduling failed for ${platform}`, error);
      
      return {
        success: false,
        platform,
        error: error.message,
      };
    }
  }

  /**
   * Cancel a scheduled post
   */
  async cancelScheduledPost(scheduleId, platform) {
    try {
      log.info(`Cancelling scheduled post ${scheduleId} on ${platform}`);
      
      const response = await this.client.delete(`/schedule/${platform}/${scheduleId}`);
      
      return {
        success: response.data?.success || false,
        message: response.data?.message,
      };
      
    } catch (error) {
      log.error('Cancel scheduled post error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get publishing status
   */
  async getPostStatus(postId, platform) {
    try {
      const response = await this.client.get(`/status/${platform}/${postId}`);
      
      return {
        success: true,
        status: response.data?.status,
        metrics: response.data?.metrics,
      };
      
    } catch (error) {
      log.error('Get post status error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build payload for publishing
   */
  buildPayload(platform, content, options = {}) {
    const payload = {
      content,
      platform: platform.toLowerCase(),
    };
    
    // Add hashtags if provided
    if (options.hashtags && options.hashtags.length > 0) {
      // Some platforms want hashtags in content, others separate
      if (platform === 'linkedin' || platform === 'x') {
        // Already in content usually
      } else {
        payload.hashtags = options.hashtags;
      }
    }
    
    // Add media if provided
    if (options.mediaUrl) {
      payload.media = {
        type: options.mediaType || 'image',
        url: options.mediaUrl,
      };
    }
    
    // Platform-specific options
    switch (platform.toLowerCase()) {
      case 'linkedin':
        payload.visibility = options.visibility || 'public';
        break;
        
      case 'facebook':
        payload.page_id = options.pageId;
        break;
        
      case 'instagram':
        payload.account_id = options.accountId;
        if (options.firstComment) {
          payload.first_comment = options.firstComment;
        }
        break;
        
      case 'x':
        if (options.replyTo) {
          payload.reply_to = options.replyTo;
        }
        break;
    }
    
    return payload;
  }

  /**
   * Validate platform credentials
   */
  async validateCredentials() {
    try {
      log.info('Validating PostFast credentials');
      
      const response = await this.client.get('/validate');
      
      if (response.data?.valid) {
        const platforms = response.data.platforms || [];
        
        log.success('Credentials validated', { platforms });
        
        return {
          success: true,
          platforms,
          limits: response.data.limits,
        };
      } else {
        throw new Error('Invalid credentials');
      }
      
    } catch (error) {
      log.error('Credential validation failed', error);
      
      return {
        success: false,
        error: error.message,
        platforms: [],
      };
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    try {
      const response = await this.client.get('/account');
      
      return {
        success: true,
        account: response.data,
      };
      
    } catch (error) {
      log.error('Get account info error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get publishing limits
   */
  async getLimits() {
    try {
      const response = await this.client.get('/limits');
      
      return {
        success: true,
        limits: response.data?.limits || {},
        usage: response.data?.usage || {},
      };
      
    } catch (error) {
      log.error('Get limits error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test publishing without actually posting
   */
  async testPublish(platform, content, options = {}) {
    try {
      log.info(`Test publishing to ${platform}`);
      
      const payload = {
        ...this.buildPayload(platform, content, options),
        test_mode: true,
      };
      
      const response = await this.client.post(`/test/${platform}`, payload);
      
      return {
        success: response.data?.valid || false,
        issues: response.data?.issues || [],
        warnings: response.data?.warnings || [],
      };
      
    } catch (error) {
      log.error('Test publish error', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Utility: Add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if platform is supported
   */
  isPlatformSupported(platform) {
    const supported = ['linkedin', 'facebook', 'instagram', 'x'];
    return supported.includes(platform.toLowerCase());
  }

  /**
   * Format error message
   */
  formatError(error, platform) {
    if (error.response?.status === 429) {
      return `Rate limit exceeded for ${platform}. Please try again later.`;
    }
    
    if (error.response?.status === 401) {
      return `Authentication failed for ${platform}. Please check credentials.`;
    }
    
    if (error.response?.status === 400) {
      return `Invalid content for ${platform}: ${error.response.data?.message || 'Unknown error'}`;
    }
    
    return `Failed to publish to ${platform}: ${error.message}`;
  }
}

// Fallback implementation if PostFast is not available
class MockPostFastService extends PostFastService {
  constructor() {
    super();
    log.warn('Using mock PostFast service - posts will not be published');
  }
  
  async publishToPlatform(platform, content, options = {}) {
    log.info(`[MOCK] Would publish to ${platform}:`, {
      contentPreview: content.substring(0, 100),
      options,
    });
    
    // Simulate API delay
    await this.delay(1000);
    
    // Simulate success
    return {
      success: true,
      platform,
      postId: `mock_${platform}_${Date.now()}`,
      url: `https://example.com/${platform}/post`,
      publishedAt: new Date().toISOString(),
      mock: true,
    };
  }
  
  async validateCredentials() {
    return {
      success: true,
      platforms: ['linkedin', 'facebook', 'instagram', 'x'],
      limits: {
        daily: 100,
        remaining: 95,
      },
      mock: true,
    };
  }
}

// Export the appropriate service based on configuration
const Service = config.apis.postfast.apiKey === 'mock' || !config.apis.postfast.apiKey
  ? MockPostFastService
  : PostFastService;

export default Service;