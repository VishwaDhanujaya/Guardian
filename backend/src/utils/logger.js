const { createLogger, format, transports } = require("winston");

const monitoringService = require("../services/monitoring.service");

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  transports: [new transports.Console()],
});

function emitToMonitoring(level, message, meta) {
  try {
    monitoringService.emit(level, message, meta);
  } catch (error) {
    // Avoid recursive logging loops; fall back to console.
    console.error("Monitoring emit failed", error);
  }
}

const originalError = logger.error.bind(logger);
logger.error = (message, ...meta) => {
  emitToMonitoring("error", message, meta[0]);
  return originalError(message, ...meta);
};

const originalWarn = logger.warn.bind(logger);
logger.warn = (message, ...meta) => {
  emitToMonitoring("warn", message, meta[0]);
  return originalWarn(message, ...meta);
};

module.exports = logger;
