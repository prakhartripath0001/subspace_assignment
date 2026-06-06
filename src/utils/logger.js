'use strict';

/**
 * @file logger.js
 * @description Centralised Winston logger instance.
 *
 * Transports:
 *  - Console  : human-readable colorised output (all levels in dev, warn+ in prod)
 *  - File     : combined.log  – every log entry (info and above)
 *  - File     : error.log     – error-level entries only
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('message', { meta: 'value' });
 *   logger.warn('rate limited');
 *   logger.error('something broke', { err: error.message });
 */

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf, colorize, errors } = format;

/** Custom log line format: "2025-01-01 12:00:00 [INFO]: message {meta}" */
const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  // When an Error object is logged, prefer the stack trace for full context
  return `${ts} [${level.toUpperCase()}]: ${stack || message}${metaStr}`;
});

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  // Minimum level that will be handled; everything below is discarded
  level: isProduction ? 'warn' : 'debug',

  format: combine(
    // Capture stack traces when an Error instance is passed as metadata
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),

  transports: [
    // ── Console transport ─────────────────────────────────────────────────────
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    }),

    // ── Combined file transport (info+) ───────────────────────────────────────
    new transports.File({
      filename: 'logs/combined.log',
      level: 'info',
      maxsize: 5 * 1024 * 1024,  // 5 MB per file
      maxFiles: 5,                // keep last 5 rotated files
    }),

    // ── Error-only file transport ─────────────────────────────────────────────
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],

  // Prevent unhandled Winston errors from crashing the process
  exitOnError: false,
});

module.exports = logger;
