const Route = require('../../../../structures/RouteV2');
const auth = require('../../../middleware/auth');

module.exports = class PremiumCustomers extends Route {

  // GET /premium/customers (return a list of all customers)
  async get (req, res) {
    if (!req.authInfo.admin) {
      res.status(401).json({ error: 'You do not have access to this endpoint.' });
      return;
    }
    let customers = await req.app.locals.db.collection('premium').find().toArray();
    res.status(200).json(customers.map(c => ({
      userID: c.userID,
      guildID: c.guildID,
      amountPaid: c.amountPaid,
      status: c.status,
      expires: c.expires,
      tier: c.tier
    })));
    return;
  }

  // Middlewares
  getMiddleware(...args) { return auth.auth(...args); }

};
