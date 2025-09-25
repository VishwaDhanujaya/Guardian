const { Router } = require("express");
const AuthorisationMiddleware = require("../middleware/authorization.middleware");

const reportsRouter = require("./reports.route");
const lostArticlesRouter = require("./lost-articles.route");
const authenticationRouter = require("./authentication.route");
const mapBoxRouter = require("./map-box.route");
const fileRouter = require("./files.route");
const alertsRouter = require("./alerts.route");
const dialogflowRouter = require("./dialogflow.route");
const notesRouter = require("./notes.route");
const LastSeenMiddleware = require("src/middleware/last-seen.middleware");
const mfaRouter = require("./mfa.route");

const router = Router();
const routerAuthenticated = Router();

routerAuthenticated.use(AuthorisationMiddleware);
routerAuthenticated.use(LastSeenMiddleware);

router.use("/api/v1/auth", authenticationRouter);
router.use("/api/v1/files", fileRouter);
router.use("/api/v1/mfa", mfaRouter);

routerAuthenticated.use("/api/v1/reports", reportsRouter);
routerAuthenticated.use("/api/v1/lost-articles", lostArticlesRouter);
routerAuthenticated.use("/api/v1/map-box", mapBoxRouter);
routerAuthenticated.use("/api/v1/alerts", alertsRouter);
routerAuthenticated.use("/api/v1/notes", notesRouter);
routerAuthenticated.use("/api/v1/dialogflow", dialogflowRouter);

router.use(routerAuthenticated);

module.exports = router;
