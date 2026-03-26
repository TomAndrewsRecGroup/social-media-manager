/**
 * IvyLens Social Operator - Configuration Module
 * Central configuration management for the entire system
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment variable schema validation
const envSchema = z.object({
  // Telegram Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_USER_IDS: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  
  // API Keys
  GROQ_API_KEY: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  POSTFAST_API_KEY: z.string().min(1),
  
  // Vercel KV (optional for now)
  KV_URL: z.string().optional(),
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
  
  // Application
  APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CRON_SECRET: z.string().optional(),
  
  // Operating Modes
  DEFAULT_MODE: z.enum(['auto', 'draft', 'approval']).default('auto'),
  ENABLE_LOGGING: z.string().transform(val => val === 'true').default('true'),
  DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
});

// Validate environment variables
let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error.errors);
  process.exit(1);
}

// Parse allowed user IDs
const allowedUserIds = env.TELEGRAM_ALLOWED_USER_IDS.split(',').map(id => id.trim());

// Application configuration
const config = {
  // Environment
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  debug: env.DEBUG_MODE,
  
  // Application
  app: {
    url: env.APP_URL || 'http://localhost:3000',
    cronSecret: env.CRON_SECRET || 'default-cron-secret',
  },
  
  // Telegram
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN,
    allowedUserIds,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
  },
  
  // External APIs
  apis: {
    groq: {
      apiKey: env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile', // Using latest Groq model
      temperature: 0.7,
      maxTokens: 2000,
    },
    tavily: {
      apiKey: env.TAVILY_API_KEY,
      searchDepth: 'advanced',
      maxResults: 10,
    },
    postfast: {
      apiKey: env.POSTFAST_API_KEY,
      baseUrl: 'https://api.postfast.io', // Placeholder - update with actual URL
    },
  },
  
  // Database
  database: {
    kv: {
      url: env.KV_URL,
      restApiUrl: env.KV_REST_API_URL,
      restApiToken: env.KV_REST_API_TOKEN,
      readOnlyToken: env.KV_REST_API_READ_ONLY_TOKEN,
    },
  },
  
  // Operating Modes
  modes: {
    default: env.DEFAULT_MODE,
    enableLogging: env.ENABLE_LOGGING,
  },
  
  // Content Configuration
  content: {
    platforms: {
      linkedin: {
        enabled: true,
        maxLength: 3000,
        hashtagLimit: 5,
      },
      facebook: {
        enabled: true,
        maxLength: 63206,
        hashtagLimit: 3,
      },
      instagram: {
        enabled: true,
        maxLength: 2200,
        hashtagLimit: 30,
      },
      x: {
        enabled: true,
        maxLength: 280,
        hashtagLimit: 2,
      },
    },
    
    // Tom's business sectors
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
    
    // Content focus areas
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
    
    // Tom's tone preferences
    tonePreferences: {
      style: 'direct',
      voice: 'commercial',
      approach: 'practical',
      avoid: [
        'generic motivational content',
        'AI-sounding copy',
        'corporate waffle',
        'fake statistics',
        'cliché recruitment advice',
      ],
    },
  },
  
  // Scheduling Configuration
  scheduling: {
    timezone: 'Europe/London',
    defaultPostTimes: {
      linkedin: ['09:00', '14:00'],
      facebook: ['10:00', '16:00'],
      instagram: ['12:00', '18:00'],
      x: ['08:00', '13:00', '17:00'],
    },
    researchTime: '07:00',
  },
  
  // System Settings
  system: {
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
    timeout: 30000, // 30 seconds
    logRetention: 30, // days
  },
};

// Validate configuration at startup
function validateConfig() {
  const requiredKeys = [
    'telegram.botToken',
    'apis.groq.apiKey',
    'apis.tavily.apiKey',
    'apis.postfast.apiKey',
  ];
  
  for (const key of requiredKeys) {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
  
  if (config.telegram.allowedUserIds.length === 0) {
    throw new Error('No allowed Telegram user IDs configured');
  }
  
  console.log('✅ Configuration validated successfully');
}

// Run validation
validateConfig();

export default config;