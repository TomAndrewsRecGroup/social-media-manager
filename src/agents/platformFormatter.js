/**
 * IvyLens Social Operator - Platform Formatter Agent
 * Phase 7: Formats content for each social platform
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import { 
  validateContentLength, 
  validateHashtags,
  isValidPlatform 
} from '../lib/validators.js';

const log = logger.child('PlatformFormatter');

class PlatformFormatter {
  constructor() {
    this.platformConfigs = config.content.platforms;
  }

  /**
   * Format content for specific platform
   */
  formatForPlatform(content, platform, options = {}) {
    if (!isValidPlatform(platform)) {
      log.error(`Invalid platform: ${platform}`);
      return null;
    }
    
    log.info(`Formatting content for ${platform}`);
    
    // Apply platform-specific formatting
    let formatted;
    switch (platform.toLowerCase()) {
      case 'linkedin':
        formatted = this.formatLinkedIn(content, options);
        break;
      case 'facebook':
        formatted = this.formatFacebook(content, options);
        break;
      case 'instagram':
        formatted = this.formatInstagram(content, options);
        break;
      case 'x':
        formatted = this.formatX(content, options);
        break;
      default:
        formatted = content;
    }
    
    // Validate formatted content
    const validation = this.validateFormat(formatted, platform);
    
    if (!validation.valid) {
      log.warn(`Content validation failed for ${platform}`, validation.errors);
      
      // Try to fix common issues
      formatted = this.autoFix(formatted, platform, validation.errors);
    }
    
    return {
      platform,
      content: formatted.content,
      hashtags: formatted.hashtags,
      metadata: formatted.metadata,
      valid: validation.valid,
      warnings: validation.errors,
    };
  }

  /**
   * Format for LinkedIn
   */
  formatLinkedIn(content, options = {}) {
    let text = content;
    
    // Extract existing hashtags
    const existingHashtags = this.extractHashtags(text);
    text = this.removeHashtags(text);
    
    // Add line breaks for readability
    text = this.addLineBreaks(text, 'linkedin');
    
    // Add emoji if appropriate
    if (options.addEmoji !== false) {
      text = this.addProfessionalEmoji(text);
    }
    
    // Generate or use provided hashtags
    const hashtags = options.hashtags || this.generateHashtags(text, 'linkedin', existingHashtags);
    
    // Add hashtags at the end
    if (hashtags.length > 0) {
      text += '\n\n' + hashtags.map(tag => `#${tag}`).join(' ');
    }
    
    // Add CTA if provided
    if (options.cta) {
      text = this.addCTA(text, options.cta, 'linkedin');
    }
    
    return {
      content: text,
      hashtags,
      metadata: {
        hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(text),
        hasCTA: !!options.cta,
        paragraphs: text.split('\n\n').length,
      },
    };
  }

  /**
   * Format for Facebook
   */
  formatFacebook(content, options = {}) {
    let text = content;
    
    // Extract and limit hashtags
    const existingHashtags = this.extractHashtags(text);
    text = this.removeHashtags(text);
    
    // Make more conversational
    text = this.makeConversational(text);
    
    // Add line breaks for readability
    text = this.addLineBreaks(text, 'facebook');
    
    // Add casual emoji
    if (options.addEmoji !== false) {
      text = this.addCasualEmoji(text);
    }
    
    // Limited hashtags for Facebook
    const hashtags = (options.hashtags || existingHashtags).slice(0, 3);
    
    if (hashtags.length > 0) {
      text += '\n\n' + hashtags.map(tag => `#${tag}`).join(' ');
    }
    
    // Add CTA if provided
    if (options.cta) {
      text = this.addCTA(text, options.cta, 'facebook');
    }
    
    return {
      content: text,
      hashtags,
      metadata: {
        conversationalScore: this.getConversationalScore(text),
        hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(text),
      },
    };
  }

  /**
   * Format for Instagram
   */
  formatInstagram(content, options = {}) {
    let text = content;
    
    // Extract hashtags
    const existingHashtags = this.extractHashtags(text);
    text = this.removeHashtags(text);
    
    // Create punchy opening
    text = this.createPunchyOpening(text);
    
    // Add line breaks and spacing
    text = this.addLineBreaks(text, 'instagram');
    
    // Add visual emoji
    if (options.addEmoji !== false) {
      text = this.addVisualEmoji(text);
    }
    
    // Generate comprehensive hashtags
    const hashtags = options.hashtags || this.generateHashtags(text, 'instagram', existingHashtags);
    
    // Add hashtags (can be many for Instagram)
    if (hashtags.length > 0) {
      // First 5-10 in the caption
      const captionTags = hashtags.slice(0, 8);
      text += '\n\n' + captionTags.map(tag => `#${tag}`).join(' ');
      
      // Rest can go in first comment (indicate this)
      if (hashtags.length > 8) {
        text += '\n\n[Additional hashtags in comments 👇]';
      }
    }
    
    // Add CTA with emoji
    if (options.cta) {
      text = this.addCTA(text, options.cta, 'instagram');
    }
    
    return {
      content: text,
      hashtags,
      metadata: {
        punchyOpening: true,
        visualAppeal: this.getVisualAppealScore(text),
        hashtagStrategy: hashtags.length > 8 ? 'split' : 'inline',
      },
    };
  }

  /**
   * Format for X (Twitter)
   */
  formatX(content, options = {}) {
    let text = content;
    
    // Extract hashtags
    const existingHashtags = this.extractHashtags(text);
    text = this.removeHashtags(text);
    
    // Make concise and punchy
    text = this.makeConcise(text, 250); // Leave room for hashtags
    
    // Add sharp emoji if appropriate
    if (options.addEmoji !== false) {
      text = this.addSharpEmoji(text);
    }
    
    // Very limited hashtags for X
    const hashtags = (options.hashtags || existingHashtags).slice(0, 2);
    
    if (hashtags.length > 0) {
      text += ' ' + hashtags.map(tag => `#${tag}`).join(' ');
    }
    
    // Ensure within character limit
    if (text.length > 280) {
      text = this.truncateSmartly(text, 280);
    }
    
    return {
      content: text,
      hashtags,
      metadata: {
        characterCount: text.length,
        conciseness: this.getConciseScore(text),
        threadPotential: content.length > 500, // Could be a thread
      },
    };
  }

  /**
   * Validate formatted content
   */
  validateFormat(formatted, platform) {
    const errors = [];
    
    // Check content length
    const lengthCheck = validateContentLength(formatted.content, platform);
    if (!lengthCheck.valid) {
      errors.push(lengthCheck.error);
    }
    
    // Check hashtag count
    const hashtagCheck = validateHashtags(formatted.hashtags, platform);
    if (!hashtagCheck.valid) {
      errors.push(hashtagCheck.error);
    }
    
    // Platform-specific checks
    if (platform === 'linkedin' && formatted.content.length < 100) {
      errors.push('LinkedIn posts should be more substantial (100+ characters)');
    }
    
    if (platform === 'x' && formatted.content.length > 280) {
      errors.push('X posts must be under 280 characters');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Auto-fix common formatting issues
   */
  autoFix(formatted, platform, errors) {
    let fixed = { ...formatted };
    
    for (const error of errors) {
      if (error.includes('exceeds maximum length')) {
        // Truncate content
        const config = this.platformConfigs[platform];
        fixed.content = this.truncateSmartly(fixed.content, config.maxLength);
      }
      
      if (error.includes('Too many hashtags')) {
        // Reduce hashtags
        const config = this.platformConfigs[platform];
        fixed.hashtags = fixed.hashtags.slice(0, config.hashtagLimit);
      }
    }
    
    return fixed;
  }

  // Utility Methods

  extractHashtags(text) {
    const matches = text.match(/#\w+/g) || [];
    return matches.map(tag => tag.substring(1));
  }

  removeHashtags(text) {
    return text.replace(/#\w+/g, '').trim();
  }

  addLineBreaks(text, platform) {
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    if (platform === 'linkedin') {
      // Add paragraph breaks for long posts
      const chunks = [];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > 400) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += ' ' + sentence;
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      return chunks.join('\n\n');
    }
    
    if (platform === 'instagram') {
      // More frequent line breaks for mobile reading
      return sentences.join('\n');
    }
    
    return text;
  }

  generateHashtags(text, platform, existing = []) {
    const keywords = this.extractKeywords(text);
    const hashtags = [...existing];
    
    // Platform-specific popular hashtags
    const platformTags = {
      linkedin: ['recruitment', 'hiring', 'ukjobs', 'talentacquisition'],
      facebook: ['jobs', 'careers', 'work'],
      instagram: ['recruitmentlife', 'hiringnow', 'jobsearch', 'careeradvice'],
      x: ['ukjobs', 'hiring'],
    };
    
    // Add platform-specific tags
    const relevantTags = platformTags[platform] || [];
    for (const tag of relevantTags) {
      if (!hashtags.includes(tag) && hashtags.length < this.platformConfigs[platform].hashtagLimit) {
        hashtags.push(tag);
      }
    }
    
    // Add keyword-based tags
    for (const keyword of keywords) {
      if (!hashtags.includes(keyword) && hashtags.length < this.platformConfigs[platform].hashtagLimit) {
        hashtags.push(keyword.toLowerCase().replace(/\s+/g, ''));
      }
    }
    
    return hashtags;
  }

  extractKeywords(text) {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    return words
      .filter(word => word.length > 4 && !commonWords.has(word))
      .slice(0, 5);
  }

  addProfessionalEmoji(text) {
    const emojis = ['💼', '📊', '🎯', '✅', '📈', '🔍', '💡', '🚀'];
    
    // Add to beginning if it's a statement
    if (!text.startsWith('?') && Math.random() > 0.5) {
      return emojis[Math.floor(Math.random() * emojis.length)] + ' ' + text;
    }
    
    return text;
  }

  addCasualEmoji(text) {
    const emojis = ['👇', '💭', '🤔', '👀', '✨', '🙌', '💪', '🎉'];
    
    // More likely to add emoji
    if (Math.random() > 0.3) {
      return emojis[Math.floor(Math.random() * emojis.length)] + ' ' + text;
    }
    
    return text;
  }

  addVisualEmoji(text) {
    const emojis = ['✨', '🔥', '💫', '⚡', '🌟', '💎', '🎯', '🚀', '💡'];
    
    // Always add emoji for Instagram
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    return emoji + ' ' + text.replace(/\n/g, '\n' + emoji + ' ');
  }

  addSharpEmoji(text) {
    const emojis = ['🎯', '⚡', '🔥', '💭', '👇'];
    
    // Selective emoji use
    if (text.includes('?') || Math.random() > 0.6) {
      return text + ' ' + emojis[Math.floor(Math.random() * emojis.length)];
    }
    
    return text;
  }

  makeConversational(text) {
    // Add conversational elements
    text = text.replace(/^([A-Z])/, 'So, $1');
    text = text.replace(/\. ([A-Z])/g, '.\n\n$1');
    
    return text;
  }

  createPunchyOpening(text) {
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text.substring(0, 50);
    const rest = text.substring(firstSentence.length).trim();
    
    // Make first line stand out
    return firstSentence.toUpperCase() + '\n\n' + rest;
  }

  makeConcise(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // Remove filler words
    text = text.replace(/\b(really|very|quite|just|actually|basically)\b/gi, '');
    text = text.replace(/\s+/g, ' ').trim();
    
    // Still too long? Truncate smartly
    if (text.length > maxLength) {
      return this.truncateSmartly(text, maxLength);
    }
    
    return text;
  }

  truncateSmartly(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // Try to cut at sentence boundary
    const truncated = text.substring(0, maxLength - 3);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastPeriod > maxLength * 0.8) {
      return truncated.substring(0, lastPeriod + 1);
    }
    
    return truncated.substring(0, lastSpace) + '...';
  }

  addCTA(text, cta, platform) {
    const separator = platform === 'x' ? '\n' : '\n\n';
    
    if (platform === 'instagram') {
      return text + separator + '👉 ' + cta;
    }
    
    return text + separator + cta;
  }

  getConversationalScore(text) {
    let score = 0;
    
    if (text.includes('you')) score += 0.2;
    if (text.includes('?')) score += 0.2;
    if (text.includes('!')) score += 0.1;
    if (/\b(we|us|our)\b/i.test(text)) score += 0.2;
    if (text.length < 500) score += 0.3;
    
    return Math.min(1, score);
  }

  getVisualAppealScore(text) {
    let score = 0;
    
    if (/[\u{1F300}-\u{1F9FF}]/u.test(text)) score += 0.3;
    if (text.includes('\n')) score += 0.2;
    if (text.length < 300) score += 0.2;
    if (text.match(/#\w+/g)?.length > 5) score += 0.3;
    
    return Math.min(1, score);
  }

  getConciseScore(text) {
    const wordCount = text.split(/\s+/).length;
    
    if (wordCount < 30) return 1;
    if (wordCount < 50) return 0.8;
    if (wordCount < 70) return 0.6;
    
    return 0.4;
  }
}

export default PlatformFormatter;