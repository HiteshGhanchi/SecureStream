import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// 1. Local Development Format (Colorful and readable)
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    // If we pass an object to the logger, print it nicely
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// 2. Production Format (Strict JSON for Grafana/Prometheus later)
const prodFormat = combine(
  timestamp(),
  json()
);

export const logger = winston.createLogger({
  // Default to info, but allow environment variable override
  level: process.env.LOG_LEVEL || 'info', 
  // Switch format based on environment
  format: process.env.NODE_ENV === 'production' ? prodFormat : consoleFormat,
  transports: [
    new winston.transports.Console()
  ],
});