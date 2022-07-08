/* Route base structure */
const express = require('express');

module.exports = class BaseRoute {

  constructor(path, logger) {
    this.router = express.Router();
  }

};
