/* Users Route */
const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../../../config.json');

module.exports = class Users extends Base {

  constructor() {
    super();

    this.register('get', '/@me', this.get.bind(this));
  }

  /**
   * GET the current user.
   * @param req {any} Request
   * @param res {any} Response
   */
  async get(req, res) {
    if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
      if (err) return res.status(401).json({ error: err.stack || err.message });

      let user;
      try {
        user = await req.app.locals.discordRest.api.users('@me').get(null, null, `Bearer ${data.access_token}`);
      } catch(e) {
        req.app.locals.logger.warn(`User info fetch error (${e.message}), refreshing token`);
        const { body: refreshToken } = await superagent.post('https://discord.com/api/v8/oauth2/token')
          .set('Authorization', `Basic ${Buffer.from(`${config.clientID}:${config.clientSecret}`).toString('base64')}`)
          .send({ grant_type: 'refresh_token', refresh_token: data.refresh_token });

        user = await req.app.locals.discordRest.api.users('@me').get(null, null, `Bearer ${data.access_token}`);
        jwt.sign(Object.assign(refreshToken, { userID: user.id }), config.jwtSecret, { expiresIn: refreshToken.expires_in }, (error, token) => {
          if (error) {
            res.status(500).json({ error: err.message });
            return;
          }
        });
      }

      user.isAdmin = config.admins.includes(user.id) || undefined;

      res.status(200).json(user);
      return null;
    });
  }

};
