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
    if (err) {
      res.status(500).json({ error: err.stack || err.message });
      return;
    }

    if (req.app.locals.storedUsers.get(data.userID)) {
      res.status(200).json(req.app.locals.storedUsers.get(data.userID));
    } else {
      const { body: guilds } = await superagent.get('https://discordapp.com/api/v7/users/@me/guilds')
        .set('Authorization', `Bearer ${data.access_token}`);

      let shared = await req.app.locals.gw.requestSharedGuilds(guilds.map(g => g.id));
      shared = shared.result.flat();

      req.app.locals.storedUsers.set(data.userID, guilds.filter(g => shared.indexOf(g.id) !== -1));
      setTimeout(() => req.app.locals.storedUsers.delete(data.userID), 1 * 60 * 1000);

      res.status(200).json(guilds.filter(g => shared.indexOf(g.id) !== -1));
    }
  });
});

router.get('/:id', async (req, res) => {
  if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
    if (err) {
      res.status(500).json({ error: err.stack || err.message });
      return;
    }

    let guild;
    if (req.app.locals.storedUsers.get(data.userID)) {
      guild = req.app.locals.storedUsers.get(data.userID).filter(g => g.id === req.params.id)[0];
    } else {
      const { body: guilds } = await superagent.get('https://discordapp.com/api/v7/users/@me/guilds')
        .set('Authorization', `Bearer ${data.access_token}`);

      let shared = await req.app.locals.gw.requestSharedGuilds(guilds.map(g => g.id));
      shared = shared.result.flat();

      req.app.locals.storedUsers.set(data.userID, guilds.filter(g => shared.indexOf(g.id) !== -1));
      setTimeout(() => req.app.locals.storedUsers.delete(data.userID), 1 * 60 * 1000);

      guild = guilds.filter(g => shared.indexOf(g.id) !== -1).filter(g => g.id === req.params.id)[0];
    }

    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return;
    }

    if (!guild.permissions & 1 << 3 && !guild.permissions & 1 << 5) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(200).json(guild);
  });
});

router.get('/:id/channels', async (req, res) => {
  if (req.headers.authorization === 'null' || req.headers.authorization === 'undefined') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  jwt.verify(req.headers.authorization, config.jwtSecret, async (err, data) => {
    if (err) {
      res.status(500).json({ error: err.stack || err.message });
      return;
    }

    let guild;
    if (req.app.locals.storedUsers.get(data.userID)) {
      guild = req.app.locals.storedUsers.get(data.userID).filter(g => g.id === req.params.id)[0];
    } else {
      const { body: guilds } = await superagent.get('https://discordapp.com/api/v7/users/@me/guilds')
        .set('Authorization', `Bearer ${data.access_token}`);

      let shared = await req.app.locals.gw.requestSharedGuilds(guilds.map(g => g.id));
      shared = shared.result.flat();

      req.app.locals.storedUsers.set(data.userID, guilds.filter(g => shared.indexOf(g.id) !== -1));
      setTimeout(() => req.app.locals.storedUsers.delete(data.userID), 1 * 60 * 1000);

      guild = guilds.filter(g => shared.indexOf(g.id) !== -1).filter(g => g.id === req.params.id)[0];
    }

    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return;
    }

    const channels = (await req.app.locals.gw.request({ t: 'cluster', id: 'all' }, `this.guilds.get('${req.params.id}') ? this.guilds.get('${req.params.id}').channels.toJSON() : null`)).filter(c => c)[0];
    res.status(200).json(channels);
  });
});
