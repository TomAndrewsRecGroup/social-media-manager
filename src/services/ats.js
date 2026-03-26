/**
 * IvyLens Social Operator - ATS Integration Service (Manatal)
 * Feature 11: Connect to Manatal ATS for candidates, jobs, pipeline, and organisations
 *
 * Provides:
 * - Candidate search & lookup
 * - Job listing & details
 * - Pipeline/match status
 * - Organisation/client lookup
 * - Contact listing
 * - Notes creation on candidates, jobs, contacts, and organisations
 *
 * All methods return Telegram-friendly formatted messages as well as raw data.
 */

import axios from 'axios';
import config from '../config/index.js';
import logger from '../lib/logger.js';
import StorageService from './storage.js';

const log = logger.child('ATSService');

// ATS config — reads from env vars
const ATS_CONFIG = {
  baseUrl: process.env.MANATAL_API_URL || 'https://api.manatal.com/open/v3',
  apiKey: process.env.MANATAL_API_KEY || '',
};

class ATSService {
  constructor() {
    this.storage = new StorageService();

    if (!ATS_CONFIG.apiKey) {
      log.warn('MANATAL_API_KEY not set — ATS integration will not work');
    }

    this.client = axios.create({
      baseURL: ATS_CONFIG.baseUrl,
      timeout: 15000,
      headers: {
        'Authorization': `Token ${ATS_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if ATS is configured
   */
  isConfigured() {
    return !!ATS_CONFIG.apiKey;
  }

  // ─── Candidates ───────────────────────────────────────────

  /**
   * List candidates with optional filters
   */
  async listCandidates(filters = {}) {
    try {
      log.info('Listing candidates', filters);

      const params = {
        page_size: filters.limit || 10,
        page: filters.page || 1,
      };

      if (filters.name) params.full_name = filters.name;
      if (filters.position) params.current_position = filters.position;
      if (filters.company) params.current_company = filters.company;
      if (filters.sector) params.candidate_industries = filters.sector;
      if (filters.location) params.candidate_location = filters.location;
      if (filters.name) params.case_insensitive = true;

      const response = await this.client.get('/candidates/', { params });
      const data = response.data;

      return {
        success: true,
        candidates: data.results || [],
        total: data.count || 0,
        page: filters.page || 1,
      };
    } catch (error) {
      log.error('List candidates failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Get candidate details by ID
   */
  async getCandidate(id) {
    try {
      const response = await this.client.get(`/candidates/${id}/`);
      return { success: true, candidate: response.data };
    } catch (error) {
      log.error('Get candidate failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Add a note to a candidate
   */
  async addCandidateNote(candidateId, note) {
    try {
      await this.client.post(`/candidates/${candidateId}/notes/`, { info: note });
      return { success: true, message: 'Note added to candidate' };
    } catch (error) {
      log.error('Add candidate note failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ─── Jobs ─────────────────────────────────────────────────

  /**
   * List jobs with optional filters
   */
  async listJobs(filters = {}) {
    try {
      log.info('Listing jobs', filters);

      const params = {
        page_size: filters.limit || 10,
        page: filters.page || 1,
      };

      if (filters.status) params.status = filters.status;
      if (filters.position) params.position_name = filters.position;
      if (filters.city) params.city = filters.city;
      if (filters.remote !== undefined) params.is_remote = filters.remote;
      if (filters.contractType) params.contract_details = filters.contractType;

      const response = await this.client.get('/jobs/', { params });
      const data = response.data;

      return {
        success: true,
        jobs: data.results || [],
        total: data.count || 0,
        page: filters.page || 1,
      };
    } catch (error) {
      log.error('List jobs failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Get job details by ID
   */
  async getJob(id) {
    try {
      const response = await this.client.get(`/jobs/${id}/`);
      return { success: true, job: response.data };
    } catch (error) {
      log.error('Get job failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Add a note to a job
   */
  async addJobNote(jobId, note) {
    try {
      await this.client.post(`/jobs/${jobId}/notes/`, { info: note });
      return { success: true, message: 'Note added to job' };
    } catch (error) {
      log.error('Add job note failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ─── Pipeline / Matches ───────────────────────────────────

  /**
   * List matches (candidate-job pipeline entries)
   */
  async listMatches(filters = {}) {
    try {
      log.info('Listing matches', filters);

      const params = {
        page_size: filters.limit || 20,
        page: filters.page || 1,
      };

      if (filters.jobId) params.job_id = filters.jobId;
      if (filters.stage) params.stage__in = filters.stage;

      const response = await this.client.get('/matches/', { params });
      const data = response.data;

      return {
        success: true,
        matches: data.results || [],
        total: data.count || 0,
      };
    } catch (error) {
      log.error('List matches failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ─── Organisations (Clients) ──────────────────────────────

  /**
   * List organisations
   */
  async listOrganisations(filters = {}) {
    try {
      const params = {
        page_size: filters.limit || 10,
        page: filters.page || 1,
      };

      if (filters.name) params.name = filters.name;

      const response = await this.client.get('/organizations/', { params });
      const data = response.data;

      return {
        success: true,
        organisations: data.results || [],
        total: data.count || 0,
      };
    } catch (error) {
      log.error('List organisations failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * List contacts for an organisation
   */
  async listContacts(filters = {}) {
    try {
      const params = {
        page_size: filters.limit || 10,
        page: filters.page || 1,
      };

      if (filters.orgId) params.organization_id = filters.orgId;
      if (filters.name) params.full_name = filters.name;

      const response = await this.client.get('/contacts/', { params });
      const data = response.data;

      return {
        success: true,
        contacts: data.results || [],
        total: data.count || 0,
      };
    } catch (error) {
      log.error('List contacts failed', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ─── Summary / Dashboard ──────────────────────────────────

  /**
   * Get a pipeline summary for Telegram
   */
  async getPipelineSummary() {
    try {
      const [jobsResult, matchesResult] = await Promise.all([
        this.listJobs({ status: 'active', limit: 50 }),
        this.listMatches({ limit: 100 }),
      ]);

      if (!jobsResult.success) {
        return { success: false, error: jobsResult.error };
      }

      const activeJobs = jobsResult.total;
      const totalMatches = matchesResult.total;

      // Count recent hires (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentHires = (matchesResult.matches || []).filter(
        m => m.hired_at && m.hired_at > thirtyDaysAgo
      ).length;

      let message = '📊 *ATS Pipeline Summary*\n\n';
      message += `*Active Jobs:* ${activeJobs}\n`;
      message += `*Total Candidates in Pipeline:* ${totalMatches}\n`;
      message += `*Recent Hires (30d):* ${recentHires}\n`;

      // List active jobs
      if (jobsResult.jobs?.length > 0) {
        message += '\n*Active Roles:*\n';
        for (const job of jobsResult.jobs.slice(0, 10)) {
          const salary = job.salary_min && job.salary_max
            ? ` (£${Number(job.salary_min).toLocaleString()}-£${Number(job.salary_max).toLocaleString()})`
            : '';
          message += `• ${job.position_name}${salary}\n`;
        }
        if (jobsResult.total > 10) {
          message += `\n_...and ${jobsResult.total - 10} more_\n`;
        }
      }

      return { success: true, message };
    } catch (error) {
      log.error('Pipeline summary failed', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Telegram Formatters ──────────────────────────────────

  /**
   * Format candidates list for Telegram
   */
  formatCandidatesForTelegram(candidates, total) {
    if (!candidates || candidates.length === 0) {
      return '📭 No candidates found matching your criteria.';
    }

    let message = `👥 *Candidates* (${total} total)\n\n`;

    for (const c of candidates) {
      message += `*${c.full_name}*\n`;
      if (c.current_position) message += `  ${c.current_position}`;
      if (c.current_company) message += ` at ${c.current_company}`;
      message += '\n';
      if (c.email) message += `  📧 ${c.email}\n`;
      message += '\n';
    }

    return message;
  }

  /**
   * Format jobs list for Telegram
   */
  formatJobsForTelegram(jobs, total) {
    if (!jobs || jobs.length === 0) {
      return '📭 No jobs found matching your criteria.';
    }

    let message = `💼 *Jobs* (${total} total)\n\n`;

    for (const j of jobs) {
      message += `*${j.position_name}*`;
      if (j.status) message += ` [${j.status}]`;
      message += '\n';
      if (j.address) message += `  📍 ${j.address}\n`;
      if (j.salary_min && j.salary_max) {
        message += `  💰 £${Number(j.salary_min).toLocaleString()} - £${Number(j.salary_max).toLocaleString()}\n`;
      }
      if (j.contract_details) message += `  📋 ${j.contract_details}\n`;
      message += '\n';
    }

    return message;
  }

  /**
   * Format a single candidate for Telegram
   */
  formatCandidateDetailForTelegram(candidate) {
    let message = `👤 *${candidate.full_name}*\n\n`;

    if (candidate.current_position) message += `*Role:* ${candidate.current_position}\n`;
    if (candidate.current_company) message += `*Company:* ${candidate.current_company}\n`;
    if (candidate.email) message += `*Email:* ${candidate.email}\n`;
    if (candidate.phone_number) message += `*Phone:* ${candidate.phone_number}\n`;
    if (candidate.address) message += `*Location:* ${candidate.address}\n`;
    if (candidate.source_type) message += `*Source:* ${candidate.source_type}\n`;

    const created = candidate.created_at
      ? new Date(candidate.created_at).toLocaleDateString('en-GB')
      : null;
    if (created) message += `*Added:* ${created}\n`;

    return message;
  }

  // ─── Helpers ──────────────────────────────────────────────

  formatError(error) {
    if (error.response?.status === 401) return 'ATS authentication failed. Check MANATAL_API_KEY.';
    if (error.response?.status === 404) return 'Record not found in ATS.';
    if (error.response?.status === 429) return 'ATS rate limit hit. Try again shortly.';
    return error.message || 'ATS request failed';
  }
}

export default ATSService;
