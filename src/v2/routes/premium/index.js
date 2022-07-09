const Route = require('../../../structures/RouteV2');
const auth = require('../../middleware/auth');

module.exports = class PremiumCustomers extends Route {

  // GET /premium/status (return the premium status of a customer)
  async getStatus (req, res) {
    if (!req.authInfo.admin) {
      res.status(401).json({ error: 'You do not have access to this endpoint.' });
      return;
    }
    const status = await req.app.locals.db.collection('premium').findOne({ discordID: req.query.id });
    if (!status) {
      res.status(200).json({ isPremium: false });
    } else {
      res.status(200).json({ isPremium: true, ...status });
    }
  }

  // Middleware for all routes
  getStatusMiddleware(...args) { return auth.auth(...args); }

};
