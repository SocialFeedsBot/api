/* Route base structure */
const express = require('express');

module.exports = class BaseRoute {

  constructor(path) {
    this.router = express.Router();
  }

};
