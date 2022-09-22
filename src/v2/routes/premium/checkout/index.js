const Route = require('../../../../structures/RouteV2');
const config = require('../../../../../config');
const stripe = require('stripe')(config.stripeKey);
const auth = require('../../../middleware/auth');

module.exports = class PremiumCustomers extends Route {

  // POST /premium/checkout (creates a new checkout and returns the checkout url)
  async post (req, res) {
    const product = config.stripeProducts[req.body.tier - 1];
    const session = await stripe.checkout.sessions.create({
      success_url: 'https://socialfeeds.app/premium/success',
      cancel_url: 'https://socialfeeds.app/premium/cancel',
      line_items: [
        { price: product.price, quantity: 1 }
      ],
      allow_promotion_codes: true,
      mode: 'subscription',
      metadata: {
        userID: req.body.userID,
        guildID: req.body.guildID
      }
    });

    res.status(200).json({ url: session.url });
  }

  postMiddleware (...args) { return auth.auth(...args); }

};
