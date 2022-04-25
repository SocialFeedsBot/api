const Base = require('../../../structures/Route');
const jwt = require('jsonwebtoken');
const config = require('../../../../config');

const stripe = require('stripe')(config.stripeKey);

module.exports = class Premium extends Base {

  constructor() {
    super();

    this.register('get', '/customers', this.getCustomers.bind(this), this.auth.bind(this));
    this.register('put', '/customers', this.putCustomers.bind(this), this.auth.bind(this));
    this.register('post', '/create-checkout', this.createCheckout.bind(this), this.auth.bind(this));
    this.register('get', '/status/:user', this.getStatus.bind(this), this.auth.bind(this));
    this.register('post', '/webhook', this.webhook.bind(this));
  }

  /**
   * GET the status route.
   * @param req {any} Request
   * @param res {any} Response
   */
  async getCustomers (req, res) {
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

  async putCustomers (req, res) {
    req.body.forEach(async (customer, id) => {
      const resp = await req.app.locals.db.collection('premium').updateOne({ customerID: { $eq: customer.customerID } },
        { $set: customer }, { upsert: true });
      console.log('[PREMIUM] Updating customer list, matched:', resp.matchedCount, ', modified:', resp.modifiedCount);
    });
    res.status(200).json({ success: true });
    return;
  }

  async createCheckout (req, res) {
    const session = await stripe.checkout.sessions.create({
      success_url: 'https://socialfeeds.app/premium/success',
      cancel_url: 'https://socialfeeds.app/premium/cancel',
      line_items: [
        { price: 'price_1KqIMfEGjzOLL8A44xY7FJuo', quantity: 1 }
      ],
      allow_promotion_codes: true,
      mode: 'subscription',
      metadata: {
        userID: req.userID
      }
    });

    res.redirect(303, session.url);
    return;
  }

  async getStatus (req, res) {
    const status = await req.app.locals.db.collection('premium').findOne({ discordID: req.params.user });
    if (!status) {
      res.status(200).json({ premium: false });
    } else {
      res.status(200).json({ premium: true, ...status });
    }
  }

  async webhook (req, res) {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, config.stripeWebhook);
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const object = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        // console.log(event.data.object);
        await req.app.locals.db.collection('premium').insertOne(
          { _id: object.customer,
            discordID: object.metadata.userID,
            amountPaid: object.amount_total,
            expires: 0
          },
          { $upsert: true }
        );
        break;
      }

      case 'customer.subscription.created': {
        await req.app.locals.db.collection('premium').updateOne(
          { _id: object.customer },
          { $set: {
            expires: object.current_period_end,
            subscriptionStatus: object.status,
            tier: config.stripeProducts.indexOf(object.plan.product) + 1
          } },
          { $upsert: true }
        );
        break;
      }

      case 'customer.subscription.updated': {
        await req.app.locals.db.collection('premium').updateOne(
          { _id: object.customer },
          { $set: {
            expires: object.current_period_end,
            subscriptionStatus: object.status,
            tier: config.stripeProducts.indexOf(object.plan.product) + 1
          } },
          { $upsert: true }
        );
        break;
      }

      case 'customer.subscription.deleted': {
        await req.app.locals.db.collection('premium').deleteOne({ _id: event.data.object.customer });
        break;
      }
    }


    res.status(200).json({ success: true });
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
    req.userID = userID;
    next();
  }
};
