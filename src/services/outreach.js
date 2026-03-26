/**
 * IvyLens Social Operator - Outreach Drafting Service
 * Feature 5: Generate candidate/client outreach messages in Tom's tone
 *
 * Supports:
 * - LinkedIn InMail drafts
 * - Email outreach drafts
 * - Follow-up messages
 * - Client introduction messages
 * - Candidate approach messages
 */

import config from '../config/index.js';
import logger from '../lib/logger.js';
import GroqService from './groq.js';
import StorageService, { STORAGE_KEYS } from './storage.js';

const log = logger.child('OutreachService');

class OutreachService {
  constructor() {
    this.groq = new GroqService();
    this.storage = new StorageService();
  }

  /**
   * Generate a candidate outreach message
   */
  async draftCandidateOutreach(params = {}) {
    const {
      candidateName,
      currentRole,
      currentCompany,
      targetRole,
      targetCompany,
      sector,
      salary,
      location,
      channel = 'linkedin', // linkedin, email
      tone = 'direct',
      additionalContext = '',
    } = params;

    log.info('Drafting candidate outreach', { candidateName, targetRole, channel });

    const prompt = this.buildCandidatePrompt({
      candidateName,
      currentRole,
      currentCompany,
      targetRole,
      targetCompany,
      sector,
      salary,
      location,
      channel,
      tone,
      additionalContext,
    });

    try {
      const result = await this.groq.client.chat.completions.create({
        messages: [
          { role: 'system', content: this.getCandidateOutreachSystemPrompt(channel) },
          { role: 'user', content: prompt },
        ],
        model: this.groq.model,
        temperature: 0.6,
        max_tokens: 800,
      });

      const content = result.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No outreach message generated');
      }

      // Store draft
      const draft = {
        id: `outreach_${Date.now()}`,
        type: 'candidate',
        channel,
        content,
        params,
        createdAt: new Date().toISOString(),
      };

      await this.storeDraft(draft);

      return {
        success: true,
        message: content,
        draft,
      };
    } catch (error) {
      log.error('Candidate outreach generation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a client outreach message
   */
  async draftClientOutreach(params = {}) {
    const {
      contactName,
      companyName,
      sector,
      purpose = 'introduction', // introduction, follow-up, proposal, check-in
      context = '',
      channel = 'email',
      tone = 'professional',
    } = params;

    log.info('Drafting client outreach', { contactName, companyName, purpose });

    const prompt = this.buildClientPrompt({
      contactName,
      companyName,
      sector,
      purpose,
      context,
      channel,
      tone,
    });

    try {
      const result = await this.groq.client.chat.completions.create({
        messages: [
          { role: 'system', content: this.getClientOutreachSystemPrompt(channel) },
          { role: 'user', content: prompt },
        ],
        model: this.groq.model,
        temperature: 0.6,
        max_tokens: 800,
      });

      const content = result.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No outreach message generated');
      }

      const draft = {
        id: `outreach_${Date.now()}`,
        type: 'client',
        channel,
        content,
        params,
        createdAt: new Date().toISOString(),
      };

      await this.storeDraft(draft);

      return {
        success: true,
        message: content,
        draft,
      };
    } catch (error) {
      log.error('Client outreach generation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a follow-up message
   */
  async draftFollowUp(params = {}) {
    const {
      recipientName,
      recipientType = 'candidate', // candidate or client
      previousContext,
      daysSinceLastContact = 7,
      channel = 'email',
    } = params;

    log.info('Drafting follow-up', { recipientName, recipientType });

    const prompt = `Write a follow-up message for ${recipientName}.

Type: ${recipientType}
Channel: ${channel}
Days since last contact: ${daysSinceLastContact}
Previous context: ${previousContext || 'General recruitment conversation'}

Requirements:
- Keep it short and natural
- Don't be pushy or desperate
- Reference the previous conversation naturally
- Include a clear next step or question
- Sound like Tom, not a generic recruiter
- UK English
${channel === 'linkedin' ? '- Keep under 300 characters for InMail' : '- Keep the email concise, under 150 words'}`;

    try {
      const result = await this.groq.client.chat.completions.create({
        messages: [
          { role: 'system', content: this.getCandidateOutreachSystemPrompt(channel) },
          { role: 'user', content: prompt },
        ],
        model: this.groq.model,
        temperature: 0.6,
        max_tokens: 500,
      });

      const content = result.choices[0]?.message?.content?.trim();

      const draft = {
        id: `outreach_${Date.now()}`,
        type: 'follow-up',
        channel,
        content,
        params,
        createdAt: new Date().toISOString(),
      };

      await this.storeDraft(draft);

      return { success: true, message: content, draft };
    } catch (error) {
      log.error('Follow-up generation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse a natural language outreach request
   */
  parseOutreachRequest(text) {
    const lower = text.toLowerCase();

    const parsed = {
      type: 'candidate',
      channel: 'linkedin',
      params: {},
    };

    // Detect type
    if (lower.includes('client') || lower.includes('company') || lower.includes('business')) {
      parsed.type = 'client';
    }

    // Detect channel
    if (lower.includes('email')) {
      parsed.channel = 'email';
    } else if (lower.includes('linkedin') || lower.includes('inmail')) {
      parsed.channel = 'linkedin';
    }

    // Detect purpose for client outreach
    if (lower.includes('follow up') || lower.includes('follow-up') || lower.includes('chase')) {
      parsed.purpose = 'follow-up';
    } else if (lower.includes('introduce') || lower.includes('introduction')) {
      parsed.purpose = 'introduction';
    } else if (lower.includes('proposal')) {
      parsed.purpose = 'proposal';
    }

    // Extract role mentions
    const roleMatch = text.match(/(?:for\s+(?:a|an)\s+)?(\w+(?:\s+\w+){0,3})\s+(?:role|position|job)/i);
    if (roleMatch) {
      parsed.params.targetRole = roleMatch[1];
    }

    // Extract salary
    const salaryMatch = text.match(/£([\d,]+(?:k)?)/i);
    if (salaryMatch) {
      parsed.params.salary = salaryMatch[1];
    }

    // Extract location
    const locationMatch = text.match(/(?:in|based\s+in|located\s+in)\s+([A-Z][\w\s]+?)(?:\.|,|$)/i);
    if (locationMatch) {
      parsed.params.location = locationMatch[1].trim();
    }

    // Extract sector
    for (const sector of config.content.sectors) {
      if (lower.includes(sector.toLowerCase())) {
        parsed.params.sector = sector;
        break;
      }
    }

    // Everything else becomes additional context
    parsed.params.additionalContext = text;

    return parsed;
  }

  // --- Prompt builders ---

  buildCandidatePrompt(params) {
    let prompt = 'Write a recruitment outreach message for a candidate.\n\n';

    if (params.candidateName) prompt += `Candidate: ${params.candidateName}\n`;
    if (params.currentRole) prompt += `Current role: ${params.currentRole}\n`;
    if (params.currentCompany) prompt += `Current company: ${params.currentCompany}\n`;
    if (params.targetRole) prompt += `Role we're recruiting for: ${params.targetRole}\n`;
    if (params.targetCompany) prompt += `Hiring company: ${params.targetCompany}\n`;
    if (params.sector) prompt += `Sector: ${params.sector}\n`;
    if (params.salary) prompt += `Salary: ${params.salary}\n`;
    if (params.location) prompt += `Location: ${params.location}\n`;

    prompt += `\nChannel: ${params.channel}\n`;
    prompt += `Tone: ${params.tone}\n`;

    if (params.additionalContext) {
      prompt += `\nAdditional context: ${params.additionalContext}\n`;
    }

    prompt += `\nRequirements:
- Sound like Tom Andrews, a real recruiter who knows this market
- Be direct and respectful of their time
- Don't use generic "exciting opportunity" language
- Be specific about why this could be interesting for them
- UK English
- ${params.channel === 'linkedin' ? 'Keep concise for LinkedIn InMail (under 300 words)' : 'Professional email format with subject line'}
- Include a clear, low-pressure call to action

Generate ONLY the message, no meta-commentary.`;

    return prompt;
  }

  buildClientPrompt(params) {
    let prompt = `Write a ${params.purpose} message to a client/prospect.\n\n`;

    if (params.contactName) prompt += `Contact: ${params.contactName}\n`;
    if (params.companyName) prompt += `Company: ${params.companyName}\n`;
    if (params.sector) prompt += `Sector: ${params.sector}\n`;

    prompt += `Purpose: ${params.purpose}\n`;
    prompt += `Channel: ${params.channel}\n`;

    if (params.context) {
      prompt += `\nContext: ${params.context}\n`;
    }

    prompt += `\nRequirements:
- Sound like Tom Andrews, a commercially sharp recruiter
- Be direct about what you can offer
- Show sector knowledge
- Don't grovel or over-sell
- UK English
- ${params.channel === 'linkedin' ? 'Keep concise for LinkedIn' : 'Professional email format with subject line'}
- Include a specific next step

Generate ONLY the message, no meta-commentary.`;

    return prompt;
  }

  getCandidateOutreachSystemPrompt(channel) {
    return `You are writing recruitment outreach messages as Tom Andrews, a UK-based recruitment specialist covering building materials, industrial engineering, M&E, minerals, aggregates, and construction.

Tom's outreach style:
- Direct and respectful
- Knows the market and shows it
- Doesn't waste people's time with vague "exciting opportunity" rubbish
- References specific reasons why the person might be interested
- Confident but not arrogant
- UK English, natural tone
- Avoids generic recruiter templates

${channel === 'linkedin' ? 'For LinkedIn: Keep it concise, personal, and easy to read on mobile.' : 'For email: Include a subject line on the first line, then the email body.'}`;
  }

  getClientOutreachSystemPrompt(channel) {
    return `You are writing business development messages as Tom Andrews, a UK-based recruitment specialist covering building materials, industrial engineering, M&E, minerals, aggregates, and construction.

Tom's BD style:
- Commercially sharp and confident
- Shows he understands the client's sector
- Focuses on what he can actually deliver
- Doesn't use empty sales language
- Direct, practical, professional
- UK English

${channel === 'linkedin' ? 'For LinkedIn: Keep it professional but conversational.' : 'For email: Include a subject line on the first line, then the email body.'}`;
  }

  /**
   * Store outreach draft
   */
  async storeDraft(draft) {
    try {
      const drafts = await this.storage.get('outreach_drafts') || [];
      drafts.unshift(draft);
      if (drafts.length > 50) drafts.splice(50);
      await this.storage.set('outreach_drafts', drafts);
    } catch (error) {
      log.warn('Failed to store outreach draft', error);
    }
  }

  /**
   * Get recent outreach drafts
   */
  async getRecentDrafts(count = 5) {
    const drafts = await this.storage.get('outreach_drafts') || [];
    return drafts.slice(0, count);
  }
}

export default OutreachService;
