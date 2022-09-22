const Base = require('../../../../../structures/RouteV2');
const { refreshUser, auth } = require('../../../../middleware/auth');

module.exports = class GuildChannels extends Base {

  // GET /guilds/:id/channels
  async get (req, res) {
    let guild;
    let userData = await req.app.locals.redis.get(`users:${req.authInfo.userID}`);
    if (!userData) {
      const guilds = await req.app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${req.authInfo.accessToken}`);
      let shared = await refreshUser(req.app, req.authInfo.userID, req.authInfo.accessToken);
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
  }

  getMiddleware (req, res, next) { return auth(req, res, next); }

};
