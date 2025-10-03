require("dotenv").config();

const configureGoogleCloudCredentials = require("./src/config/google-cloud");

configureGoogleCloudCredentials();

process.env.NODE_PATH = process.env.NODE_PATH || ".";
require("node:module").Module._initPaths();
require("./src/server");
