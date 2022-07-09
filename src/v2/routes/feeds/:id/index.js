const Route = require('../../../../structures/RouteV2');
const { auth } = require('../../../middleware/auth');

module.exports = class Feeds extends Route {

  async get (req, res) {
    // Parse query
    const query = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('opts.')) {
        query[`options.${key.substring(5)}`] = req.query[key];
      } else if (key !== 'page') {
        query[key] = req.query[key];
      }
    });

    // Calculate pages
    const feedCount = await req.app.locals.db.collection('feeds').countDocuments(Object.assign(query, { guildID: req.params.guildID }));
    const page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    const pages = Math.floor(feedCount / 50) + 1;

    let feeds = await req.app.locals.db.collection('feeds')
      .find(Object.assign(query, { guildID: req.params.guildID }))
      .skip(page > 0 ? page * 50 : 0)
      .limit(50)
      .toArray();

    if (!feeds[0]) {
      res.status(200).json({ feeds: [], feedCount, page: page + 1, pages });
      return;
    }

    let webhooks;
    try {
      webhooks = await req.app.locals.client.getGuildWebhooks(feeds[0].guildID);
    } catch (e) {
      res.status(500).json({ error: 'Please grant SocialFeeds the Manage Webhooks permission to allow the bot to work properly.' });
      return;
    }

    // Find old webhooks
    let oldWebhooks = [];
    feeds = feeds.map(feed => {
      let webhook = webhooks.find(w => w.id === feed.webhook_id);
      if (!webhook) {
        oldWebhooks.push(feed.webhook_id);
        return null;
      }

      return {
        type: feed.type,
        url: feed.url,
        channelID: webhook.channel_id,
        webhookID: feed.webhook_id,
        webhookToken: feed.webhook_token,
        options: feed.options || {},
        display: feed.display || {}
      };
    }).filter(a => a);

    // Remove feeds under the broken webhooks
    oldWebhooks.forEach(async (webhookID) => {
      const inHooker = await req.app.locals.db.collection('feeds').find({ webhookID }).toArray();
      inHooker.forEach(async f => {
        await req.app.locals.db.collection('feeds').deleteOne({ _id: f._id });
      });
    });

    res.status(200).json({ feeds, feedCount, page: page + 1, pages });
  }

  // Middleware
  getMiddleware (...args) { return auth(...args); }

};
