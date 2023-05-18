const Base = require('../../../structures/RouteV2');
const { auth } = require('../../middleware/auth');
const config = require('../../../../config');

module.exports = class Gateway extends Base {

  // GET /gateway/auth (returns whether the user is authorised to use gateway functions)
  async getAuth (req, res) {
    if (!req.authInfo.isAuthorised) {
      res.status(200).json({ auth: false });
      return;
    }
    if (!config.admins.includes(req.authInfo.userID) && !req.authInfo.isBot) {
      res.status(200).json({ auth: false });
      return;
    }
    res.status(200).json({ auth: true });
  }

  // POST /gateway/restart (restarts selected services)
  async postRestart (req, res) {
    if (!req.authInfo.isAuthorised) {
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

  // Middleware
  getAuthMiddleware (req, res, next) { return auth(req, res, next); }
  postRestartMiddleware (req, res, next) { return auth(req, res, next); }

};
