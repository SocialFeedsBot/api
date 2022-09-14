const Route = require('../../../structures/RouteV2');
const auth = require('../../middleware/auth');
const config = require('../../../../config');
const stripe = require('stripe')(config.stripeKey);

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

  // POST /premium/checkout (creates a new checkout and returns the checkout url)
  async postCheckout (req, res) {
    const session = await stripe.checkout.sessions.create({
      success_url: 'https://socialfeeds.app/premium/success',
      cancel_url: 'https://socialfeeds.app/premium/cancel',
      line_items: [
        { price: 'price_1KqIMfEGjzOLL8A44xY7FJuo', quantity: 1 }
      ],
      allow_promotion_codes: true,
      mode: 'subscription',
      metadata: {
        userID: req.body.userID,
        guildID: req.body.guildID
      }
    });

    res.status(200).json({ url: session.url });
    return;
  }

  // POST /premium/webhook (handles all webhooks from stripe)
  async postWebhook (req, res) {
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
        await req.app.locals.db.collection('premium').insertOne(
          { _id: object.customer,
            userID: object.metadata.userID,
            guildID: object.metadata.guildID,
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

  // Middleware for all routes
  getStatusMiddleware(...args) { return auth.auth(...args); }

};
