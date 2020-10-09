const router = module.exports = require('express').Router();
const jwt = require('jsonwebtoken');
const btoa = require('btoa');
const superagent = require('superagent');
const config = require('../../config');

router.post('/callback/:code', async (req, res) => {
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

  const { body: user } = await superagent.get('https://discord.com/api/v7/users/@me')
    .set('Authorization', `Bearer ${body.access_token}`);

  jwt.sign(Object.assign(body, { userID: user.id }), config.jwtSecret, { expiresIn: body.expires_in }, (err, token) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.status(200).json(token);
  });
});
