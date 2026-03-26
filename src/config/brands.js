/**
 * IvyLens Social Operator - Multi-Brand Configuration
 * Feature 15: Foundation for multi-brand and future SaaS packaging
 *
 * Architecture:
 * - Each brand has its own config: tone, sectors, platforms, schedules, users
 * - A brand slug identifies it throughout the system
 * - The default brand is loaded from BRAND_SLUG env var or falls back to 'ivylens'
 * - New brands can be added to the brands map without touching core logic
 * - Future: brands stored in DB and loaded dynamically
 */

import config from './index.js';

/**
 * Brand definition schema
 */
const brandDefaults = {
  name: '',
  slug: '',
  owner: '',
  description: '',

  // Voice and tone
  tone: {
    style: 'direct',
    voice: 'commercial',
    approach: 'practical',
    ukEnglish: true,
    avoid: [],
    personality: '',
  },

  // Sectors this brand covers
  sectors: [],

  // Content focus areas
  focusAreas: [],

  // Platform configuration overrides
  platforms: {
    linkedin: { enabled: true },
    facebook: { enabled: true },
    instagram: { enabled: true },
    x: { enabled: true },
  },

  // Scheduling overrides
  scheduling: {
    timezone: 'Europe/London',
    postTimes: {},
  },

  // Authorised Telegram user IDs for this brand
  authorisedUsers: [],

  // Feature flags per brand
  features: {
    socialAutomation: true,
    outreachDrafting: true,
    jobAdGeneration: true,
    atsIntegration: false,
    businessTasks: false,
    approvalWorkflow: true,
  },
};

/**
 * Registered brands
 */
const brands = new Map();

// ─── Default brand: IvyLens (Tom Andrews) ────────────────────

brands.set('ivylens', {
  ...brandDefaults,
  name: 'IvyLens',
  slug: 'ivylens',
  owner: 'Tom Andrews',
  description: 'AI-powered recruitment operator for Tom Andrews',

  tone: {
    style: 'direct',
    voice: 'commercial',
    approach: 'practical',
    ukEnglish: true,
    avoid: [
      'generic motivational content',
      'AI-sounding copy',
      'corporate waffle',
      'fake statistics',
      'cliché recruitment advice',
      'American SaaS tone',
    ],
    personality: 'Blunt, witty, confident, commercially aware, no-nonsense operator',
  },

  sectors: [
    'UK recruitment',
    'building materials',
    'industrial engineering',
    'M&E engineering',
    'wholesale building materials',
    'minerals',
    'construction',
    'aggregates',
  ],

  focusAreas: [
    'hiring trends',
    'salary expectations',
    'skills shortages',
    'interview behaviour',
    'candidate behaviour',
    'employer behaviour',
    'market shifts',
    'recruitment frustrations',
    'hiring habits',
    'talent availability',
  ],

  platforms: {
    linkedin: { enabled: true },
    facebook: { enabled: true },
    instagram: { enabled: true },
    x: { enabled: true },
  },

  scheduling: {
    timezone: 'Europe/London',
    postTimes: {
      linkedin: ['09:00', '14:00'],
      facebook: ['10:00', '16:00'],
      instagram: ['12:00', '18:00'],
      x: ['08:00', '13:00', '17:00'],
    },
  },

  authorisedUsers: config.telegram.allowedUserIds,

  features: {
    socialAutomation: true,
    outreachDrafting: true,
    jobAdGeneration: true,
    atsIntegration: true,
    businessTasks: true,
    approvalWorkflow: true,
  },
});

// ─── Brand Manager ──────────────────────────────────────────

class BrandManager {
  constructor() {
    this.activeBrandSlug = process.env.BRAND_SLUG || 'ivylens';
  }

  /**
   * Get the currently active brand config
   */
  getActiveBrand() {
    return this.getBrand(this.activeBrandSlug);
  }

  /**
   * Get a brand by slug
   */
  getBrand(slug) {
    const brand = brands.get(slug);
    if (!brand) {
      throw new Error(`Brand not found: ${slug}`);
    }
    return brand;
  }

  /**
   * List all registered brands
   */
  listBrands() {
    return Array.from(brands.values()).map(b => ({
      name: b.name,
      slug: b.slug,
      owner: b.owner,
      sectors: b.sectors.length,
      platforms: Object.entries(b.platforms).filter(([_, v]) => v.enabled).length,
    }));
  }

  /**
   * Register a new brand
   */
  registerBrand(brandConfig) {
    const merged = { ...brandDefaults, ...brandConfig };

    if (!merged.slug || !merged.name) {
      throw new Error('Brand must have a slug and name');
    }

    if (brands.has(merged.slug)) {
      throw new Error(`Brand already exists: ${merged.slug}`);
    }

    brands.set(merged.slug, merged);
    return merged;
  }

  /**
   * Update an existing brand
   */
  updateBrand(slug, updates) {
    const existing = this.getBrand(slug);
    const updated = { ...existing, ...updates };
    brands.set(slug, updated);
    return updated;
  }

  /**
   * Switch active brand
   */
  switchBrand(slug) {
    if (!brands.has(slug)) {
      throw new Error(`Brand not found: ${slug}`);
    }
    this.activeBrandSlug = slug;
    return this.getActiveBrand();
  }

  /**
   * Check if a user is authorised for a brand
   */
  isUserAuthorisedForBrand(userId, brandSlug) {
    const brand = brands.get(brandSlug);
    if (!brand) return false;
    return brand.authorisedUsers.includes(userId.toString());
  }

  /**
   * Check if a feature is enabled for the active brand
   */
  isFeatureEnabled(featureName) {
    const brand = this.getActiveBrand();
    return brand.features[featureName] === true;
  }

  /**
   * Get tone config for active brand (used by Groq prompts)
   */
  getActiveTone() {
    return this.getActiveBrand().tone;
  }

  /**
   * Get sectors for active brand
   */
  getActiveSectors() {
    return this.getActiveBrand().sectors;
  }

  /**
   * Get scheduling config for active brand
   */
  getActiveScheduling() {
    return this.getActiveBrand().scheduling;
  }

  /**
   * Get formatted brand info for Telegram
   */
  getActiveBrandInfo() {
    const brand = this.getActiveBrand();
    const enabledPlatforms = Object.entries(brand.platforms)
      .filter(([_, v]) => v.enabled)
      .map(([k]) => k);

    const enabledFeatures = Object.entries(brand.features)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    let message = `🏢 *Active Brand: ${brand.name}*\n\n`;
    message += `*Owner:* ${brand.owner}\n`;
    message += `*Slug:* ${brand.slug}\n`;
    message += `*Sectors:* ${brand.sectors.length}\n`;
    message += `*Platforms:* ${enabledPlatforms.join(', ')}\n`;
    message += `*Timezone:* ${brand.scheduling.timezone}\n`;
    message += `\n*Enabled Features:*\n`;
    for (const f of enabledFeatures) {
      message += `✅ ${f}\n`;
    }
    message += `\n*Tone:* ${brand.tone.personality || brand.tone.style}`;

    return message;
  }
}

// Singleton
const brandManager = new BrandManager();

export { BrandManager, brandDefaults };
export default brandManager;
