const Route = require('../../../../structures/RouteV2');

module.exports = class Feeds extends Route {

  async get (req, res) {
    // Fix query
    const query = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('opts.')) {
        query[`options.${key.substring(5)}`] = req.query[key];
      } else if (key !== 'page') {
        query[key] = req.query[key];
      }
    });

    // Get all types of feeds.
    const feedCount = (await req.app.locals.db.collection('feeds').find(query).toArray()).length;
    const twitter = await req.app.locals.db.collection('feeds').countDocuments({ type: 'twitter' });
    const twitch = await req.app.locals.db.collection('feeds').countDocuments({ type: 'twitch' });
    const rss = await req.app.locals.db.collection('feeds').countDocuments({ type: 'rss' });
    const reddit = await req.app.locals.db.collection('feeds').countDocuments({ type: 'reddit' });
    const statuspage = await req.app.locals.db.collection('feeds').countDocuments({ type: 'statuspage' });
    const youtube = await req.app.locals.db.collection('feeds').countDocuments({ type: 'youtube' });
    const rblxGroup = await req.app.locals.db.collection('feeds').countDocuments({ type: 'roblox-group' });

    res.status(200).json({
      feedCount, twitter, twitch, rss, reddit, statuspage, youtube, rblxGroup
    });
  }

};
