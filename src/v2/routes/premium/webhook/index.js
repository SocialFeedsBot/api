const Route = require('../../../../structures/RouteV2');
const config = require('../../../../../config');
const stripe = require('stripe')(config.stripeKey);

module.exports = class StripeWebhook extends Route {

  // POST /premium/webhook (handle stripe webhooks)
  async post (req, res) {
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
        await req.app.locals.db.collection('premium').updateOne(
          { _id: object.customer },
          { $set: {
            userID: object.metadata.userID,
            guildID: object.metadata.guildID,
            amountPaid: object.amount_total,
            status: object.status,
            expires: 0
          } },
          { $upsert: true }
        );
        req.app.locals.redis.hsetnx('states:premium:guilds', object.metadata.guildID, '');
        break;
      }

      case 'customer.subscription.created': {
        await req.app.locals.db.collection('premium').updateOne(
          { _id: object.customer },
          { $set: {
            expires: object.current_period_end,
            status: object.status,
            tier: config.premiumTiers.indexOf(config.premiumTiers.find(o => o.product === object.plan.product)) + 1
          } },
          { $upsert: true }
        );
        req.app.locals.redis.hsetnx('states:premium:guilds', object.metadata.guildID, '');
        break;
      }

      case 'customer.subscription.updated': {
        await req.app.locals.db.collection('premium').updateOne(
          { _id: object.customer },
          { $set: {
            expires: object.current_period_end,
            status: object.status,
            tier: config.premiumTiers.indexOf(config.premiumTiers.find(o => o.product === object.plan.product)) + 1
          } },
          { $upsert: true }
        );
        req.app.locals.redis.hsetnx('states:premium:guilds', object.metadata.guildID, '');
        break;
      }

      case 'customer.subscription.deleted': {
        await req.app.locals.db.collection('premium').deleteOne({ _id: event.data.object.customer });
        req.app.locals.redis.hdel('states:premium:guilds', object.metadata.guildID);
        break;
      }
    }


    res.status(200).json({ success: true });
  }

};
