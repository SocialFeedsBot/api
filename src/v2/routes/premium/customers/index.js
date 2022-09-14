const Route = require('../../../../structures/RouteV2');
const auth = require('../../../middleware/auth');

module.exports = class PremiumCustomers extends Route {

  // GET /premium/customers (return a list of all customers)
  async get (req, res) {
    if (!req.authInfo.admin) {
      res.status(401).json({ error: 'You do not have access to this endpoint.' });
      return;
    }
    let customers = await req.app.locals.db.collection('premium').find(req.query.stripe ? { stripe: true } : undefined).toArray();
    res.status(200).json(customers.map(c => ({
      customerID: c.customerID,
      balance: c.balance,
      created: c.created,
      currency: c.currency,
      email: c.email
    })));
    return;
  }

  // POST /premium/customers (bulk update all customers)
  async put (req, res) {
    if (!req.authInfo.admin) {
      res.status(401).json({ error: 'You do not have access to this endpoint.' });
      return;
    }
    req.body.forEach(async (customer) => {
      const resp = await req.app.locals.db.collection('premium').updateOne(
        { customerID: { $eq: customer.customerID } },
        { $set: customer }, { upsert: true }
      );
      req.app.locals.logger.debug('Updating customer list', { src: 'premium', matched: resp.matchedCount, modified: resp.modifiedCount });
    });
    res.status(200).json({ success: true });
    return;
  }

  // Middlewares
  getMiddleware(...args) { return auth.auth(...args); }
  putMiddleware(...args) { return auth.auth(...args); }

};
