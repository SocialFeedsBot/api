/* Feeds Route */
const Base = require('../../../structures/Route');
const superagent = require('superagent');
const jwt = require('jsonwebtoken');
const config = require('../../../../config.json');

module.exports = class Feeds extends Base {

  constructor() {
    super();

    this.use(this.auth);
    this.register('get', '/', this.getAll.bind(this));
    this.register('get', '/:guildID', this.getID.bind(this));
    this.register('post', '/', this.post.bind(this));
    this.register('delete', '/', this.delete.bind(this));
  }

  /**
   * GET all of the feeds in the database
   * @param req {any} Request
   * @param res {any} Response
   */
  async getAll(req, res) {
    if (!req.authInfo.isBot) return;
    const page = req.query.page ? parseInt(req.query.page) - 1 : 0;

    // Fix query
    const query = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('opts.')) {
        query[`options.${key.substring(5)}`] = req.query[key];
      } else if (key !== 'page') {
        query[key] = req.query[key];
      }
    });

    // Calculate pages
    const feedCount = (await req.app.locals.db.collection('feeds').find(query).toArray()).length;
    const pages = Math.floor(feedCount / 100) + 1;

    // Get data for that page
    let feeds = await req.app.locals.db.collection('feeds').find(query)
      .skip(page > 0 ? page * 100 : 0)
      .limit(100)
      .toArray();
    feeds = feeds.map(feed => ({
      type: feed.type,
      url: feed.url,
      guildID: feed.guildID,
      webhook: { id: feed.webhook_id, token: feed.webhook_token },
      options: feed.options || {}
    }));

    res.status(200).json({
      feeds,
      page: page + 1,
      pages,
      feedCount
    });
  }

  /**
   * GET feeds in a guild.
   * @param req {any} Request
   * @param res {any} Response
   */
  async getID(req, res) {
    let guild;
    if (!req.authInfo.isBot) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        res.status(403).json({ error: 'Not authenticated' });
        return;
      }

      guild = member.filter(({ id }) => id === req.params.guildID)[0];
      const hasPerms = this.checkPermissions(req, res, guild);
      if (!hasPerms) return;
    }

    const feedCount = (await req.app.locals.db.collection('feeds').find({ guildID: req.params.guildID }).toArray()).length;
    const page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    const pages = Math.floor(feedCount / 50) + 1;

    // Fix query
    const query = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('opts.')) {
        if (!query.options) query.options = {};
        query.options[key.substring(5)] = req.query[key];
      } else if (key !== 'page') {
        query[key] = req.query[key];
      }
    });

    let feeds = await req.app.locals.db.collection('feeds')
      .find(Object.assign(query, { guildID: req.params.guildID }))
      .skip(page > 0 ? page * 50 : 0)
      .limit(50)
      .toArray();

    if (!feeds[0]) {
      res.status(200).json({ feeds: [], feedCount, page: page + 1, pages });
      return;
    }

    const webhooks = await req.app.locals.client.getGuildWebhooks(feeds[0].guildID);
    feeds = feeds.map(feed => {
      let webhook = webhooks.find(w => w.id === feed.webhook_id);
      if (!webhook) return null;
      return {
        type: feed.type,
        url: feed.url,
        channelID: webhook.channel_id,
        webhook: { id: feed.webhook_id, token: feed.webhook_token },
        options: feed.options || {}
      };
    }).filter(a => a);

    res.status(200).json({ feeds, feedCount, page: page + 1, pages });
  }

  /**
   * POST to create a new feed.
   * @param req {any} Request
   * @param res {any} Response
   */
  async post(req, res) {
    const isValid = await this.verifyFeed(req, res);
    if (!isValid) return;

    let guild;
    if (!req.authInfo.isBot) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        res.status(403).json({ success: false, error: 'Not authenticated' });
        return;
      }

      guild = member.guilds.filter(({ id }) => id === req.body.guildID)[0];
      const hasPerms = this.checkPermissions(req, res, guild);
      if (!hasPerms) return;
    }

    let webhook;
    try {
      webhook = await this.createWebhook(req.app.locals.client, req.body.channelID);
    } catch(e) {
      res.status(403).json({ success: false, error: 'I do not have permissions to create webhooks.' });
      return;
    }

    await req.app.locals.db.collection('feeds').insertOne({
      webhook_id: webhook.id,
      webhook_token: webhook.token,
      type: req.body.type,
      url: req.body.url,
      guildID: req.body.guildID,
      options: req.body.options || {}
    });

    res.status(200).json({ success: true });
  }

  /**
   * DELETE a feed from a server.
   * @param req {any} Request
   * @param res {any} Response
   */
  async delete(req, res) {
    let guild;
    if (!req.authInfo.isBot) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        res.status(403).json({ success: false, error: 'Not authenticated' });
        return;
      }

      guild = member.filter(({ id }) => id === req.body.guildID);
      if (!guild) {
        res.status(404).json({ error: 'Unknown guild' });
        return;
      }

      if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    let document = await req.app.locals.db.collection('feeds').findOne({
      type: req.body.type,
      url: req.body.url,
      webhook_id: req.body.webhookID
    });
    if (!document) {
      res.status(404).json({ success: false, error: 'Feed is non existent' });
      return;
    }

    await req.app.locals.db.collection('feeds').deleteOne({ _id: document._id });
    res.status(200).json({ success: true });
  }

  /**
   * Verifies that the feed is actually valid.
   * @param req {any} Request
   * @param res {any} Response
   */
  async verifyFeed(req, res) {
    if (req.body.type === 'youtube') {
      try {
        await superagent.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${req.body.url}&key=${config.youtubeKey}`)
          .set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');
      } catch(err) {
        res.status(400).json({ success: false, error: err.response.body.error.message });
        return false;
      }
    } else if (req.body.type === 'twitter') {
      try {
        await new Promise((resolve, reject) => {
          req.app.locals.twitterClient.get('statuses/user_timeline', { screen_name: req.body.url, exclude_replies: true }, (error, tweets) => {
            if (error) reject(error);
            resolve(tweets);
          });
        });
      } catch(err) {
        console.log(err);
        res.status(400).json({ success: false, error: 'Invalid Twitter Account' });
        return false;
      }
    } else if (req.body.type === 'twitch') {
      const { body: { data } } = await superagent.get('https://api.twitch.tv/helix/users')
        .set('Authorization', `Bearer ${req.app.locals.twitchToken}`)
        .set('Client-ID', config.twitchClient)
        .query({ login: req.body.url });

      if (!data.length) {
        res.status(400).json({ success: false, error: 'Invalid Twitch Channel' });
      } else {
        req.body.options = Object.assign(req.body.options || {}, { user_id: data[0].id });
      }
    } else if (req.body.type === 'rss') {
      try {
        await superagent.get(req.body.url).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');
      } catch(err) {
        res.status(400).json({ success: false, error: 'Invalid RSS URL' });
        return false;
      }
    } else if (req.body.type === 'reddit') {
      try {
        const a = await superagent.get(`https://reddit.com/r/${req.body.url}/about.json`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
        if (a.body.data.over18 && !req.body.nsfw) {
          res.status(400).json({ success: false, error: 'Subreddit is over 18 and the specified channel is not an NSFW channel' });
        }
      } catch(err) {
        res.status(400).json({ success: false, error: 'Invalid Subreddit name' });
        return false;
      }
    }

    return true;
  }

  /**
   * Creates a webhook for a feed.
   * @param client {any} Eris client
   * @param channelID {string} Channel ID
   */
  async createWebhook(client, channelID) {
    const webhooks = await client.getChannelWebhooks(channelID);
    if (webhooks.length) {
      const webhook = webhooks.find(hook => hook.user.id === config.clientID);
      if (webhook) {
        return webhook;
      }
    }

    const user = await client.getRESTUser(config.clientID);
    const { body } = await superagent.get(user.dynamicAvatarURL('png'))
      .catch(err => console.error(err));
    const avatar = `data:image/png;base64,${body.toString('base64')}`;

    return client.createChannelWebhook(channelID, {
      name: 'DiscordFeeds',
      avatar: avatar
    }, 'Create Feed Webhook');
  }

  /**
   * Middleware to verify the person sending the request is authorised to do so.
   * @param req {any} Request
   * @param res {any} Response
   * @param next {any} Next
   */
  auth(req, res, next) {
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
    req.authInfo = { isBot, userID };
    next();
  }

  /**
   * Check if the user can manage the guild.
   * @param req {any} Request
   * @param res {any} Response
   * @param guild {any} Guild
   */
  checkPermissions(req, res, guild) {
    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return false;
    }

    if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }

    return true;
  }

};
