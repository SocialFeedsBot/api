const Base = require('../../../../structures/RouteV2');
const superagent = require('superagent');
const config = require('../../../../../config');
const jwt = require('jsonwebtoken');

module.exports = class Feeds extends Base {

  // POST /oauth/callback (gets an access token)
  async post (req, res) {
    const code = req.query.code;

    let body;
    try {
      body = (await superagent.post('https://discord.com/api/oauth2/token')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Authorization', `Basic ${Buffer.from(`${config.clientID}:${config.clientSecret}`).toString('base64')}`)
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

    const user = await req.app.locals.discordRest.api.users('@me').get(null, null, `Bearer ${body.access_token}`);
    jwt.sign(Object.assign(body, { userID: user.id }), config.jwtSecret, { expiresIn: body.expires_in }, (err, token) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.status(200).json(token);
    });
  }

};
