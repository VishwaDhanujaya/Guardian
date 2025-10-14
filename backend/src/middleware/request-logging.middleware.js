const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function RequestLoggingMiddleware(req, res, next) {
  req.id = uuidv4();

  logger.info("http_request", {
    time: new Date().toISOString(),
    id: req.id,
    path: req.path,
    method: req.method,
    device: req.headers["user-agent"],
    hostname: req.hostname,
    httpVersion: req.httpVersion,
    ip: req.ip,
  });

  next();
}

module.exports = RequestLoggingMiddleware;
