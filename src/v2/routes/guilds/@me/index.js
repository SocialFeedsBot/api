const Base = require('../../../../structures/RouteV2');
const auth = require('../../../middleware/auth');

module.exports = class Guilds extends Base {

  // GET /guilds/@me (return a list of guilds the current user is in)
  async get (req, res) {
    // Get user
    const user = await auth.updateUser(req.app, req.authInfo.userID);
    if (!user) {
      res.status(401).json({ success: false, error: 'Not logged in or token expired, login again' });
      return;
    }

    res.status(200).json(user.guilds);
  }

  // Middleware
  getMiddleware (req, res, next) { return auth.auth(req, res, next); }

};
