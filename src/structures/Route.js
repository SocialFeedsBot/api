/* Route base structure */
const express = require('express');

module.exports = class BaseRoute {

  constructor() {
    this.router = express.Router();
  }

  register(method, route, func) {
    this.router[method](route, func);
  }

  use(func) {
    this.router.use(func);
  }

};
