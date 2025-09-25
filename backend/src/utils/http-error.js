const HttpResponse = require("./http-response-helper");
const defaultLogger = require("../config/logging");

class HttpError extends Error {
  code;
  data;
  id;
  path;
  clientMessage;

  /**
   * @param {Object} param0
   * @param {number} [param0.code=500]
   * @param {string} [param0.clientMessage=""]
   * @param {{}} [param0.data={}]
   * @param {string} [param0.id=""]
   * @param {string} [param0.path=""]
   * @param {Error} [err=null]
   */
  constructor(
    { code = 500, clientMessage = "", data = {}, id = "", path = "" },
    err = null,
  ) {
    super(clientMessage || "");

    if (err) {
      this.stack = this.stack + `\n${err.stack}`;
      this.message = err.message;
      Error.captureStackTrace?.(this, this.constructor);
    }

    this.path = path;
    this.code = code;
    this.data = data;
    this.clientMessage = clientMessage;
  }

  /**
   * @param {import("express").Response} res
   */
  handleResponse(res) {
    new HttpResponse(
      this.code,
      { code: this.code, message: this.clientMessage, data: this.data },
      this.clientMessage,
    ).json(res);
  }

  handleLogging() {
    defaultLogger.log({
      date: new Date().toString(),
      level: "error",
      message: this.message,
      path: this.path,
    });
  }
}

module.exports = HttpError;
