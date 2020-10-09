const router = module.exports = require('express').Router();
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../config');

router.get('/@me', async (req, res) => {
  if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
    if (err) return res.status(401).json({ error: err.stack || err.message });

    const { body: user } = await superagent.get('https://discord.com/api/v7/users/@me')
      .set('Authorization', `Bearer ${data.access_token}`);

    res.status(200).json(user);
  });
});
