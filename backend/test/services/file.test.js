const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai").default;
const chaiAsPromised = require("chai-as-promised").default;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const jwt = require("jsonwebtoken");
const filesService = require("../../src/services/files.service");

const { expect } = chai;

describe("FileService", () => {
  before(() => {
    process.env.JWT_FILES_SECRET = "fakeFileSecret";
  });

  describe("getFileNameFromToken", () => {
    it("should return filename and actor", () => {
      const fileNameToken = jwt.sign(
        {
          sub: "filename.example",
          actor: 45,
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        process.env.JWT_FILES_SECRET,
      );

      const { filePath, actorId } = filesService.getFileNameFromToken(
        fileNameToken,
      );

      expect(filePath).to.be.equal("filename.example");
      expect(actorId).to.be.equal(45);
    });
  });

  describe("generateFileToken", () => {
    it("should generate a valid jwt containing the filename", () => {
      const fileNameToken = filesService.generateFileToken(
        "filename.example",
        45,
        10,
      );

      const payload = jwt.decode(fileNameToken);

      expect(payload.sub).to.be.equal("filename.example");
      expect(payload.actor).to.be.equal(45);
      expect(payload.exp).to.be.equal(Math.floor(Date.now() / 1000) + 10);
    });
  });
});
