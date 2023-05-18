const Base = require('../../../../../structures/RouteV2');
const { updateUser, auth } = require('../../../../middleware/auth');

module.exports = class GuildChannels extends Base {

  // GET /guilds/:id/channels
  async get (req, res) {
    let userData = await updateUser(req.app, req.authInfo.userID);
    if (!userData) {
      res.status(401).json({ success: false, error: 'Not logged in or token expired, login again' });
      return;
    }

    let guild = userData.guilds.filter(g => g.id === req.params.id)[0];
    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return;
    }

    guild = (await req.app.locals.gw.action('getGuild', { name: 'shards' }, { guildID: req.params.id })).flat();
    res.status(200).json(guild);
  }

  getMiddleware (req, res, next) { return auth(req, res, next); }

};
