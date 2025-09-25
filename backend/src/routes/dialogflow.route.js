const { Router } = require("express");
const dialogflowController = require("src/controllers/dialogflow.controller");

const dialogflowRouter = Router();

dialogflowRouter.post("/chat", dialogflowController.chat);

module.exports = dialogflowRouter;
