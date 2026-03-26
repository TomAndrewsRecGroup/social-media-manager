/**
 * IvyLens Social Operator - Groq Content Generation Service
 * Phase 6: Generates platform-specific content using Groq LLM
 */

import Groq from 'groq-sdk';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const log = logger.child('GroqService');

class GroqService {
  constructor() {
    this.client = new Groq({
      apiKey: config.apis.groq.apiKey,
    });
    this.model = config.apis.groq.model;
    this.temperature = config.apis.groq.temperature;
    this.maxTokens = config.apis.groq.maxTokens;
  }

  /**
   * Generate content from topic
   */
  async generateContent(topic, platform, options = {}) {
    try {
      log.apiCall('Groq', 'chat.completions', 'POST', { 
        platform, 
        topic: topic.title 
      });
      
      const prompt = this.buildPrompt(topic, platform, options);
      
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(platform),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: this.model,
        temperature: options.temperature || this.temperature,
        max_tokens: options.maxTokens || this.maxTokens,
      });
      
      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content generated');
      }
      
      log.apiResponse('Groq', 200, { 
        contentLength: content.length,
        tokensUsed: completion.usage?.total_tokens,
      });
      
      return {
        success: true,
        content: content.trim(),
        usage: completion.usage,
      };
      
    } catch (error) {
      log.error('Content generation error', error);
      
      return {
        success: false,
        error: error.message,
        content: null,
      };
    }
  }

  /**
   * Generate content for all platforms
   */
  async generateMultiPlatform(topic, platforms = ['linkedin', 'facebook', 'instagram', 'x']) {
    const results = {};
    
    for (const platform of platforms) {
      log.info(`Generating content for ${platform}`);
      
      const result = await this.generateContent(topic, platform);
      
      if (result.success) {
        results[platform] = {
          content: result.content,
          hashtags: this.extractHashtags(result.content),
        };
      } else {
        log.warn(`Failed to generate content for ${platform}`, result.error);
        results[platform] = null;
      }
    }
    
    return results;
  }

  /**
   * Build prompt for content generation
   */
  buildPrompt(topic, platform, options = {}) {
    const platformConfig = config.content.platforms[platform];
    
    let prompt = `Create a ${platform} post based on this trending topic in UK recruitment:\n\n`;
    prompt += `Topic: ${topic.title}\n`;
    prompt += `Context: ${topic.description}\n`;
    
    if (topic.sector) {
      prompt += `Sector: ${topic.sector}\n`;
    }
    
    if (topic.keywords && topic.keywords.length > 0) {
      prompt += `Keywords: ${topic.keywords.join(', ')}\n`;
    }
    
    prompt += `\nRequirements:\n`;
    prompt += `- Maximum length: ${platformConfig.maxLength} characters\n`;
    prompt += `- Include up to ${platformConfig.hashtagLimit} relevant hashtags\n`;
    prompt += `- Write in Tom's voice: ${this.getTomVoiceDescription()}\n`;
    prompt += `- Focus on UK market and recruitment\n`;
    prompt += `- Be commercially relevant and practical\n`;
    prompt += `- ${this.getPlatformSpecificRequirements(platform)}\n`;
    
    if (options.angle) {
      prompt += `\nAngle to take: ${options.angle}\n`;
    }
    
    if (options.cta) {
      prompt += `\nCall to action: ${options.cta}\n`;
    }
    
    prompt += `\nGenerate ONLY the post content, nothing else. Do not include explanations or meta-commentary.`;
    
    return prompt;
  }

  /**
   * Get system prompt for platform
   */
  getSystemPrompt(platform) {
    return `You are an expert social media content creator for IvyLens, specializing in UK recruitment and Tom Andrews' business sectors. 
    
You create ${platform} posts that are:
- Commercially sharp and practical
- Direct and to the point
- Relevant to UK recruitment market
- Free from corporate waffle and AI-sounding copy
- Engaging and discussion-worthy
- Professional but not stuffy

Tom's sectors include: ${config.content.sectors.join(', ')}

Tom's tone is: direct, witty when appropriate, commercially aware, no fluff, practical, and authoritative.

Never use generic motivational content, fake statistics, or cliché recruitment advice.
Always write from the perspective of someone who actually operates in recruitment.`;
  }

  /**
   * Get Tom's voice description
   */
  getTomVoiceDescription() {
    const { style, voice, approach, avoid } = config.content.tonePreferences;
    
    return `${style}, ${voice}, ${approach}. Avoid: ${avoid.join(', ')}`;
  }

  /**
   * Get platform-specific requirements
   */
  getPlatformSpecificRequirements(platform) {
    const requirements = {
      linkedin: 'Professional tone, thought leadership angle, encourage discussion, use line breaks for readability',
      facebook: 'Conversational and accessible, community-friendly, relatable',
      instagram: 'Punchy opening, visual-aware caption structure, engaging and concise',
      x: 'Sharp and concise, provocative where useful, direct and stripped back',
    };
    
    return requirements[platform] || 'Appropriate for the platform';
  }

  /**
   * Extract hashtags from content
   */
  extractHashtags(content) {
    const hashtagRegex = /#\w+/g;
    const matches = content.match(hashtagRegex);
    
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  /**
   * Generate post ideas
   */
  async generateIdeas(topic, count = 5) {
    try {
      const prompt = `Generate ${count} different post ideas about "${topic}" for UK recruitment social media.
      
Each idea should:
- Take a different angle or perspective
- Be commercially relevant
- Suit Tom's direct, practical style
- Be suitable for LinkedIn, Facebook, Instagram, or X
- Include a brief description of the angle

Format as a numbered list with title and description for each idea.`;
      
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a UK recruitment content strategist who understands the market deeply.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: this.model,
        temperature: 0.8, // Higher temperature for more creative ideas
        max_tokens: 1000,
      });
      
      const ideas = completion.choices[0]?.message?.content;
      
      return {
        success: true,
        ideas: ideas || 'No ideas generated',
      };
      
    } catch (error) {
      log.error('Idea generation error', error);
      
      return {
        success: false,
        error: error.message,
        ideas: null,
      };
    }
  }

  /**
   * Refine/edit existing content
   */
  async refineContent(content, platform, instructions) {
    try {
      const platformConfig = config.content.platforms[platform];
      
      const prompt = `Refine this ${platform} post according to the instructions below:

Current post:
${content}

Instructions:
${instructions}

Requirements:
- Maximum length: ${platformConfig.maxLength} characters
- Maintain Tom's voice and style
- Keep it commercially relevant
- Ensure UK focus

Provide ONLY the refined post, no explanations.`;
      
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(platform),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: this.model,
        temperature: 0.5, // Lower temperature for refinement
        max_tokens: this.maxTokens,
      });
      
      const refined = completion.choices[0]?.message?.content;
      
      return {
        success: true,
        content: refined?.trim() || content,
      };
      
    } catch (error) {
      log.error('Content refinement error', error);
      
      return {
        success: false,
        error: error.message,
        content: content, // Return original on error
      };
    }
  }

  /**
   * Generate variations of content
   */
  async generateVariations(topic, platform, count = 3) {
    const variations = [];
    
    const angles = [
      'controversial/debate-starting',
      'data-driven/statistical',
      'personal experience/anecdotal',
      'question-based/engaging',
      'solution-focused/practical',
    ];
    
    for (let i = 0; i < Math.min(count, angles.length); i++) {
      const result = await this.generateContent(topic, platform, {
        angle: angles[i],
        temperature: 0.8, // More variation
      });
      
      if (result.success) {
        variations.push({
          angle: angles[i],
          content: result.content,
        });
      }
    }
    
    return variations;
  }

  /**
   * Check content quality
   */
  assessContentQuality(content, platform) {
    const platformConfig = config.content.platforms[platform];
    const quality = {
      lengthOk: content.length <= platformConfig.maxLength,
      hasHashtags: content.includes('#'),
      hasQuestion: content.includes('?'),
      hasData: /\d+%|\d+ percent|£\d+/i.test(content),
      readability: this.calculateReadability(content),
      engagement: this.estimateEngagement(content),
    };
    
    quality.score = 
      (quality.lengthOk ? 20 : 0) +
      (quality.hasHashtags ? 15 : 0) +
      (quality.hasQuestion ? 15 : 0) +
      (quality.hasData ? 20 : 0) +
      (quality.readability * 15) +
      (quality.engagement * 15);
    
    return quality;
  }

  /**
   * Calculate readability score (0-1)
   */
  calculateReadability(content) {
    // Simple readability check
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0) return 0.5;
    
    const avgWordsPerSentence = words.length / sentences.length;
    
    // Ideal is 10-20 words per sentence
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) {
      return 1;
    } else if (avgWordsPerSentence < 10) {
      return avgWordsPerSentence / 10;
    } else {
      return Math.max(0, 1 - (avgWordsPerSentence - 20) / 20);
    }
  }

  /**
   * Estimate engagement potential (0-1)
   */
  estimateEngagement(content) {
    let score = 0.5; // Base score
    
    // Engagement indicators
    if (content.includes('?')) score += 0.1;
    if (/what|why|how/i.test(content)) score += 0.1;
    if (/agree|disagree|thoughts|opinion/i.test(content)) score += 0.1;
    if (/surprising|shocking|revealed/i.test(content)) score += 0.1;
    if (content.includes('👇') || content.includes('💭')) score += 0.1;
    
    return Math.min(1, score);
  }
}

export default GroqService;