// Constants
const Base = require('../../../../structures/RouteV2');
const jwt = require('jsonwebtoken');
const config = require('../../../../../config');

const auth = require('../../../middleware/auth');

module.exports = class Users extends Base {

  // Get the current user
  async get (req, res) {
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }

    // Verify token
    jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
      if (err) return res.status(401).json({ error: 'Not logged in or parsing error' });

      let user;
      try {
        user = await req.app.locals.discordRest.api.users('@me').get(null, null, `Bearer ${data.access_token}`);
      } catch(e) {
        // Couldn't fetch user, refresh token
        req.app.locals.logger.warn(`User info fetch error (${e.message}), requesting new token`);
        const refreshToken = await auth.refreshAccessToken(data.refresh_token);

        // Sign a new key
        user = await req.app.locals.discordRest.api.users('@me').get(null, null, `Bearer ${data.access_token}`);
        jwt.sign(Object.assign(refreshToken, { userID: user.id }), config.jwtSecret, { expiresIn: refreshToken.expires_in }, (error, token) => {
          if (error) {
            res.status(500).json({ error: err.message });
            return;
          }
        });

        res.headers['Access-Token'] = refreshToken.access_token;
      }

      user.admin = config.admins.includes(user.id) || undefined;
      res.status(200).json(user);
      return null;
    });
  }

};
