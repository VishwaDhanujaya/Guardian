const lostArticleService = require("../services/lost-articles.service");
const personalDetailsService = require("../services/personal-details.service");
const HttpResponse = require("../utils/http-response-helper");
const HttpError = require("../utils/http-error");

class LostArticlesController {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async create(req, res) {
    const lostArticle = await lostArticleService.create(
      req.files,
      req.body,
      req.user,
    );

    new HttpResponse(200, lostArticle).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async delete(req, res) {
    const { lostArticleId } = req.params;

    const deleted = await lostArticleService.deleteById(lostArticleId);

    if (!deleted) {
      return new HttpResponse(404).sendStatus(res);
    }

    new HttpResponse(204).sendStatus(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async deletePersonalDetails(req, res) {
    const { lostArticleId, personalDetailsId } = req.params;

    const deleted =
      await personalDetailsService.deleteLostArticlePersonalDetails(
        lostArticleId,
        personalDetailsId,
      );

    if (!deleted) {
      return new HttpResponse(404).sendStatus(res);
    }

    new HttpResponse(204).sendStatus(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getById(req, res) {
    const id = req.params.id;
    const isOfficer = Boolean(req.officer);
    const args = isOfficer ? [id, req.user, true] : [id, req.user];
    const lostArticle = await lostArticleService.getById(...args);

    if (!lostArticle) {
      return new HttpResponse(404).sendStatus(res);
    }

    new HttpResponse(200, lostArticle).json(res);
  }

  /**
   * @param {import('express').Response} res
   */
  async getAll(_, res) {
    const lostArticles = await lostArticleService.getAll();
    new HttpResponse(200, lostArticles).json(res);
  }

  async update(req, res) {
    const id = req.params.id;

    const updated = await lostArticleService.updateById(
      id,
      req.body,
      req.user,
      Boolean(req.officer),
    );

    if (!updated) {
      return new HttpResponse(404).sendStatus(res);
    }

    new HttpResponse(200, updated).json(res);
  }

  async updateStatus(req, res) {
    const id = req.params.id;

    const updated = await lostArticleService.updateStatus(
      id,
      req.body?.status,
      req.user,
      Boolean(req.officer),
    );

    if (!updated) {
      return new HttpResponse(404).sendStatus(res);
    }

    new HttpResponse(200, updated).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createPersonalDetails(req, res) {
    const id = req.params.id;
    const canModifyLostArticle = await lostArticleService.canModify(
      id,
      req.user,
    );

    if (!canModifyLostArticle) {
      throw new HttpError({ code: 401 });
    }

    const personalDetails =
      await personalDetailsService.createLostArticlePersonalDetails(
        req.body,
        id,
      );
    new HttpResponse(200, personalDetails).json(res);
  }
}

const lostArticlesControler = new LostArticlesController();

module.exports = lostArticlesControler;
