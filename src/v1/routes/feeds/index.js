/* Feeds Route */
const Base = require('../../../structures/Route');
const superagent = require('superagent');
const jwt = require('jsonwebtoken');
const config = require('../../../../config.json');

module.exports = class Feeds extends Base {

  constructor() {
    super();

    this.register('get', '/', this.getAll.bind(this), this.auth.bind(this));
    this.register('get', '/counts', this.getCounts.bind(this));
    this.register('get', '/:guildID', this.getID.bind(this), this.auth.bind(this));
    this.register('post', '/', this.post.bind(this), this.auth.bind(this));
    this.register('patch', '/', this.patch.bind(this), this.auth.bind(this));
    this.register('delete', '/', this.delete.bind(this), this.auth.bind(this));
  }

  /**
   * GET counts
   * @param req {any} Request
   * @param res {any} Response
   */
  async getCounts(req, res) {
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

    res.status(200).json({
      feedCount, twitter, twitch, rss, reddit, statuspage, youtube
    });
  }

  /**
   * GET all of the feeds in the database
   * @param req {any} Request
   * @param res {any} Response
   */
  async getAll(req, res) {
    if (!req.authInfo.isBot && !config.admins.includes(req.authInfo.userID)) {
      res.status(401);
      return;
    }
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
      webhookID: feed.webhook_id,
      webhookToken: feed.webhook_token,
      options: feed.options || {},
      display: feed.display
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
    if (!req.authInfo.isBot && !config.admins.includes(req.authInfo?.userID)) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        member = await this.refreshUser(req, req.authInfo.userID, req.authInfo.accessToken);
      }

      guild = member.filter(({ id }) => id === req.params.guildID)[0];
      const hasPerms = this.checkPermissions(req, res, guild);
      if (!hasPerms) {
        res.status(401);
        return;
      }
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

    let webhooks;
    try {
      webhooks = await req.app.locals.client.getGuildWebhooks(feeds[0].guildID);
    } catch (e) {
      res.status(501).json({ error: 'Missing Manage Webhooks permission.' });
      return;
    }
    let oldHookers = []; // yes, hookers
    feeds = feeds.map(feed => {
      let webhook = webhooks.find(w => w.id === feed.webhook_id);
      if (!webhook) {
        oldHookers.push(feed.webhook_id);
        return null;
      }
      return {
        type: feed.type,
        url: feed.url,
        channelID: webhook.channel_id,
        webhookID: feed.webhook_id,
        webhookToken: feed.webhook_token,
        options: feed.options || {},
        display: feed.display
      };
    }).filter(a => a);

    oldHookers.forEach(async (webhookID) => {
      const inHooker = await req.app.locals.db.collection('feeds').find({ webhookID }).toArray();
      inHooker.forEach(async f => {
        await req.app.locals.db.collection('feeds').deleteOne({ _id: f._id });
      });
    });

    res.status(200).json({ feeds, feedCount, page: page + 1, pages });
  }

  /**
   * POST to create a new feed.
   * @param req {any} Request
   * @param res {any} Response
   */
  async post(req, res) {
    const feedData = await this.verifyFeed(req, res);
    if (!feedData) return;

    let guild;
    if (!req.authInfo.isBot) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        member = await this.refreshUser(req, req.authInfo.userID, req.authInfo.accessToken);
      }

      guild = member.filter(({ id }) => id === req.body.guildID)[0];
      const hasPerms = this.checkPermissions(req, res, guild);
      if (!hasPerms) return;
    }

    let webhook;
    try {
      webhook = await this.createWebhook(req.app.locals.client, req.body.channelID);
    } catch(e) {
      if (e.message.includes('Maximum number of webhooks reached')) {
        res.status(403).json({ success: false, error: 'Maximum number of webhooks reached for this channel.' });
      } else if (e.message.includes('Missing Permissions')) {
        res.status(403).json({ success: false, error: 'I do not have permissions to create webhooks.' });
      } else {
        res.status(403).json({ success: false, error: `Unknown error: \`${e.message}\`` });
      }
      return;
    }

    if (req.body.dashboard) {
      await this.sendFeedMessage(req.app.locals.client, webhook, req.authInfo.userID, {
        ...req.body,
        display: feedData
      });
    }

    let posted = await req.app.locals.db.collection('feeds').find({
      type: req.body.type,
      url: req.body.url,
      guildID: req.body.guildID,
      webhook_id: webhook.id,
      webhook_token: webhook.token
    }).toArray();

    if (posted.length > 0) {
      res.status(403).json({ success: false, error: 'This feed has already been created, please delete it first.' });
      return;
    }

    await req.app.locals.db.collection('feeds').insertOne({
      webhook_id: webhook.id,
      webhook_token: webhook.token,
      type: req.body.type,
      url: req.body.url,
      guildID: req.body.guildID,
      options: req.body.options || {},
      display: feedData
    });
    req.app.locals.gw.action('feed_create', { name: 'ws' }, {
      guildID: req.body.guildID,
      channelID: webhook.channel_id,
      type: req.body.type,
      url: req.body.url,
      webhook: { id: webhook, token: webhook.token },
      options: req.body.options || {},
      display: feedData
    });

    res.status(200).json({ success: true, feedData });
  }

  /**
   * PATCH a feed.
   * @param {*} req {any} Request
   * @param {*} res {any} Response
   */
  async patch(req, res) {
    let guild;
    if (!req.authInfo.isBot && !req.authInfo.admin) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        member = await this.refreshUser(req, req.authInfo.userID, req.authInfo.accessToken);
      }

      guild = member.filter(({ id }) => id === req.body.guildID)[0];
      if (!guild) {
        res.status(404).json({ error: 'Unknown guild' });
        return;
      }

      if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    let document = await req.app.locals.db.collection('feeds').find({ webhook_id: req.body.webhookID }).toArray();
    document = document.filter(f => f.url.toLowerCase() === req.body.url.toLowerCase() &&
      f.type.toLowerCase() === req.body.type.toLowerCase())[0];

    if (!document) {
      res.status(404).json({ success: false, error: 'Feed is non existent' });
      return;
    }

    let id = document._id;

    document = {
      webhook_id: document.webhook_id,
      webhook_token: document.webhook_token,
      type: document.type,
      url: document.url,
      guildID: document.guildID,
      options: document.options || {}
    };
    let oldData = JSON.parse(JSON.stringify(document));

    if (req.body.newURL) {
      document.url = req.body.newURL;
      delete req.body.newURL;
    }
    Object.keys(req.body).forEach(key => {
      if (key === 'options') {
        Object.keys(req.body.options).forEach(option => {
          document.options[option] = req.body.options[option];
        });
      } else {
        document[key] = req.body[key];
      }
    });

    req.app.locals.gw.action('feed_update', { name: 'ws' }, {
      guildID: document.guildID,
      oldData: oldData,
      type: document.type,
      url: document.url,
      webhook: { id: document.webhook_id, token: document.webhook_token },
      options: document.options || {},
      display: document.display || {}
    });

    await req.app.locals.db.collection('feeds').updateOne({ _id: id }, { $set: document }, { $upsert: true });
    res.status(200).json({ success: true });
  }

  /**
   * DELETE a feed from a server.
   * @param req {any} Request
   * @param res {any} Response
   */
  async delete(req, res) {
    let guild;
    if (!req.authInfo.isBot && !req.authInfo.admin) {
      let member = req.app.locals.storedUsers.get(req.authInfo.userID);
      if (!member) {
        member = await this.refreshUser(req, req.authInfo.userID, req.authInfo.accessToken);
      }

      guild = member.filter(({ id }) => id === req.body.guildID)[0];
      if (!guild) {
        res.status(404).json({ error: 'Unknown guild' });
        return;
      }

      if (!(((guild.permissions & 1) << 3) || ((guild.permissions & 1) << 5))) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    let document = await req.app.locals.db.collection('feeds').find({ webhook_id: req.body.webhookID }).toArray();
    document = document.filter(f => f.url.toLowerCase() === req.body.url.toLowerCase() &&
      f.type.toLowerCase() === req.body.type.toLowerCase())[0];
    if (!document) {
      res.status(404).json({ success: false, error: 'Feed is non existent' });
      return;
    }

    await req.app.locals.db.collection('feeds').deleteOne({ _id: document._id });
    req.app.locals.gw.action('feed_delete', { name: 'ws' }, { guildID: req.body.guildID, webhook_id: req.body.webhookID, url: document.url, type: document.type });

    res.status(200).json({ success: true, display: document.display, type: document.type, url: document.url, options: document.options });
  }

  /**
   * Verifies that the feed is actually valid.
   * @param req {any} Request
   * @param res {any} Response
   */
  async verifyFeed(req, res) {
    if (req.body.type === 'youtube') {
      try {
        const { body: username } = await superagent.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${req.body.url}&key=${config.youtubeKey}`)
          .set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');

        const { body: id } = await superagent.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${req.body.url}&key=${config.youtubeKey}`)
          .set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');

        let user;
        if (username.items && username.items[0]) {
          user = username.items[0];
        } else if (id.items && id.items[0]) {
          user = id.items[0];
        }
        if (!user) {
          res.status(400).json({ success: false, error: 'Cannot resolve YouTube account, ensure you provide just the channel ID or name.' });
          return false;
        }

        req.body.url = user.id;
        return {
          title: user.snippet.title,
          icon: user.snippet.thumbnails.high.url
        };
      } catch(err) {
        res.status(400).json({ success: false, error: err.response ? err.response.body.error.message : err.message });
        return false;
      }
    } else if (req.body.type === 'twitter') {
      try {
        const user = await new Promise((resolve, reject) => {
          req.app.locals.twitterClient.get('users/lookup', { screen_name: req.body.url }, (error, users) => {
            if (error) {
              reject(error);
              return;
            }
            if (!users[0]) {
              reject('Unknown user');
              return;
            }
            resolve({
              title: users[0].name,
              icon: users[0].profile_image_url_https
            });
          });
        });
        return user;
      } catch(err) {
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
        return {
          title: data[0].display_name,
          icon: data[0].profile_image_url
        };
      }
    } else if (req.body.type === 'rss') {
      try {
        await superagent.get(req.body.url).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)')
          .set('Accept', 'text/html,application/xhtml+xml,application/xml,text/xml');

        return {
          title: req.body.url,
          icon: 'https://cdn.discordapp.com/emojis/644633161933914122.png'
        };
      } catch(err) {
        res.status(400).json({ success: false, error: 'Invalid RSS URL' });
        return false;
      }
    } else if (req.body.type === 'reddit') {
      try {
        const { body: { data } } = await superagent.get(`https://reddit.com/r/${req.body.url}/about.json`).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');
        if (data.over18 && !req.body.nsfw) {
          res.status(400).json({ success: false, error: 'Subreddit is over 18 and the specified channel is not an NSFW channel' });
          return null;
        }

        return {
          title: data.display_name_prefixed,
          icon: data.icon_img
        };
      } catch(err) {
        res.status(400).json({ success: false, error: 'Invalid Subreddit name' });
        return false;
      }
    } else if (req.body.type === 'roblox-group') {
      try {
        const { body: { data } } = await superagent.get(`https://groups.roblox.com/v2/groups?groupIds=${req.body.url}`).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');

        if (!data[0]) {
          res.status(400).json({ success: false, error: 'No group found. make sure you use the ID.' });
          return false;
        }

        req.body.url = data[0].id;

        return {
          title: data[0].name
        };
      } catch(err) {
        res.status(400).json({ success: false, error: 'No group found or ROBLOX API down. Make sure you use the ID and try again later.' });
        return false;
      }
    } else if (req.body.type === 'statuspage') {
      try {
        const { body } = await superagent.get(`https://${new URL(req.body.url).hostname}/api/v2/summary.json`).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');
        if (!body || !body.page || !body.scheduled_maintenances) {
          res.status(400).json({ success: false, error: 'Invalid status page url, ensure it is managed by statuspage.io' });
          return false;
        }

        return {
          title: `${body.page.name} Status`,
          icon: 'https://cdn.discordapp.com/emojis/809109311271600138.png'
        };
      } catch(err) {
        res.status(400).json({ success: false, error: 'Invalid status page url, ensure it is managed by statuspage.io' });
        return false;
      }
    } else {
      res.status(400).json({ success: false, error: 'Invalid feed type' });
      return false;
    }

    return false;
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
      name: 'SocialFeeds',
      avatar: avatar
    }, 'Create Feed Webhook');
  }

  async sendFeedMessage(client, webhook, userID, feed) {
    const user = await client.getRESTUser(userID);
    const feedType = {
      youtube: 'YouTube',
      reddit: 'Reddit',
      rss: 'RSS',
      twitch: 'Twitch',
      twitter: 'Twitter',
      statuspage: 'Status Page'
    }[feed.type];
    return client.executeWebhook(webhook.id, webhook.token, {
      content: [
        `**${user.username}#${user.discriminator}** has added ${feedType} feed for **${feed.display && feed.display.title ? feed.display.title : feed.url}** via dashboard.`,
        'Most recent updates will appear here.'
      ].join('\n')
    });
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
    let token;
    try {
      let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
      userID = data.userID;
      isBot = !!data.bot;
      token = data.access_token;
      auth = true;
    } catch(e) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      auth = false;
    }

    if (!auth) {
      res.status(401).json({ success: false, error: 'Unauthorised' });
      return;
    }
    req.authInfo = { admin: isBot || config.admins.includes(userID), isBot, userID, accessToken: token };
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

  async refreshUser(req, id, token) {
    const guilds = await req.app.locals.discordRest.api.users('@me').guilds.get(null, null, `Bearer ${token}`);
    req.app.locals.storedUsers.set(id, guilds);
    return guilds;
  }

};
