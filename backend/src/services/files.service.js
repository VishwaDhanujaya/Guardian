const z = require("zod");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { promises: fs } = require("node:fs");

const auditService = require("./audit.service");
const logger = require("../utils/logger");

const fileTokenSchema = z.object({
  sub: z.string(),
  exp: z.number(),
  actor: z.number().nullable().optional(),
});

class FilesService {
  /**
   * @param {string} token
   * @returns {{ filePath: string, actorId: number | null }}
   */
  getFileNameFromToken(token) {
    const payload = fileTokenSchema.parse(
      jwt.verify(token, process.env.JWT_FILES_SECRET),
    );
    return { filePath: payload.sub, actorId: payload.actor ?? null };
  }

  /**
   * @param {string} file_path
   * @param {number|null} actorId
   * @param {number} expiresInSeconds
   * @returns {string}
   */
  generateFileToken(file_path, actorId = null, expiresInSeconds = 60 * 10) {
    const fileAccessExp = Math.floor(Date.now() / 1000) + expiresInSeconds;

    return jwt.sign(
      { sub: file_path, exp: fileAccessExp, actor: actorId },
      process.env.JWT_FILES_SECRET,
    );
  }

  /**
   * Remove EXIF metadata and normalize the file in place.
   * @param {string} filePath
   */
  async sanitizeImage(filePath) {
    try {
      const buffer = await sharp(filePath).toBuffer();
      await fs.writeFile(filePath, buffer);
    } catch (error) {
      logger.error("image_sanitization_failed", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  async recordUpload(filePath, actorId) {
    await auditService.recordFileEvent({
      actorId,
      action: "upload",
      filePath,
    });
  }

  async recordDownload(filePath, actorId) {
    await auditService.recordFileEvent({
      actorId,
      action: "download",
      filePath,
    });
  }
}

const filesService = new FilesService();

module.exports = filesService;
