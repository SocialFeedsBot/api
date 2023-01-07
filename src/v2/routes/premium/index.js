const Route = require('../../../structures/RouteV2');
const config = require('../../../../config');
const auth = require('../../middleware/auth');

module.exports = class Premium extends Route {

  // POST /premium/ (set a customer)
  async post (req, res) {
    if (req.body.premium) {
      await req.app.locals.db.updateOne(
        { _id: `${req.body.server}-admin` },
        { $set: {
          tier: req.body.tier,
          guildID: req.body.server,
          userID: req.body.user,
          expires: Infinity,
          maxFeeds: config.premiumTiers[req.body.tier - 1].maxFeeds
        } }
      );
      res.status(200).json({ success: true });
    } else {
      await req.app.locals.db.deleteOne({ _id: `${req.body.server}-admin` });
      res.status(200).json({ success: true });
    }
  }

  // Middlewares
  postMiddleware(...args) { return auth.auth(...args); }

};
