const Base = require('../../../../structures/RouteV2');
const config = require('../../../../../config');
const { auth, refreshUser } = require('../../../middleware/auth');
const jwt = require('jsonwebtoken');

module.exports = class Feeds extends Base {

  // GET /guilds/:id (return a specific guild)
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

      let guild = await auth.findGuild(req.app, data, req.params.id);
      if (guild.code) {
        res.status(guild.code).json(Object.assign(guild, { code: undefined }));
        return;
      }

      if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.status(200).json(guild);
    });
  }

  // GET /guilds/:id/channels (returns a guilds channels)
  async getChannels (req, res) {
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
      let userData = await req.app.locals.redis.get(`users:${data.userID}`);
      if (!userData) {
        const guilds = await req.app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${data.access_token}`);
        let shared = await refreshUser(req.app, data.userID, guilds);
        guild = guilds.filter(g => shared.includes(g.id)).filter(g => g.id === req.params.id)[0];
      } else {
        userData = JSON.parse(userData);
        guild = userData.guilds.filter(g => g.id === req.params.id)[0];
      }

      if (!guild) {
        res.status(404).json({ error: 'Unknown guild' });
        return;
      }

      const g = (await req.app.locals.gw.action('getGuild', { name: 'shards' }, { guildID: req.params.id })).flat();
      res.status(200).json(g);
    });
  }

  // Middleware
  getMiddleware (req, res, next) { return auth(req, res, next); }
  getChannelsMiddleware (req, res, next) { return auth(req, res, next); }

};
