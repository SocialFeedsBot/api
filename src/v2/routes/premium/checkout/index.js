const Route = require('../../../../structures/RouteV2');
const config = require('../../../../../config');
const stripe = require('stripe')(config.stripeKey);
const { auth } = require('../../../middleware/auth');

module.exports = class PremiumCustomers extends Route {

  // POST /premium/checkout (creates a new checkout and returns the checkout url)
  async post (req, res) {
    let tier = req.body.tier;
    if (req.body.period === 'year') {
      tier = req.body.tier + 4;
    }
    tier = config.premiumTiers[req.body.tier - 1];
    if (!tier) {
      res.status(500).json({ error: `Invalid premium tier (valid: 1-${config.premiumTiers.length})` });
      return;
    }
    const session = await stripe.checkout.sessions.create({
      success_url: `${config.url}/premium/success`,
      cancel_url: `${config.url}/premium/cancel`,
      line_items: [
        { price: tier.price, quantity: 1 }
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

  postMiddleware (...args) { return auth(...args); }

};
