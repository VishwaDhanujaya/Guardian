const z = require("zod");
const PersonalDetailsModel = require("../models/personal-details.model");
const HttpError = require("../utils/http-error");

class PersonalDetailsService {
  PersonalDetailsValidation = z.object({
    first_name: z.string(),
    last_name: z.string(),
    date_of_birth: z.iso.date(),
    contact_number: z.string(),
  });

  ReportWitnessValidation = z.object({
    full_name: z.string().trim().min(1),
    contact_number: z.string().trim().min(1),
  });

  async create(body) {
    const { first_name, last_name, date_of_birth, contact_number } =
      this.PersonalDetailsValidation.parse(body);

    const personalDetails = new PersonalDetailsModel(
      first_name,
      last_name,
      date_of_birth,
      contact_number,
    );

    return await personalDetails.save();
  }

  /**
   *  @param {*} body
   *  @param {number} report_id
   *  @returns {Promise<PersonalDetailsModel>}
   */
  async createReportWitness(body, report_id) {
    const { full_name, contact_number } =
      this.ReportWitnessValidation.parse(body);

    const personalDetails = new PersonalDetailsModel(
      full_name,
      null,
      null,
      contact_number,
    );
    personalDetails.attachToReport(report_id);
    return await personalDetails.save();
  }

  /**
   *  @param {number} reportId
   *  @param {number} witnessId
   *  @returns {Promise<boolean>}
   */
  async deleteReportWitness(reportId, witnessId) {
    if (
      !reportId ||
      Number.isNaN(reportId) ||
      !witnessId ||
      Number.isNaN(witnessId)
    ) {
      throw new HttpError({
        code: 400,
        clientMessage: "ReportId and WitnessId must be included",
      });
    }

    const result = await PersonalDetailsModel.deleteWhere(
      ["id", "report_id"],
      [witnessId, reportId],
    );

    return result?.changes !== 0;
  }

  /**
   *  @param {number} reportId
   *  @param {number} personalDetailsId
   *  @returns {Promise<boolean>}
   */
  async deleteLostArticlePersonalDetails(lostArticleId, personalDetailsId) {
    if (
      !lostArticleId ||
      Number.isNaN(lostArticleId) ||
      !personalDetailsId ||
      Number.isNaN(personalDetailsId)
    ) {
      throw new HttpError({
        code: 400,
        clientMessage: "LostArticleId and WitnessId must be included",
      });
    }

    const result = await PersonalDetailsModel.deleteWhere(
      ["id", "lost_article_id"],
      [personalDetailsId, lostArticleId],
    );

    return result?.changes !== 0;
  }

  /**
   * @returns {Promise<PersonalDetailsModel>}
   */
  async createLostArticlePersonalDetails(body, lost_article_id) {
    const personalDetails = await this.create(body);
    personalDetails.attachToLostArticle(lost_article_id);
    return await personalDetails.save();
  }

  /**
   * @param {number} report_id
   * @returns {Promise<PersonalDetailsModel | null>}
   */
  async findByReportId(report_id) {
    return await PersonalDetailsModel.findAllBy("report_id", report_id);
  }

  /**
   * @param {number} lost_article_id
   */
  async findByLostArticleId(lost_article_id) {
    const result = await PersonalDetailsModel.findAllBy(
      "lost_article_id",
      lost_article_id,
    );

    return {
      error: false,
      code: 200,
      data: result,
    };
  }
}

const personalDetailsService = new PersonalDetailsService();

module.exports = personalDetailsService;
