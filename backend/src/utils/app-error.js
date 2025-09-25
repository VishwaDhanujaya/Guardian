const defaultLogger = require("../config/logging");

class AppError {
  /**
   * @param {Error} err
   * @param {string|null} [requestId=null]
   */
  static handleError(err, requestId = null) {
    this.log(err, requestId);
  }

  /**
   * Executes an synchronous function and catches any errors.
   *
   * @param {() => any} action
   */
  static trySync(action) {
    try {
      action();
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * Executes an asynchronous function and catches any errors.
   *
   * @async
   * @param {() => Promise<any>} action
   */
  static async try(action) {
    try {
      await action();
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * @param {Error} err
   * @param {string|null} [requestId=null]
   */
  static log(err, requestId = null) {
    const errObject = {
      date: new Date().toString(),
      level: "error",
      name: err.name,
      message: err.message,
    };
    if (requestId !== null) {
      errObject.id = requestId;
    }
    defaultLogger.log(errObject);
  }
}

module.exports = AppError;
