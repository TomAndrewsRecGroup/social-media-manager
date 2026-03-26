/**
 * IvyLens Social Operator - Tavily Research Service
 * Phase 4: Fetches trends and research data
 */

import axios from 'axios';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const log = logger.child('TavilyService');

class TavilyService {
  constructor() {
    this.apiKey = config.apis.tavily.apiKey;
    this.baseUrl = 'https://api.tavily.com';
    this.searchDepth = config.apis.tavily.searchDepth;
    this.maxResults = config.apis.tavily.maxResults;
  }

  /**
   * Search for trending topics and content
   */
  async search(query, options = {}) {
    try {
      log.apiCall('Tavily', '/search', 'POST', { query });
      
      const searchParams = {
        api_key: this.apiKey,
        query,
        search_depth: options.searchDepth || this.searchDepth,
        max_results: options.maxResults || this.maxResults,
        include_domains: options.includeDomains || [],
        exclude_domains: options.excludeDomains || [],
        include_answer: options.includeAnswer !== false,
        include_raw_content: options.includeRawContent || false,
        include_images: false,
      };
      
      const response = await axios.post(
        `${this.baseUrl}/search`,
        searchParams,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: config.system.timeout,
        }
      );
      
      log.apiResponse('Tavily', response.status);
      
      return {
        success: true,
        data: this.processSearchResults(response.data),
      };
      
    } catch (error) {
      log.error('Tavily search error', error);
      
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Research UK recruitment trends
   */
  async researchRecruitmentTrends(options = {}) {
    const queries = this.buildRecruitmentQueries(options);
    const results = [];
    
    for (const query of queries) {
      log.info(`Researching: ${query}`);
      
      const searchResult = await this.search(query, {
        maxResults: 5,
        includeDomains: [
          'linkedin.com',
          'indeed.com',
          'reed.co.uk',
          'totaljobs.com',
          'cv-library.co.uk',
          'recruitmentinternational.co.uk',
          'personneltoday.com',
          'peoplemanagement.co.uk',
        ],
      });
      
      if (searchResult.success && searchResult.data) {
        results.push(...searchResult.data.topics);
      }
    }
    
    return this.consolidateTopics(results);
  }

  /**
   * Research sector-specific trends
   */
  async researchSectorTrends(sectors = config.content.sectors) {
    const results = [];
    
    for (const sector of sectors) {
      const query = `${sector} hiring trends UK 2024 2025 recruitment challenges`;
      
      log.info(`Researching sector: ${sector}`);
      
      const searchResult = await this.search(query, {
        maxResults: 3,
      });
      
      if (searchResult.success && searchResult.data) {
        const sectorTopics = searchResult.data.topics.map(topic => ({
          ...topic,
          sector,
        }));
        results.push(...sectorTopics);
      }
    }
    
    return results;
  }

  /**
   * Build recruitment-focused search queries
   */
  buildRecruitmentQueries(options = {}) {
    const baseQueries = [
      'UK recruitment trends 2024 2025',
      'UK hiring challenges shortage',
      'UK salary inflation recruitment',
      'UK skills gap engineering construction',
      'UK candidate shortage recruitment',
      'UK job market trends hiring',
    ];
    
    const focusAreas = options.focusAreas || config.content.focusAreas;
    const focusQueries = focusAreas.slice(0, 3).map(area => 
      `UK recruitment ${area} 2024 trends`
    );
    
    return [...baseQueries, ...focusQueries];
  }

  /**
   * Process raw search results into structured topics
   */
  processSearchResults(rawData) {
    if (!rawData || !rawData.results) {
      return { topics: [] };
    }
    
    const topics = rawData.results.map(result => ({
      title: result.title,
      description: result.content || result.snippet,
      url: result.url,
      source: new URL(result.url).hostname,
      publishedDate: result.published_date,
      relevanceScore: result.score || 0,
      keywords: this.extractKeywords(result.content || result.snippet),
    }));
    
    // Add answer as a topic if available
    if (rawData.answer) {
      topics.unshift({
        title: 'AI Summary',
        description: rawData.answer,
        source: 'Tavily AI',
        relevanceScore: 100,
        keywords: this.extractKeywords(rawData.answer),
      });
    }
    
    return {
      topics,
      query: rawData.query,
      totalResults: topics.length,
    };
  }

  /**
   * Extract keywords from content
   */
  extractKeywords(content) {
    if (!content) return [];
    
    // Common recruitment/business keywords to look for
    const keywordPatterns = [
      'recruitment', 'hiring', 'salary', 'skills', 'shortage',
      'candidate', 'employer', 'interview', 'talent', 'workforce',
      'engineering', 'construction', 'materials', 'industrial',
      'inflation', 'market', 'trends', 'challenges', 'opportunities',
    ];
    
    const foundKeywords = [];
    const lowerContent = content.toLowerCase();
    
    for (const keyword of keywordPatterns) {
      if (lowerContent.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }
    
    return foundKeywords;
  }

  /**
   * Consolidate and deduplicate topics
   */
  consolidateTopics(topics) {
    const seen = new Set();
    const unique = [];
    
    for (const topic of topics) {
      // Create a simple hash for deduplication
      const hash = `${topic.title}::${topic.source}`.toLowerCase();
      
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(topic);
      }
    }
    
    // Sort by relevance score
    unique.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    return unique;
  }

  /**
   * Score topics for content generation
   */
  scoreTopics(topics) {
    return topics.map(topic => {
      let score = topic.relevanceScore || 50;
      
      // Boost score for UK-specific content
      if (topic.title?.toLowerCase().includes('uk') || 
          topic.description?.toLowerCase().includes('uk')) {
        score += 20;
      }
      
      // Boost for recruitment keywords
      const recruitmentKeywords = ['recruitment', 'hiring', 'talent', 'candidate', 'employer'];
      const keywordCount = recruitmentKeywords.filter(kw => 
        topic.description?.toLowerCase().includes(kw)
      ).length;
      score += keywordCount * 10;
      
      // Boost for sector relevance
      if (topic.sector) {
        score += 15;
      }
      
      // Boost for freshness
      if (topic.publishedDate) {
        const daysOld = Math.floor(
          (Date.now() - new Date(topic.publishedDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysOld < 7) score += 25;
        else if (daysOld < 30) score += 15;
        else if (daysOld < 90) score += 5;
      }
      
      // Cap at 100
      score = Math.min(score, 100);
      
      return {
        ...topic,
        contentScore: score,
        freshness: this.getFreshness(topic.publishedDate),
      };
    });
  }

  /**
   * Determine content freshness
   */
  getFreshness(publishedDate) {
    if (!publishedDate) return 'evergreen';
    
    const daysOld = Math.floor(
      (Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysOld < 2) return 'breaking';
    if (daysOld < 7) return 'recent';
    return 'evergreen';
  }

  /**
   * Get trending topics for social media
   */
  async getTrendingTopics(options = {}) {
    log.workflowStart('Research Trending Topics');
    
    try {
      // Research general recruitment trends
      const generalTrends = await this.researchRecruitmentTrends(options);
      
      // Research sector-specific trends
      const sectorTrends = await this.researchSectorTrends(
        options.sectors || config.content.sectors.slice(0, 3)
      );
      
      // Combine all topics
      const allTopics = [...generalTrends, ...sectorTrends];
      
      // Score and rank topics
      const scoredTopics = this.scoreTopics(allTopics);
      
      // Sort by score and take top results
      scoredTopics.sort((a, b) => b.contentScore - a.contentScore);
      const topTopics = scoredTopics.slice(0, options.limit || 10);
      
      log.researchComplete(allTopics.length, topTopics.length);
      log.workflowComplete('Research Trending Topics', {
        totalFound: allTopics.length,
        selected: topTopics.length,
      });
      
      return {
        success: true,
        topics: topTopics,
        stats: {
          totalResearched: allTopics.length,
          topicsSelected: topTopics.length,
        },
      };
      
    } catch (error) {
      log.workflowError('Research Trending Topics', error);
      
      return {
        success: false,
        error: error.message,
        topics: [],
      };
    }
  }
}

export default TavilyService;