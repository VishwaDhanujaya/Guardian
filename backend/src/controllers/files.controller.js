const filesService = require("../services/files.service");
const { resolve } = require("node:path");
const HttpError = require("../utils/http-error");

class FilesController {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async get(req, res) {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      throw new HttpError({ code: 400, clientMessage: "Signed token required" });
    }

    const { filePath, actorId } = filesService.getFileNameFromToken(token);
    await filesService.recordDownload(filePath, actorId);
    res.sendFile(resolve(filePath));
  }
}

const filesController = new FilesController();

module.exports = filesController;
