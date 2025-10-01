const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai").default;
const chaiAsPromised = require("chai-as-promised").default;
const setupBaseModelStubs = require("../testing-utils/baseModelMocks");
const lostArticleService = require("src/services/lost-articles.service");
const personalDetailsService = require("src/services/personal-details.service");

chai.use(sinonChai);
chai.use(chaiAsPromised);

const { expect } = chai;

describe("LostArticleService", () => {
  /** @type {import("../testing-utils/baseModelMocks").BaseModelStubs} */
  let baseModelStubs;

  beforeEach(() => {
    baseModelStubs = setupBaseModelStubs();
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

    it("should propagate errors", async () => {
      baseModelStubs.deleteWhere.rejects();

      await expect(lostArticleService.deleteById(1, 4)).to.rejected;
    });
  });
});
