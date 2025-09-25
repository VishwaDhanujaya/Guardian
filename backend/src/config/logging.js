const winston = require("winston");

const defaultLogger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: "http.log",
      level: "http",
    }),
    new winston.transports.File({
      filename: "error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

module.exports = defaultLogger;
