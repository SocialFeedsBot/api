const Route = require('../../../../structures/RouteV2');
const { auth } = require('../../../middleware/auth');
const config = require('../../../../../config');

module.exports = class Status extends Route {

  // GET /premium/:id (return premium status for a server)
  async get (req, res) {
    const isPremium = await req.app.locals.db.collection('premium').findOne({ guildID: req.params.id });
    let details, premium;
    if (isPremium) {
      details = config.premiumTiers[isPremium.tier - 1];
    }
    if (isPremium) {
      premium = {
        status: true,
        tier: isPremium.tier,
        expires: isPremium.expires,
        user: isPremium.userID,
        maxFeeds: details.maxFeeds
      };
    } else {
      premium = { status: false, maxFeeds: 30 };
    }

    res.status(200).json(premium);
  }

  // Middlewares
  getMiddleware(...args) { return auth(...args); }

};
