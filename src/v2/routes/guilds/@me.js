const Base = require('../../../structures/RouteV2');
const config = require('../../../../config');
const { auth } = require('../../middleware/auth');
const jwt = require('jsonwebtoken');

module.exports = class Feeds extends Base {

  // GET /guilds/@me (return a list of guilds the current user is in)
  async get (req, res) {
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
      if (err) {
        res.status(500).json({ error: err.stack || err.message });
        return;
      }

      if (req.app.locals.storedUsers.get(data.userID)) {
        res.status(200).json(req.app.locals.storedUsers.get(data.userID));
      } else {
        const guilds = await req.app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${data.access_token}`);
        let shared = await this.refreshUser(req.app, data.userID, guilds);
        res.status(200).json(guilds.filter(g => shared.includes(g.id)));
      }
    });
  }

  // Middleware
  getMiddleware (req, res, next) { return auth(req, res, next); }

};
