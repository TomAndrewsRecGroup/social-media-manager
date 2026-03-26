/**
 * IvyLens Social Operator - Logging Module
 * Centralized logging utility for the entire system
 */

import config from '../config/index.js';

class Logger {
  constructor(module = 'System') {
    this.module = module;
    this.enabled = config.modes.enableLogging;
    this.debug = config.debug;
  }

  /**
   * Format log message with timestamp and module
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      ...(data && { data }),
    };
    
    if (config.isProduction) {
      return JSON.stringify(logEntry);
    }
    
    // Development-friendly format
    let output = `[${timestamp}] [${level}] [${this.module}] ${message}`;
    if (data) {
      output += '\n' + JSON.stringify(data, null, 2);
    }
    return output;
  }

  /**
   * Log info message
   */
  info(message, data = null) {
    if (!this.enabled) return;
    console.log(this.formatMessage('INFO', message, data));
  }

  /**
   * Log success message
   */
  success(message, data = null) {
    if (!this.enabled) return;
    console.log(this.formatMessage('SUCCESS', message, data));
  }

  /**
   * Log warning message
   */
  warn(message, data = null) {
    if (!this.enabled) return;
    console.warn(this.formatMessage('WARN', message, data));
  }

  /**
   * Log error message
   */
  error(message, error = null) {
    // Always log errors regardless of settings
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      ...(error.response && { response: error.response.data }),
    } : null;
    
    console.error(this.formatMessage('ERROR', message, errorData));
  }

  /**
   * Log debug message (only in debug mode)
   */
  debug(message, data = null) {
    if (!this.debug) return;
    console.log(this.formatMessage('DEBUG', message, data));
  }

  /**
   * Log API call
   */
  apiCall(service, endpoint, method = 'GET', data = null) {
    if (!this.enabled) return;
    this.info(`API Call: ${service}`, {
      endpoint,
      method,
      ...(data && { data }),
    });
  }

  /**
   * Log API response
   */
  apiResponse(service, status, data = null) {
    if (!this.enabled) return;
    const level = status >= 200 && status < 300 ? 'SUCCESS' : 'ERROR';
    const message = `API Response: ${service} - ${status}`;
    
    if (level === 'SUCCESS') {
      this.success(message, data);
    } else {
      this.error(message, data);
    }
  }

  /**
   * Log workflow start
   */
  workflowStart(workflow, params = null) {
    if (!this.enabled) return;
    this.info(`Workflow Started: ${workflow}`, params);
  }

  /**
   * Log workflow completion
   */
  workflowComplete(workflow, result = null) {
    if (!this.enabled) return;
    this.success(`Workflow Completed: ${workflow}`, result);
  }

  /**
   * Log workflow error
   */
  workflowError(workflow, error) {
    this.error(`Workflow Failed: ${workflow}`, error);
  }

  /**
   * Log Telegram command
   */
  telegramCommand(userId, command, args = null) {
    if (!this.enabled) return;
    this.info('Telegram Command Received', {
      userId,
      command,
      args,
    });
  }

  /**
   * Log post publication
   */
  postPublished(platform, postId, content) {
    if (!this.enabled) return;
    this.success(`Post Published: ${platform}`, {
      postId,
      contentLength: content.length,
      preview: content.substring(0, 100) + '...',
    });
  }

  /**
   * Log research results
   */
  researchComplete(topicsFound, topicsSelected) {
    if (!this.enabled) return;
    this.info('Research Complete', {
      topicsFound,
      topicsSelected,
    });
  }

  /**
   * Create a child logger with a specific module name
   */
  child(module) {
    return new Logger(`${this.module}:${module}`);
  }
}

// Create and export default logger instance
const logger = new Logger();

// Export both the class and instance
export { Logger };
export default logger;