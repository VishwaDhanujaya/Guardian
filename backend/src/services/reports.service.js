const z = require("zod");
const HttpError = require("../utils/http-error");
const { getTextPriority } = require("src/utils/local_priority_model");
const { withTransaction } = require("../config/database");

const ReportModel = require("../models/report.model");
const ReportImagesModel = require("../models/report-images.model");
const UserModel = require("../models/user.model");

const personalDetailsService = require("./personal-details.service");
const filesService = require("./files.service");
const auditService = require("./audit.service");

class ReportsService {
  ReportValidation = z.object({
    description: z.string(),
    longitude: z.preprocess((val) => Number(val), z.number()).optional(),
    latitude: z.preprocess((val) => Number(val), z.number()).optional(),
  });

  UpdateStatusValidation = z.object({
    status: z.enum(["PENDING", "IN-PROGRESS", "COMPLETED", "CLOSED"]),
  });

  /**
   * @param {File[]} files
   * @returns {Promise<ReportModel>}
   */
  async create(files, body, user_id) {
    return await withTransaction(async () => {
      const reportDetailsValidated = this.ReportValidation.parse(body);
      const report = new ReportModel(
        reportDetailsValidated.description,
        reportDetailsValidated.longitude,
        reportDetailsValidated.latitude,
        user_id,
        await getTextPriority(reportDetailsValidated.description),
      );

      await report.save();
      await auditService.recordIncidentEvent({
        actorId: user_id,
        incidentId: report.id,
        action: "create",
      });

      if (Array.isArray(files) && files.length > 0) {
        for (const file of files) {
          await filesService.sanitizeImage(file.path);
          await filesService.recordUpload(file.path, user_id);
          await new ReportImagesModel(report.id, file.path).save();
        }
      }

      return report;
    });
  }

  /**
   * @param {number} id
   * @return {Promise<ReportModel | null>}
   */
  async getById(id, requestingUserId = null) {
    if (!id) {
      throw new HttpError({ code: 400 });
    }

    const report = await ReportModel.findById(id);

    if (report === null) {
      return null;
    }

    const personalDetails = await personalDetailsService.findByReportId(id);

    report.witnesses = personalDetails;

    const imagePaths = await ReportImagesModel.findAllBy(
      "report_id",
      report.id,
    );

    if (imagePaths && Array.isArray(imagePaths)) {
      report.images = imagePaths.map((image) => {
        return filesService.generateFileToken(
          image.image_path,
          typeof requestingUserId === "number" ? requestingUserId : null,
        );
      });
    }

    return report;
  }

  /**
   * @param {number} id
   * @param {number} user_id
   * @param {boolean} [is_officer=false]
   */
  async canModify(id, user_id, is_officer = false) {
    if (is_officer) {
      return true;
    }

    const report = await ReportModel.findById(id);

    return report && report.user_id === user_id;
  }

  /**
   * @param {unknown} report
   * @param {number} user_id
   */
  async canUserView(report, user_id) {
    const user = await UserModel.findById(user_id);

    if (user === null) {
      return false;
    }

    return user.is_officer || report.user_id === user_id;
  }

  /**
   * @param {number} [limit=100]
   * @returns {Promise<ReportModel[]>}
   */
  async getAll(userId = null, limit = 100) {
    const orderByDesc = `ORDER BY priority DESC`;
    if (userId === null) {
      return await ReportModel.all(limit, orderByDesc);
    }

    return await ReportModel.findAllBy("user_id", userId, orderByDesc);
  }

  async updateStatus(id, body, actorId = null) {
    const validatedBody = this.UpdateStatusValidation.parse(body);

    /** @type {ReportModel|null}*/
    const report = await ReportModel.findById(id);
    if (!report) {
      throw new HttpError({ code: 404 });
    }

    report.status = validatedBody.status;
    const saved = await report.save();
    await auditService.recordIncidentEvent({
      actorId: actorId ?? report.user_id,
      incidentId: report.id,
      action: "status_update",
      metadata: { status: validatedBody.status },
    });
    return saved;
  }

  async delete(id, actorId = null) {
    await ReportModel.deleteWhere("id", id);
    await auditService.recordIncidentEvent({
      actorId,
      incidentId: id,
      action: "delete",
    });
  }
}

const reportsService = new ReportsService();

module.exports = reportsService;
