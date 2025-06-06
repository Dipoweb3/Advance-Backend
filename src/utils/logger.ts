import winston from 'winston';
import path from 'path';

const logDir = 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'advancepay-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} [${level}]: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`
        )
      ),
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Create a stream object for Morgan
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Export a function to log errors with context
export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

// Export a function to log API requests
export const logApiRequest = (
  method: string,
  path: string,
  statusCode: number,
  responseTime: number,
  userAgent?: string
) => {
  logger.info('API Request', {
    method,
    path,
    statusCode,
    responseTime: `${responseTime}ms`,
    userAgent,
  });
}; 