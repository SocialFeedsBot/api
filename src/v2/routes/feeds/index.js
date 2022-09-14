const Base = require('../../../structures/RouteV2');
const constants = require('../../constants');
const { auth } = require('../../middleware/auth');

module.exports = class FeedInfo extends Base {

  // GET /feeds/ (returns a list of all the feeds)
  async get (req, res) {
    if (!req.authInfo.admin) {
      res.status(401).json({ error: 'You are not authorised to use this endpoint, nice try though.' });
      return;
    }
    const page = req.query.page ? parseInt(req.query.page) - 1 : 0;

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
    const feedCount = await req.app.locals.db.collection('feeds').countDocuments(query);
    const pages = Math.floor(feedCount / constants.FEED_LIMIT_PAGE) + 1;

    // Get data for that page
    let feeds = await req.app.locals.db.collection('feeds').find(query)
      .skip(page > 0 ? page * constants.FEED_LIMIT_PAGE : 0)
      .limit(constants.FEED_LIMIT_PAGE)
      .toArray();

    // Sort out data
    feeds = feeds.map(feed => ({
      type: feed.type,
      url: feed.url,
      guildID: feed.guildID,
      webhookID: feed.webhook_id,
      webhookToken: feed.webhook_token,
      options: feed.options || {},
      display: feed.display || {}
    }));

    // Send off data
    res.status(200).json({ feeds, page: page + 1, pages, feedCount });
  }

  // Middleware
  getMiddleware (...args) { return auth(...args); }

};

