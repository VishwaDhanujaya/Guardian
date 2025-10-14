const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai").default;
const chaiAsPromised = require("chai-as-promised").default;
const setupBaseModelStubs = require("../testing-utils/baseModelMocks");
const lostArticleService = require("src/services/lost-articles.service");
const personalDetailsService = require("src/services/personal-details.service");
const HttpError = require("src/utils/http-error");
const auditService = require("src/services/audit.service");

chai.use(sinonChai);
chai.use(chaiAsPromised);

const { expect } = chai;

describe("LostArticleService", () => {
  /** @type {import("../testing-utils/baseModelMocks").BaseModelStubs} */
  let baseModelStubs;

  beforeEach(() => {
    baseModelStubs = setupBaseModelStubs();
    sinon.stub(auditService, "recordIncidentEvent").resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getById", () => {
    it("returns the citizen's own lost item", async () => {
      const item = { id: 1, status: "PENDING" };
      baseModelStubs.findBy.resolves(item);
      sinon
        .stub(personalDetailsService, "findByLostArticleId")
        .resolves({ data: [{ id: 3 }] });

      const result = await lostArticleService.getById(1, 10);

      expect(baseModelStubs.findBy).to.have.been.calledOnceWithExactly(
        ["id", "user_id"],
        [1, 10],
      );
      expect(baseModelStubs.findById).to.not.have.been.called;
      expect(result).to.equal(item);
      expect(result.personal_details).to.deep.equal([{ id: 3 }]);
    });

    it("allows citizens to view returned items they do not own", async () => {
      baseModelStubs.findBy.resolves(null);
      const returnedItem = { id: 5, status: "FOUND" };
      baseModelStubs.findById.resolves(returnedItem);
      sinon
        .stub(personalDetailsService, "findByLostArticleId")
        .resolves({ data: [] });

      const result = await lostArticleService.getById(5, 42);

      expect(baseModelStubs.findBy).to.have.been.calledOnceWithExactly(
        ["id", "user_id"],
        [5, 42],
      );
      expect(baseModelStubs.findById).to.have.been.calledWithExactly(5);
      expect(result).to.equal(returnedItem);
      expect(result.personal_details).to.deep.equal([]);
    });

    it("denies access to non-returned items the citizen does not own", async () => {
      baseModelStubs.findBy.resolves(null);
      baseModelStubs.findById.resolves({ id: 7, status: "INVESTIGATING" });
      const personalDetailsStub = sinon.stub(
        personalDetailsService,
        "findByLostArticleId",
      );

      const result = await lostArticleService.getById(7, 21);

      expect(baseModelStubs.findById).to.have.been.calledWithExactly(7);
      expect(result).to.be.null;
      expect(personalDetailsStub).to.not.have.been.called;
    });
  });

  describe("canModify", () => {
    it("allows officers to modify returned items", async () => {
      const canModify = await lostArticleService.canModify(1, 2, true);
      expect(canModify).to.be.true;
    });

    it("denies citizens when the item has been found", async () => {
      baseModelStubs.findById.resolves({
        id: 7,
        status: "FOUND",
        user_id: 99,
      });

      const canModify = await lostArticleService.canModify(7, 99, false);

      expect(baseModelStubs.findById).to.have.been.calledWithExactly(7);
      expect(canModify).to.be.false;
    });

    it("allows citizens to modify their own active item", async () => {
      baseModelStubs.findById.resolves({
        id: 4,
        status: "PENDING",
        user_id: 55,
      });

      const canModify = await lostArticleService.canModify(4, 55, false);

      expect(canModify).to.be.true;
    });

    it("returns false when the item does not exist", async () => {
      baseModelStubs.findById.resolves(null);

      const canModify = await lostArticleService.canModify(11, 22, false);

      expect(canModify).to.be.false;
    });
  });

  describe("deleteById", () => {
    it("should delete lost article report and return true", async () => {
      baseModelStubs.deleteWhere.resolves({ lastID: 0, changes: 1 });

      const deleted = await lostArticleService.deleteById(1);

      expect(deleted).to.be.true;
    });

    it("should return false if lost article report not found", async () => {
      baseModelStubs.deleteWhere.resolves({ lastID: 0, changes: 0 });

      const deleted = await lostArticleService.deleteById(2);

      expect(deleted).to.be.false;
    });

    it("should throw if lostArticleId missing", async () => {
      await expect(lostArticleService.deleteById()).to.be.rejected;
    });

    it("should throw if lostArticleId is not a number", async () => {
      await expect(lostArticleService.deleteById("abc")).to.be.rejectedWith(
        HttpError,
        "lostArticleId must be included",
      );
    });

    it("should propagate errors", async () => {
      baseModelStubs.deleteWhere.rejects();

      await expect(lostArticleService.deleteById(1, 4)).to.rejected;
    });
  });
});
