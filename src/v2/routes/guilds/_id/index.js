const Base = require('../../../../structures/RouteV2');
const config = require('../../../../../config.json');
const { auth, findGuild } = require('../../../middleware/auth');

module.exports = class Feeds extends Base {

  // GET /guilds/:id (return a specific guild)
  async get (req, res) {
    let guild = await findGuild(req.app, req.authInfo, req.params.id);
    if (guild.code) {
      res.status(guild.code).json(Object.assign(guild, { code: undefined }));
      return;
    }

    if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const isPremium = await req.app.locals.db.collection('premium').findOne({ guildID: guild.id });
    let details;
    if (isPremium) {
      details = config.premiumTiers[isPremium.tier - 1];
      guild.premium = {
        status: true,
        tier: isPremium.tier,
        expires: isPremium.expires,
        user: isPremium.userID,
        maxFeeds: details.maxFeeds
      };
    } else {
      guild.premium = {
        status: false,
        maxFeeds: 30
      };
    }

    res.status(200).json(guild);
  }

  // Middleware
  getMiddleware (req, res, next) { return auth(req, res, next); }

};
