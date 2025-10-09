const z = require("zod");
const LostItemModel = require("../models/lost-item.model");
const ReportImagesModel = require("../models/report-images.model");
const personalDetailsService = require("./personal-details.service");
const HttpError = require("../utils/http-error");

class LostArticleService {
  articleValidation = z.object({
    name: z.string(),
    description: z.string(),
    serial_number: z.string().optional(),
    color: z.string().optional(),
    model: z.string().optional(),
    longitude: z.preprocess((val) => Number(val), z.number()),
    latitude: z.preprocess((val) => Number(val), z.number()),
    status: z.enum(["PENDING", "INVESTIGATING", "FOUND", "CLOSED"]),
    branch: z.string(),
  });

  articleUpdateValidation = this.articleValidation.partial();

  /**
   * @returns {Promise<LostItemModel>}
   */
  async create(files, body, user_id) {
    const {
      name,
      description,
      serial_number,
      color,
      model,
      longitude,
      latitude,
      status,
      branch,
    } = this.articleValidation.parse(body);
    const lostArticle = new LostItemModel(
      name,
      description,
      serial_number,
      color,
      model,
      longitude,
      latitude,
      status,
      branch,
      user_id,
    );

    await lostArticle.save();

    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        new ReportImagesModel(lostArticle.id, file.path).save();
      }
    }

    return lostArticle;
  }

  /**
   * @param {number} id
   * @param {number} user_id
   * @param {boolean} [is_officer=false]
   * @returns {Promise<LostItemModel | null>}
   */
  async getById(id, user_id, is_officer = false) {
    let result = is_officer
      ? await LostItemModel.findById(id)
      : await LostItemModel.findBy(["id", "user_id"], [id, user_id]);

    if (!result && !is_officer) {
      const fallback = await LostItemModel.findById(id);
      if (fallback && ["FOUND", "CLOSED"].includes(fallback.status)) {
        result = fallback;
      }
    }

    if (!result) {
      return null;
    }

    const personalDetails = await personalDetailsService.findByLostArticleId(id);
    result.personal_details = personalDetails.data;

    return result;
  }

  /**
   * @param {number} [limit=100]
   * @returns {Promise<LostItemModel[]>}
   */
  async getAll(limit = 100) {
    return await LostItemModel.all(limit);
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

    const lostArticle = await LostItemModel.findById(id);

    if (lostArticle && lostArticle.user_id === user_id) {
      return true;
    }
  }

  async updateById(id, body, user_id, is_officer = false) {
    if (!id || Number.isNaN(Number(id))) {
      throw new HttpError({ code: 400, clientMessage: "Invalid lost article id" });
    }

    const canModifyLostArticle = await this.canModify(id, user_id, is_officer);

    if (!canModifyLostArticle) {
      throw new HttpError({ code: 401 });
    }

    /** @type {LostItemModel | null} */
    const lostArticle = await LostItemModel.findById(id);

    if (!lostArticle) {
      return null;
    }

    const updateBody = this.articleUpdateValidation.parse(body ?? {});

    if (Object.keys(updateBody).length === 0) {
      return lostArticle;
    }

    if (updateBody.name !== undefined) {
      lostArticle.name = updateBody.name;
    }
    if (updateBody.description !== undefined) {
      lostArticle.description = updateBody.description;
    }
    if (updateBody.serial_number !== undefined) {
      lostArticle.serial_number = updateBody.serial_number;
    }
    if (updateBody.color !== undefined) {
      lostArticle.color = updateBody.color;
    }
    if (updateBody.model !== undefined) {
      lostArticle.model = updateBody.model;
    }
    if (updateBody.longitude !== undefined) {
      lostArticle.longitude = updateBody.longitude;
    }
    if (updateBody.latitude !== undefined) {
      lostArticle.latitude = updateBody.latitude;
    }
    if (updateBody.status !== undefined) {
      lostArticle.status = updateBody.status;
    }
    if (updateBody.branch !== undefined) {
      lostArticle.branch = updateBody.branch;
    }

    return await lostArticle.save();
  }

  async updateStatus(id, status, user_id, is_officer = false) {
    const statusValidation = z.enum([
      "PENDING",
      "INVESTIGATING",
      "FOUND",
      "CLOSED",
    ]);

    const parsedStatus = statusValidation.parse(status);

    const updated = await this.updateById(
      id,
      { status: parsedStatus },
      user_id,
      is_officer,
    );

    return updated;
  }

  /**
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    const numericId = Number(id);

    if (!id || Number.isNaN(numericId)) {
      throw new HttpError({
        code: 400,
        clientMessage: "lostArticleId must be included",
      });
    }

    const result = await LostItemModel.deleteWhere("id", numericId);

    return result?.changes !== 0;
  }
}

const lostArticleService = new LostArticleService();

module.exports = lostArticleService;
