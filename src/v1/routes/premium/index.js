const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const config = require('../../../../config');

module.exports = class Premium extends Base {

  constructor() {
    super();

    this.register('get', '/customers', this.getCustomers.bind(this), this.auth.bind(this));
    this.register('put', '/customers', this.putCustomers.bind(this), this.auth.bind(this));
  }

  /**
   * GET the status route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async getCustomers (req, res) {
    let customers = await req.app.locals.db.collection('premium').find().toArray();
    res.status(200).json(customers.map(c => ({
      customerID: c.customerID,
      balance: c.balance,
      created: c.created,
      currency: c.currency,
      email: c.email
    })));
    return;
  }

  async putCustomers (req, res) {
    req.body.forEach(async (customer, id) => {
      const resp = await req.app.locals.db.collection('premium').updateOne({ customerID: { $eq: customer.customerID } },
        { $set: customer }, { upsert: true });
      console.log('[PREMIUM] Updating customer list, matched:', resp.matchedCount, ', modified:', resp.modifiedCount);
    });
    res.status(200).json({ success: true });
    return;
  }


  auth (req, res, next) {
    let userID;
    let isBot;
    let auth;
    try {
      let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      userID = data.userID;
      isBot = !!data.bot;
      auth = true;
    } catch(e) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      auth = false;
    }

    if (!auth) {
      res.status(401).json({ success: false, error: 'Unauthorised' });
      return;
    }

    if (!isBot && !config.admins.includes(userID)) {
      res.status(401).json({ success: false, error: 'Unauthorised' });
      return;
    }
    next();
  }
};
