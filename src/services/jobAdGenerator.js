/**
 * IvyLens Social Operator - Job Ad Generation Service
 * Feature 6: Generate professional job ads from brief instructions
 *
 * Supports:
 * - Full job ad generation from minimal input
 * - Platform-specific variants (LinkedIn, job boards, careers page)
 * - Sector-aware language and terminology
 * - Tom's tone for the company pitch sections
 * - Structured output with sections
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import GroqService from './groq.js';
import StorageService from './storage.js';

const log = logger.child('JobAdGenerator');

class JobAdGenerator {
  constructor() {
    this.groq = new GroqService();
    this.storage = new StorageService();
  }

  /**
   * Generate a full job ad from a brief
   */
  async generateJobAd(params = {}) {
    const {
      jobTitle,
      company,
      sector,
      location,
      salaryMin,
      salaryMax,
      contractType = 'permanent',
      remote = false,
      keyResponsibilities = [],
      requiredSkills = [],
      benefits = [],
      companyDescription = '',
      additionalContext = '',
      format = 'full', // full, linkedin, short
    } = params;

    log.info('Generating job ad', { jobTitle, company, format });

    const prompt = this.buildJobAdPrompt(params);

    try {
      const result = await this.groq.client.chat.completions.create({
        messages: [
          { role: 'system', content: this.getJobAdSystemPrompt(format) },
          { role: 'user', content: prompt },
        ],
        model: this.groq.model,
        temperature: 0.5,
        max_tokens: format === 'short' ? 600 : 1500,
      });

      const content = result.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No job ad generated');
      }

      // Store the generated ad
      const ad = {
        id: `jobad_${Date.now()}`,
        jobTitle,
        company,
        format,
        content,
        params,
        createdAt: new Date().toISOString(),
      };

      await this.storeJobAd(ad);

      return {
        success: true,
        message: content,
        ad,
      };
    } catch (error) {
      log.error('Job ad generation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate multiple format variants of the same job ad
   */
  async generateVariants(params = {}) {
    const formats = ['full', 'linkedin', 'short'];
    const variants = {};

    for (const format of formats) {
      const result = await this.generateJobAd({ ...params, format });
      if (result.success) {
        variants[format] = result.message;
      }
    }

    return {
      success: Object.keys(variants).length > 0,
      variants,
    };
  }

  /**
   * Parse a natural language job ad request
   */
  parseJobAdRequest(text) {
    const parsed = {
      format: 'full',
    };

    // Extract job title - look for patterns like "for a [title]" or "[title] role/position/job"
    const titleMatch = text.match(/(?:for\s+(?:a|an)\s+)([^,]+?)(?:\s+(?:role|position|job|in\s))/i)
      || text.match(/(?:job\s+ad\s+(?:for|about)\s+(?:a|an)?\s*)([^,]+?)(?:\.|,|$|\s+at\s)/i);
    if (titleMatch) {
      parsed.jobTitle = titleMatch[1].trim();
    }

    // Extract company
    const companyMatch = text.match(/(?:at|for|with)\s+([A-Z][\w\s&]+?)(?:\.|,|$|\s+in\s)/i);
    if (companyMatch && companyMatch[1] !== parsed.jobTitle) {
      parsed.company = companyMatch[1].trim();
    }

    // Extract salary range
    const salaryMatch = text.match(/£([\d,]+)(?:k)?\s*(?:-|to)\s*£?([\d,]+)(?:k)?/i);
    if (salaryMatch) {
      parsed.salaryMin = salaryMatch[1].replace(',', '');
      parsed.salaryMax = salaryMatch[2].replace(',', '');
      // Handle 'k' shorthand
      if (parseInt(parsed.salaryMin) < 1000) parsed.salaryMin = String(parseInt(parsed.salaryMin) * 1000);
      if (parseInt(parsed.salaryMax) < 1000) parsed.salaryMax = String(parseInt(parsed.salaryMax) * 1000);
    }

    // Extract location
    const locationMatch = text.match(/(?:in|based\s+in|located?\s+in)\s+([A-Z][\w\s]+?)(?:\.|,|$|\s+£)/i);
    if (locationMatch) {
      parsed.location = locationMatch[1].trim();
    }

    // Detect contract type
    const lower = text.toLowerCase();
    if (lower.includes('contract') || lower.includes('freelance')) {
      parsed.contractType = 'contract';
    } else if (lower.includes('part time') || lower.includes('part-time')) {
      parsed.contractType = 'part_time';
    } else {
      parsed.contractType = 'permanent';
    }

    // Detect remote
    if (lower.includes('remote')) parsed.remote = true;
    if (lower.includes('hybrid')) parsed.hybrid = true;

    // Detect sector
    for (const sector of config.content.sectors) {
      if (lower.includes(sector.toLowerCase())) {
        parsed.sector = sector;
        break;
      }
    }

    // Detect format
    if (lower.includes('linkedin')) parsed.format = 'linkedin';
    else if (lower.includes('short') || lower.includes('brief')) parsed.format = 'short';

    // Pass full text as additional context
    parsed.additionalContext = text;

    return parsed;
  }

  // --- Prompt builders ---

  buildJobAdPrompt(params) {
    let prompt = 'Generate a professional job advertisement based on the following:\n\n';

    prompt += `Job Title: ${params.jobTitle || 'Not specified'}\n`;
    if (params.company) prompt += `Company: ${params.company}\n`;
    if (params.sector) prompt += `Sector: ${params.sector}\n`;
    if (params.location) prompt += `Location: ${params.location}\n`;
    if (params.remote) prompt += `Remote: Yes\n`;
    if (params.contractType) prompt += `Contract: ${params.contractType}\n`;

    if (params.salaryMin || params.salaryMax) {
      const min = params.salaryMin ? `£${Number(params.salaryMin).toLocaleString()}` : '';
      const max = params.salaryMax ? `£${Number(params.salaryMax).toLocaleString()}` : '';
      prompt += `Salary: ${min}${min && max ? ' - ' : ''}${max}\n`;
    }

    if (params.keyResponsibilities?.length > 0) {
      prompt += `\nKey Responsibilities:\n${params.keyResponsibilities.map(r => `- ${r}`).join('\n')}\n`;
    }

    if (params.requiredSkills?.length > 0) {
      prompt += `\nRequired Skills:\n${params.requiredSkills.map(s => `- ${s}`).join('\n')}\n`;
    }

    if (params.benefits?.length > 0) {
      prompt += `\nBenefits:\n${params.benefits.map(b => `- ${b}`).join('\n')}\n`;
    }

    if (params.companyDescription) {
      prompt += `\nAbout the company: ${params.companyDescription}\n`;
    }

    if (params.additionalContext) {
      prompt += `\nAdditional context: ${params.additionalContext}\n`;
    }

    prompt += `\nFormat: ${params.format}\n`;

    return prompt;
  }

  getJobAdSystemPrompt(format) {
    const basePrompt = `You are writing job advertisements for Tom Andrews, a UK-based recruitment specialist covering building materials, industrial engineering, M&E, minerals, aggregates, and construction.

Job ad principles:
- Clear, honest, and specific — no vague "competitive salary" if a range is given
- Sell the role and the company without being cringey
- Use proper UK English and UK terminology
- Avoid jargon unless sector-appropriate
- Structure with clear sections
- Include what the candidate actually gets, not just what you want from them
- Sound like a real recruiter wrote it, not an AI template
- Avoid discriminatory language
- Be direct about requirements — don't list 20 "essential" things

Sector knowledge: building materials, aggregates, minerals, industrial engineering, M&E, construction, wholesale, quarrying, heavy-side, and related sectors.`;

    const formatInstructions = {
      full: `\n\nFull format — structure with these sections:
1. Job Title and headline hook
2. About the Company (2-3 sentences)
3. The Role (summary paragraph)
4. Key Responsibilities (bullet points)
5. What You'll Need (requirements, be realistic)
6. What's On Offer (salary, benefits, growth)
7. How to Apply (brief CTA)`,

      linkedin: `\n\nLinkedIn format:
- Shorter and punchier than a job board ad
- Strong opening line that hooks scrollers
- Keep under 600 words
- Use line breaks for readability
- End with a clear CTA
- Include 3-5 relevant hashtags at the end`,

      short: `\n\nShort format for quick sharing:
- Under 200 words
- Cover: role, location, salary, key requirements, how to apply
- Punchy and scannable
- Works for text messages, WhatsApp, quick social shares`,
    };

    return basePrompt + (formatInstructions[format] || formatInstructions.full);
  }

  /**
   * Store generated job ad
   */
  async storeJobAd(ad) {
    try {
      const ads = await this.storage.get('generated_job_ads') || [];
      ads.unshift(ad);
      if (ads.length > 30) ads.splice(30);
      await this.storage.set('generated_job_ads', ads);
    } catch (error) {
      log.warn('Failed to store job ad', error);
    }
  }

  /**
   * Get recent job ads
   */
  async getRecentAds(count = 5) {
    const ads = await this.storage.get('generated_job_ads') || [];
    return ads.slice(0, count);
  }
}

export default JobAdGenerator;
