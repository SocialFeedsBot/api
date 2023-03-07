const Base = require('../../../../structures/RouteV2');
const superagent = require('superagent');
const config = require('../../../../../config');
const jwt = require('jsonwebtoken');

module.exports = class OAuth extends Base {

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
    const guilds = await req.app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${body.access_token}`);

    // Cache access token and user info
    await req.app.locals.redis.set(`api:tokens:${user.id}`, JSON.stringify(body), 'EX', body.expires_in);
    await req.app.locals.redis.set(`api:users:${user.id}`, JSON.stringify({ user, guilds }), 'EX', 60 * 5);
    await req.app.locals.redis.set(`api:refresh_tokens:${user.id}`, body.refresh_token);

    jwt.sign({ userID: user.id }, config.jwtSecret, { expiresIn: body.expires_in }, (err, token) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.status(200).json(token);
    });
  }

};
