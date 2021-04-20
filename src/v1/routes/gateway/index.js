const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const config = require('../../../../config.json');

module.exports = class Status extends Base {

  constructor() {
    super();

    this.use(this.middleware);
    this.register('get', '/auth', this.auth.bind(this));
    this.register('post', '/restart', this.restart.bind(this));
  }

  /**
   * Verify the user can preform requests
   * @param req {any} Request
   * @param res {any} Response
   */
  async auth(req, res) {
    if (!req.authInfo.auth) {
      res.status(200).json({ auth: false });
      return;
    }
    if (!config.admins.includes(req.authInfo.userID) && !req.authInfo.isBot) {
      res.status(200).json({ auth: false });
      return;
    }
    res.status(200).json({ auth: true });
  }

  /**
   * POST the restart route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async restart(req, res) {
    if (!req.authInfo.auth) {
      res.status(500).json({ auth: false, error: 'Authentication error' });
      return;
    }
    if (!config.admins.includes(req.authInfo.userID) && !req.authInfo.isBot) {
      res.status(200).json({ auth: false });
      return;
    }

    if (req.app.locals.gw.connected) {
      req.app.locals.gw.restart(Object.assign(req.body, { restarter: req.authInfo.userID, panel: true }));
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ error: 'Gateway not connected' });
    }
  }

  middleware (req, res, next) {
    let userID;
    let isBot;
    let auth;
    try {
      let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      userID = data.userID;
      isBot = !!data.bot;
      auth = isBot;
    } catch(e) {
      auth = false;
    }

    req.authInfo = { isBot, userID, auth };
    next();
  }

};
