/**
 * Point d'entrée principal pour les modules partagés
 */

const utils = require("./utils");
const dates = require("./dates");
const constants = require("./constants");

module.exports = {
  ...utils,
  ...dates,
  ...constants,
};
