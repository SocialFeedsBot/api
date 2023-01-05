const Base = require('../../../../structures/RouteV2');
const auth = require('../../../middleware/auth');

module.exports = class Guilds extends Base {

  // GET /guilds/@me (return a list of guilds the current user is in)
  async get (req, res) {
    const user = await auth.findUser(req.app, req.authInfo.userID);
    if (user) {
      res.status(200).json(user.guilds);
    } else {
      let guilds = await auth.refreshUser(req.app, req.authInfo.userID, req.authInfo.accessToken);
      res.status(200).json(guilds);
    }
  }

  // Middleware
  getMiddleware (req, res, next) { return auth.auth(req, res, next); }

};
