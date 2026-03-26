/**
 * IvyLens Social Operator - Topic Selection Agent
 * Phase 5: Scores and selects best topics for content generation
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import { researchTopicSchema } from '../lib/validators.js';
import StorageService from '../services/storage.js';

const log = logger.child('TopicSelector');

class TopicSelector {
  constructor() {
    this.storage = new StorageService();
    this.recentTopicsKey = 'recent_topics';
    this.topicHistoryDays = 7; // Look back 7 days for duplication check
  }

  /**
   * Select best topics from research results
   */
  async selectTopics(topics, options = {}) {
    try {
      log.info('Selecting topics', { 
        totalTopics: topics.length,
        targetCount: options.count || 1,
      });
      
      // Validate topics
      const validTopics = this.validateTopics(topics);
      
      if (validTopics.length === 0) {
        log.warn('No valid topics to select from');
        return {
          success: false,
          error: 'No valid topics found',
          selected: [],
        };
      }
      
      // Get recent topic history
      const recentTopics = await this.getRecentTopics();
      
      // Score topics with all factors
      const scoredTopics = await this.scoreTopics(validTopics, {
        recentTopics,
        preferences: options.preferences || {},
      });
      
      // Apply selection strategy
      const selected = this.applySelectionStrategy(scoredTopics, {
        count: options.count || 1,
        strategy: options.strategy || 'balanced',
        platforms: options.platforms || ['all'],
      });
      
      // Store selected topics
      await this.storeSelectedTopics(selected);
      
      log.success('Topics selected', {
        count: selected.length,
        topScores: selected.map(t => t.finalScore),
      });
      
      return {
        success: true,
        selected,
        stats: {
          totalEvaluated: topics.length,
          validTopics: validTopics.length,
          selected: selected.length,
        },
      };
      
    } catch (error) {
      log.error('Topic selection error', error);
      
      return {
        success: false,
        error: error.message,
        selected: [],
      };
    }
  }

  /**
   * Validate topics against schema
   */
  validateTopics(topics) {
    const valid = [];
    
    for (const topic of topics) {
      try {
        // Ensure topic matches expected structure
        const validatedTopic = {
          title: topic.title || 'Untitled',
          description: topic.description || topic.content || '',
          source: topic.source || topic.url || 'Unknown',
          relevanceScore: topic.relevanceScore || topic.contentScore || 50,
          freshness: topic.freshness || 'evergreen',
          sector: topic.sector,
          keywords: topic.keywords || [],
        };
        
        // Validate against schema
        researchTopicSchema.parse(validatedTopic);
        valid.push({
          ...topic,
          ...validatedTopic,
        });
        
      } catch (error) {
        log.debug('Invalid topic skipped', { title: topic.title, error: error.message });
      }
    }
    
    return valid;
  }

  /**
   * Score topics based on multiple factors
   */
  async scoreTopics(topics, context = {}) {
    const { recentTopics = [], preferences = {} } = context;
    
    return topics.map(topic => {
      let score = 0;
      const factors = {};
      
      // 1. Base relevance score (0-100)
      factors.relevance = topic.relevanceScore || topic.contentScore || 50;
      score += factors.relevance * 0.3; // 30% weight
      
      // 2. Freshness score (0-100)
      factors.freshness = this.getFreshnessScore(topic.freshness);
      score += factors.freshness * 0.25; // 25% weight
      
      // 3. Sector alignment score (0-100)
      factors.sectorAlignment = this.getSectorScore(topic);
      score += factors.sectorAlignment * 0.2; // 20% weight
      
      // 4. Uniqueness score (0-100)
      factors.uniqueness = this.getUniquenessScore(topic, recentTopics);
      score += factors.uniqueness * 0.15; // 15% weight
      
      // 5. Engagement potential (0-100)
      factors.engagement = this.getEngagementScore(topic);
      score += factors.engagement * 0.1; // 10% weight
      
      // Apply preference modifiers
      if (preferences.preferSector && topic.sector === preferences.preferSector) {
        score *= 1.2;
      }
      
      if (preferences.preferFresh && topic.freshness === 'breaking') {
        score *= 1.15;
      }
      
      // Cap at 100
      score = Math.min(Math.round(score), 100);
      
      return {
        ...topic,
        finalScore: score,
        scoreFactors: factors,
      };
    });
  }

  /**
   * Get freshness score
   */
  getFreshnessScore(freshness) {
    const scores = {
      'breaking': 100,
      'recent': 75,
      'evergreen': 50,
    };
    
    return scores[freshness] || 50;
  }

  /**
   * Get sector alignment score
   */
  getSectorScore(topic) {
    if (!topic.sector) return 40;
    
    // Check if sector is in priority list
    const prioritySectors = config.content.sectors.slice(0, 3);
    
    if (prioritySectors.includes(topic.sector)) {
      return 90;
    }
    
    if (config.content.sectors.includes(topic.sector)) {
      return 70;
    }
    
    return 50;
  }

  /**
   * Get uniqueness score (avoid duplication)
   */
  getUniquenessScore(topic, recentTopics) {
    if (!recentTopics || recentTopics.length === 0) {
      return 100;
    }
    
    const titleLower = topic.title.toLowerCase();
    const keywordsSet = new Set(topic.keywords?.map(k => k.toLowerCase()) || []);
    
    let maxSimilarity = 0;
    
    for (const recent of recentTopics) {
      let similarity = 0;
      
      // Title similarity
      if (recent.title && titleLower.includes(recent.title.toLowerCase())) {
        similarity += 50;
      }
      
      // Keyword overlap
      const recentKeywords = new Set(recent.keywords?.map(k => k.toLowerCase()) || []);
      const overlap = [...keywordsSet].filter(k => recentKeywords.has(k)).length;
      
      if (keywordsSet.size > 0) {
        similarity += (overlap / keywordsSet.size) * 50;
      }
      
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    return Math.max(0, 100 - maxSimilarity);
  }

  /**
   * Get engagement potential score
   */
  getEngagementScore(topic) {
    let score = 50; // Base score
    
    // Check for engagement triggers
    const engagementKeywords = [
      'controversy', 'debate', 'shortage', 'crisis', 'breakthrough',
      'inflation', 'challenge', 'opportunity', 'trend', 'shift',
      'surprising', 'unexpected', 'revealed', 'exclusive',
    ];
    
    const textToCheck = `${topic.title} ${topic.description}`.toLowerCase();
    
    for (const keyword of engagementKeywords) {
      if (textToCheck.includes(keyword)) {
        score += 10;
      }
    }
    
    // Check for question potential
    if (textToCheck.includes('?') || textToCheck.includes('how') || 
        textToCheck.includes('why') || textToCheck.includes('what')) {
      score += 15;
    }
    
    // Check for data/statistics
    if (/\d+%|\d+ percent|£\d+|salary|wage|cost/i.test(textToCheck)) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Apply selection strategy
   */
  applySelectionStrategy(scoredTopics, options) {
    const { count = 1, strategy = 'balanced', platforms = ['all'] } = options;
    
    // Sort by final score
    scoredTopics.sort((a, b) => b.finalScore - a.finalScore);
    
    switch (strategy) {
      case 'top':
        // Simply take the top N topics
        return scoredTopics.slice(0, count);
      
      case 'diverse':
        // Try to select topics from different sectors/themes
        return this.selectDiverseTopics(scoredTopics, count);
      
      case 'fresh':
        // Prioritize breaking/recent news
        const freshFirst = [...scoredTopics].sort((a, b) => {
          const freshOrder = { 'breaking': 0, 'recent': 1, 'evergreen': 2 };
          return freshOrder[a.freshness] - freshOrder[b.freshness];
        });
        return freshFirst.slice(0, count);
      
      case 'balanced':
      default:
        // Mix of high score and diversity
        return this.selectBalancedTopics(scoredTopics, count);
    }
  }

  /**
   * Select diverse topics
   */
  selectDiverseTopics(topics, count) {
    const selected = [];
    const usedSectors = new Set();
    const usedKeywords = new Set();
    
    for (const topic of topics) {
      if (selected.length >= count) break;
      
      // Check for diversity
      const isNewSector = !topic.sector || !usedSectors.has(topic.sector);
      const hasNewKeywords = topic.keywords?.some(k => !usedKeywords.has(k)) || false;
      
      if (isNewSector || hasNewKeywords || selected.length === 0) {
        selected.push(topic);
        
        if (topic.sector) usedSectors.add(topic.sector);
        topic.keywords?.forEach(k => usedKeywords.add(k));
      }
    }
    
    // Fill remaining slots with top scored if needed
    while (selected.length < count && selected.length < topics.length) {
      const nextTopic = topics.find(t => !selected.includes(t));
      if (nextTopic) selected.push(nextTopic);
      else break;
    }
    
    return selected;
  }

  /**
   * Select balanced mix of topics
   */
  selectBalancedTopics(topics, count) {
    if (count === 1) {
      return [topics[0]]; // Just return the top topic
    }
    
    const selected = [];
    
    // Take the top topic
    if (topics.length > 0) {
      selected.push(topics[0]);
    }
    
    // For remaining slots, alternate between high score and diversity
    let useHighScore = true;
    let index = 1;
    
    while (selected.length < count && index < topics.length) {
      const candidate = topics[index];
      
      if (useHighScore) {
        // Take next highest score
        selected.push(candidate);
      } else {
        // Look for diverse topic
        const diverseCandidate = topics.slice(index).find(t => 
          !selected.some(s => s.sector === t.sector)
        );
        
        if (diverseCandidate) {
          selected.push(diverseCandidate);
          topics.splice(topics.indexOf(diverseCandidate), 1);
        } else {
          selected.push(candidate);
        }
      }
      
      useHighScore = !useHighScore;
      index++;
    }
    
    return selected;
  }

  /**
   * Get recent topics from storage
   */
  async getRecentTopics() {
    try {
      const stored = await this.storage.get(this.recentTopicsKey);
      
      if (!stored) return [];
      
      // Filter to only recent topics
      const cutoffDate = Date.now() - (this.topicHistoryDays * 24 * 60 * 60 * 1000);
      
      return stored.filter(topic => 
        topic.selectedAt && new Date(topic.selectedAt).getTime() > cutoffDate
      );
      
    } catch (error) {
      log.warn('Could not retrieve recent topics', error);
      return [];
    }
  }

  /**
   * Store selected topics
   */
  async storeSelectedTopics(topics) {
    try {
      const timestamped = topics.map(topic => ({
        ...topic,
        selectedAt: new Date().toISOString(),
      }));
      
      const existing = await this.getRecentTopics();
      const updated = [...timestamped, ...existing];
      
      // Keep only recent history
      const cutoffDate = Date.now() - (this.topicHistoryDays * 24 * 60 * 60 * 1000);
      const filtered = updated.filter(topic => 
        topic.selectedAt && new Date(topic.selectedAt).getTime() > cutoffDate
      );
      
      await this.storage.set(this.recentTopicsKey, filtered);
      
    } catch (error) {
      log.warn('Could not store selected topics', error);
    }
  }
}

export default TopicSelector;