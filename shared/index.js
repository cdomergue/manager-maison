/**
 * Point d'entrée principal pour les modules partagés
 */

const utils = require("./utils");
const dates = require("./dates");
const constants = require("./constants");
const recipes = require("./recipes");

module.exports = {
  ...utils,
  ...dates,
  ...constants,
  ...recipes,
};
