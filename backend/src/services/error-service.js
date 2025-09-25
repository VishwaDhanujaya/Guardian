const z = require("zod");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");
const HttpError = require("../utils/http-error");

class ErrorService {
  /**
   * @param {Error} err
   * @param {string} path
   */
  handleError(err, id = "", path = "") {
    if (err instanceof z.ZodError) {
      err = this.handleZodError(err);
    }

    if (err instanceof jwt.TokenExpiredError) {
      err = this.handleJwtExpiredError();
    }

    if (err instanceof jwt.JsonWebTokenError) {
      err = this.handleJwtError();
    }

    err = this.handleSqliteErrors(err);

    return this.handleHttpError(err, id, path);
  }

  /**
   * @param {Error} err
   * @param {number} [code=500]
   * @param {string} [message="Internal Server Error"]
   * @param {{}} [body={}]
   */
  handleHttpError(
    err,
    id = "",
    path = "",
    code = 500,
    message = "Internal Server Error",
    body = {},
  ) {
    if (err instanceof HttpError) {
      err.id = id;
      err.path = path;
      return err;
    }

    return new HttpError(
      { code, clientMessage: message, data: body, path: path },
      err,
    );
  }

  /**
   * @param {Error} err
   */
  handleZodError(err) {
    return new HttpError({ code: 400, data: z.treeifyError(err) }, err);
  }

  /**
   * @param {jwt.JsonWebTokenError} err
   */
  handleJwtError(err) {
    return new HttpError({ code: 401 }, err);
  }

  handleJwtExpiredError() {
    return new HttpError({ code: 401, clientMessage: "Access Token Expired" });
  }

  /**
   * @param {Error} err
   */
  handleSqliteErrors(err) {
    if (err.errno && err.errno === sqlite3.CONSTRAINT) {
      return new HttpError({ code: 400, clientMessage: "Bad Request" }, err);
    }

    return err;
  }
}

const errorService = new ErrorService();

module.exports = errorService;
