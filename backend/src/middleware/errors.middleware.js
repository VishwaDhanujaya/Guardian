const errorService = require("../services/error-service");
const defaultLogger = require("../config/logging");
const HttpError = require("../utils/http-error");
const { CriticalError } = require("../utils/critical-error");

/**
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function HttpErrorMiddleware(err, req, res, next) {
  if (err instanceof CriticalError) {
    return next(err);
  }

  const httpError = errorService.handleError(err, req.id, req.path);
  httpError.handleLogging();
  return httpError.handleResponse(res);
}

module.exports = HttpErrorMiddleware;
