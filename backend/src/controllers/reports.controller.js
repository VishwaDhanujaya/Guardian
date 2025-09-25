const personalDetailsService = require("../services/personal-details.service");
const reportsService = require("../services/reports.service");
const authenticationService = require("../services/authentication.service");
const HttpError = require("../utils/http-error");
const HttpResponse = require("../utils/http-response-helper");

class ReportsController {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async create(req, res) {
    const report = await reportsService.create(req.files, req.body, req.user);
    new HttpResponse(200, report).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getById(req, res) {
    const id = req.params.id;
    const report = await reportsService.getById(id);

    if (!report) {
      return new HttpResponse(404).sendStatus(res);
    }

    const canUserViewReport = await reportsService.canUserView(
      report,
      req.user,
    );
    if (!canUserViewReport) {
      return new HttpResponse(401).sendStatus(res);
    }

    new HttpResponse(200, report).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getAll(req, res) {
    const reports = await reportsService.getAll(req.officer ? null : req.user);
    new HttpResponse(200, reports).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createWitness(req, res) {
    const id = req.params.id;
    const canModifyReport = await reportsService.canModify(id, req.user);

    if (!canModifyReport) {
      throw new HttpError({ code: 401 });
    }

    const witness = await personalDetailsService.createReportWitness(
      req.body,
      id,
    );

    new HttpResponse(200, witness).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async deleteWitness(req, res) {
    const { reportId, witnessId } = req.params;

    const deleted = await personalDetailsService.deleteReportWitness(
      reportId,
      witnessId,
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
  async updateStatus(req, res) {
    const { id } = req.params;
    if (!req.officer) {
      throw new HttpError({ code: 401 });
    }
    const report = await reportsService.updateStatus(id, req.body);
    return new HttpResponse(200, report).json(res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async delete(req, res) {
    const { id } = req.params;
    if (!req.officer) {
      throw new HttpError({ code: 401 });
    }
    await reportsService.delete(id);
    return new HttpResponse(204).sendStatus(res);
  }
}

const reportsController = new ReportsController();

module.exports = reportsController;
