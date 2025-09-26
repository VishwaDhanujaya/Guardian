const { STATUS_CODES } = require("node:http");
const HttpResponse = require("./http-response-helper");
const defaultLogger = require("../config/logging");

function getDefaultMessage(code) {
  if (!code) {
    return "Error";
  }

  return STATUS_CODES?.[code] || "Error";
}

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
    const fallbackMessage =
      clientMessage || err?.clientMessage || err?.message || getDefaultMessage(code);

    super(fallbackMessage);

    if (err) {
      this.stack = this.stack + `\n${err.stack}`;
      Error.captureStackTrace?.(this, this.constructor);
    }

    this.path = path;
    this.code = code;
    this.data = data;
    this.clientMessage = fallbackMessage;
    this.message = err?.message || fallbackMessage;
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
