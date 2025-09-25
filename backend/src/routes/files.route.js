const { Router } = require("express");
const filesController = require("../controllers/files.controller");

const fileRouter = Router();

fileRouter.get("/", filesController.get);

module.exports = fileRouter;
