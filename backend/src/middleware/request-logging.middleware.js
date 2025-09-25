const { v4: uuidv4 } = require("uuid");
const defaultLogger = require("../config/logging");
const { request } = require("express");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function RequestLoggingMiddleware(req, res, next) {
  req.id = uuidv4();

  defaultLogger.info({
    time: new Date(),
    id: req.id,
    path: req.path,
    device: req.headers["user-agent"],
    hostname: req.hostname,
    httpVersion: req.httpVersion,
  });

  next();
}

module.exports = RequestLoggingMiddleware;
