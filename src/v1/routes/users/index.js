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

      const { body: user } = await superagent.get('https://discord.com/api/v7/users/@me')
        .set('Authorization', `Bearer ${data.access_token}`);

      user.isAdmin = config.admins.includes(user.id) || undefined;

      res.status(200).json(user);
      return null;
    });
  }

};
