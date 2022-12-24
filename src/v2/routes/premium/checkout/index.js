const Route = require('../../../../structures/RouteV2');
const config = require('../../../../../config');
const stripe = require('stripe')(config.stripeKey);
const auth = require('../../../middleware/auth');

/*
CHECKOUT SESSION COMPLETE, PAID: 200  META: { userID: '116293018742554625', guildID: '569870762568056832' }
SUBSCRIPTION CREATED, STATUS: incomplete  EXPIRES: 1671160521
SUBSCRIPTION UPDATED, STATUS: active  EXPIRES: 1671160521
SUBSCRIPTION DELETED, RAW: {
  id: 'sub_1M4c5uEGjzOLL8A4mM4kMIai',
  object: 'subscription',
  application: null,
  application_fee_percent: null,
  automatic_tax: { enabled: false },
  billing_cycle_anchor: 1668568521,
  billing_thresholds: null,
  cancel_at: null,
  cancel_at_period_end: false,
  canceled_at: 1668568559,
  collection_method: 'charge_automatically',
  created: 1668568521,
  currency: 'gbp',
  current_period_end: 1671160521,
  current_period_start: 1668568521,
  customer: 'cus_MoEZamJDHnuBHW',
  days_until_due: null,
  default_payment_method: 'pm_1M4c5tEGjzOLL8A4fVC6qyFl',
  default_source: null,
  default_tax_rates: [],
  description: null,
  discount: null,
  ended_at: 1668568559,
  items: {
    object: 'list',
    data: [ [Object] ],
    has_more: false,
    total_count: 1,
    url: '/v1/subscription_items?subscription=sub_1M4c5uEGjzOLL8A4mM4kMIai'
  },
  latest_invoice: 'in_1M4c5uEGjzOLL8A4W6SAkaJ6',
  livemode: false,
  metadata: {},
  next_pending_invoice_item_invoice: null,
  on_behalf_of: null,
  pause_collection: null,
  payment_settings: {
    payment_method_options: null,
    payment_method_types: null,
    save_default_payment_method: 'off'
  },
  pending_invoice_item_interval: null,
  pending_setup_intent: null,
  pending_update: null,
  plan: {
    id: 'price_1KqIMfEGjzOLL8A44xY7FJuo',
    object: 'plan',
    active: true,
    aggregate_usage: null,
    amount: 200,
    amount_decimal: '200',
    billing_scheme: 'per_unit',
    created: 1650379753,
    currency: 'gbp',
    interval: 'month',
    interval_count: 1,
    livemode: false,
    metadata: {},
    nickname: null,
    product: 'prod_LXN6vBluKMDRDw',
    tiers_mode: null,
    transform_usage: null,
    trial_period_days: null,
    usage_type: 'licensed'
  },
  quantity: 1,
  schedule: null,
  start_date: 1668568521,
  status: 'canceled',
  test_clock: null,
  transfer_data: null,
  trial_end: null,
  trial_start: null
}
*/

module.exports = class PremiumCustomers extends Route {

  // POST /premium/checkout (creates a new checkout and returns the checkout url)
  async post (req, res) {
    const tier = config.premiumTiers[req.body.tier - 1];
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

  postMiddleware (...args) { return auth.auth(...args); }

};
