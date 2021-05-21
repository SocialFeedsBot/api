/* OAuth Route */
const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const btoa = require('btoa');
const superagent = require('superagent');
const config = require('../../../../config.json');

module.exports = class Status extends Base {

  constructor() {
    super();

    this.register('post', '/callback/:code', this.post.bind(this));
  }

  /**
   * POST the callback to authorise.
   * @param req {any} Request
   * @param res {any} Response
   */
  async post (req, res) {
    const code = req.params.code;

    let body;
    try {
      body = (await superagent.post('https://discord.com/api/oauth2/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Authorization', `Basic ${btoa(`${config.clientID}:${config.clientSecret}`)}`)
        .send({
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${config.url}/callback`,
          scope: 'identify guilds'
        })).body;
    } catch (e) {
      res.status(500).json({ error: e.message });
      return;
    }

    const user = await req.app.locals.discordRest.api.users('@me').get(null, null, body.access_token);
    jwt.sign(Object.assign(body, { userID: user.id }), config.jwtSecret, { expiresIn: body.expires_in }, (err, token) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.status(200).json(token);
    });
  }

};
