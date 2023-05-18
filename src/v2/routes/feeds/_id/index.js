const Route = require('../../../../structures/RouteV2');
const { auth, checkPermissions, updateUser } = require('../../../middleware/auth');
const superagent = require('superagent');
const config = require('../../../../../config');

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
    const feedCount = await req.app.locals.db.collection('feeds').countDocuments(Object.assign(query, { guildID: req.params.id }));
    const page = req.query.page ? parseInt(req.query.page) - 1 : 0;
    const pages = Math.floor(feedCount / 50) + 1;

    let feeds = await req.app.locals.db.collection('feeds')
      .find(Object.assign(query, { guildID: req.params.id }))
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
    feeds = feeds.map(feed => {
      let webhook = webhooks.find(w => w.id === feed.webhook_id);
      if (!webhook) {
        return null;
      }

      return {
        type: feed.type,
        url: feed.url,
        channelID: webhook.channel_id,
        webhookID: feed.webhook_id,
        webhookToken: feed.webhook_token,
        options: feed.options || {},
        display: feed.display || {},
        enabled: feed.enabled !== undefined ? feed.enabled : true
      };
    }).filter(a => a);

    res.status(200).json({ feeds, feedCount, page: page + 1, pages });
  }

  async post (req, res) {
    const feedData = await verifyFeed(req, res);
    if (!feedData) return;

    let guild;
    if (!req.authInfo.isBot) {
      let member = await updateUser(req.app, req.authInfo.userID);
      if (!member) {
        res.status(401).json({ success: false, error: 'Not logged in or token expired, login again' });
        return;
      }

      guild = member.guilds.filter(({ id }) => id === req.params.id)[0];
      const hasPerms = checkPermissions(req, res, guild);
      if (!hasPerms) return;
    }

    let webhook;
    try {
      webhook = await createWebhook(req.app.locals.client, req.body.channelID);
    } catch(e) {
      if (e.message.includes('Maximum number of webhooks reached')) {
        res.status(403).json({ success: false, error: 'Maximum number of webhooks reached for this channel.' });
      } else if (e.message.includes('Missing Permissions')) {
        res.status(403).json({ success: false, error: 'I do not have permissions to view or create webhooks.' });
      } else {
        res.status(403).json({ success: false, error: `Unknown error: \`${e.message}\`` });
      }
      return;
    }

    if (req.body.dashboard) {
      await sendFeedMessage(req.app.locals.client, webhook, req.authInfo.userID, {
        ...req.body,
        display: feedData
      });
    }

    const isPremium = await req.app.locals.db.collection('premium').findOne({ guildID: req.params.id });
    const currentFeedCount = await req.app.locals.db.collection('feeds').countDocuments({ guildID: req.params.id });
    if (isPremium) {
      let details = config.premiumTiers[isPremium.tier - 1];
      if (details.maxFeeds >= currentFeedCount.length) {
        res.status(403).json({ success: false, error: `You have reached your maximum feed count (${currentFeedCount.length}/${details.maxFeeds})` });
        return;
      }
    }

    let posted = await req.app.locals.db.collection('feeds').find({
      type: req.body.type,
      url: req.body.url,
      guildID: req.params.id,
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
      url: req.body.url.toString(),
      guildID: req.params.id,
      options: req.body.options || {},
      display: feedData,
      enabled: true
    });

    res.status(200).json({ success: true, feedData });
  }

  async patch (req, res) {
    let guild;
    if (!req.authInfo.isBot && !req.authInfo.admin) {
      let member = await updateUser(req.app, req.authInfo.userID);
      if (!member) {
        res.status(401).json({ success: false, error: 'Not logged in or token expired, login again' });
        return;
      }

      if (!req.authInfo.isBot) {
        guild = member.guilds.filter(({ id }) => id === req.params.id)[0];
        const hasPerms = checkPermissions(req, res, guild);
        if (!hasPerms) return;
      }
    }

    let document = await req.app.locals.db.collection('feeds').find({ webhook_id: req.body.webhookID }).toArray();
    document = document.filter(f => f.url.toLowerCase() === req.body.url.toLowerCase() &&
      f.type.toLowerCase() === req.body.type.toLowerCase())[0];

    if (!document) {
      res.status(404).json({ success: false, error: 'Feed is non existent' });
      return;
    }

    let clone = {
      webhook_id: document.webhook_id,
      webhook_token: document.webhook_token,
      type: document.type,
      url: document.url,
      guildID: document.guildID,
      options: document.options || {},
      enabled: document.enabled || true,
      display: document.display || {}
    };

    let feedDisplay;
    if (req.body.newURL) {
      req.body.url = req.body.newURL;
      feedDisplay = await verifyFeed(req, res);
      if (!feedDisplay) return;

      clone.url = req.body.newURL;
      delete req.body.newURL;
    }
    Object.keys(req.body).forEach(key => {
      if (key === 'options') {
        Object.keys(req.body.options).forEach(option => {
          clone.options[option] = req.body.options[option];
        });
      } else if (key === 'display') {
        Object.keys(req.body.display).forEach(option => {
          clone.display[option] = req.body.display[option];
        });
      } else if (!['webhookID', 'webhookToken', 'url'].includes(key)) {
        clone[key] = req.body[key];
      }
    });
    if (feedDisplay) clone.display = feedDisplay;

    await req.app.locals.db.collection('feeds').updateOne({ _id: document._id }, { $set: clone }, { $upsert: true });
    res.status(200).json({ success: true });
  }

  async delete (req, res) {
    let guild;
    if (!req.authInfo.isBot && !req.authInfo.admin) {
      let member = await updateUser(req.app, req.authInfo.userID);
      if (!member) {
        res.status(401).json({ success: false, error: 'Not logged in or token expired, login again' });
        return;
      }

      if (!req.authInfo.isBot) {
        guild = member.guilds.filter(({ id }) => id === req.params.id)[0];
        const hasPerms = checkPermissions(req, res, guild);
        if (!hasPerms) return;
      }
    }

    let document = await req.app.locals.db.collection('feeds').find({ webhook_id: req.body.webhookID }).toArray();
    document = document.filter(f => f.url.toString().toLowerCase() === req.body.url.toString().toLowerCase() &&
      f.type.toLowerCase() === req.body.type.toLowerCase())[0];
    if (!document) {
      res.status(404).json({ success: false, error: 'Feed is non existent' });
      return;
    }

    await req.app.locals.db.collection('feeds').deleteOne({ _id: document._id });

    res.status(200).json({ success: true, display: document.display, type: document.type, url: document.url, options: document.options });
  }

  // Middleware
  getMiddleware (...args) { return auth(...args); }
  postMiddleware (...args) { return auth(...args); }
  patchMiddleware (...args) { return auth(...args); }
  deleteMiddleware (...args) { return auth(...args); }

};

async function verifyFeed (req, res) {
  switch (req.body.type) {
    // YOUTUBE
    case 'youtube': {
      try {
        const [{ body: username }, { body: { id } }] = await Promise.all([
          superagent.get('https://www.googleapis.com/youtube/v3/channels')
            .query({ forUsername: req.body.url, key: config.youtubeKey, part: 'snippet' })
            .set('User-Agent', 'SocialFeeds-API/2 (NodeJS)'),
          superagent.get('https://www.googleapis.com/youtube/v3/channels')
            .query({ id: req.body.url, key: config.youtubeKey, part: 'snippet' })
            .set('User-Agent', 'SocialFeeds-API/2 (NodeJS)')
        ]);

        let user;
        if (username && username.items && username.items[0]) {
          user = username.items[0];
        } else if (id && id.items && id.items[0]) {
          user = id.items[0];
        }
        if (!user) {
          res.status(404).json({ success: false, error: 'That YouTube channel was not found, ensure you are using the correct username or try using the channel ID.' });
          return false;
        }

        req.body.url = user.id;
        return {
          title: user.snippet.title,
          icon: user.snippet.thumbnails.high.url
        };
      } catch(err) {
        res.status(404).json({ success: false, error: 'An error occurred connecting to YouTube, please try again later.' });
        req.app.locals.logger.warn(`Failure finding YouTube channel: ${err.response ? err.response.body.error.message : err.message}`, { src: 'verifyFeed' });
        return false;
      }
    }

    // TWITTER
    case 'twitter': {
      try {
        const user = await superagent.get(`https://nitter.net/${req.body.url}`);
        if (user && user.statusCode !== 404) {
          return {
            title: `@${req.body.url}`
          };
        }
      } catch(err) {
        res.status(404).json({ success: false, error: 'No Twitter account found with that username.' });
      }
      break;
    }

    // TWITCH
    case 'twitch': {
      const { body: { data } } = await superagent.get('https://api.twitch.tv/helix/users')
        .set('Authorization', `Bearer ${req.app.locals.twitchToken}`)
        .set('Client-ID', config.twitchClient)
        .query({ login: req.body.url });

      if (!data.length) {
        res.status(404).json({ success: false, error: 'That Twitch channel could not be found.' });
      } else {
        req.body.options = Object.assign(req.body.options || {}, { user_id: data[0].id });
        return {
          title: data[0].display_name,
          icon: data[0].profile_image_url
        };
      }
      break;
    }

    // RSS
    case 'rss': {
      try {
        await superagent.get(req.body.url).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)')
          .set('Accept', 'text/html,application/xhtml+xml,application/xml,text/xml');

        return {
          title: req.body.url,
          icon: 'https://cdn.discordapp.com/emojis/644633161933914122.png'
        };
      } catch(err) {
        res.status(404).json({ success: false, error: 'The RSS website could not be reached.' });
        return false;
      }
    }

    // REDDIT
    case 'reddit': {
      try {
        const { body: { data } } = await superagent.get(`https://reddit.com/r/${req.body.url}/about.json`).set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');
        if (data.over18 && !req.body.nsfw) {
          res.status(400).json({ success: false, error: 'This subreddit is age rating 18+ and the specified channel is not an NSFW channel.' });
          return null;
        }

        return {
          title: data.display_name_prefixed,
          icon: data.icon_img
        };
      } catch(err) {
        res.status(400).json({ success: false, error: 'That subreddit could not be found.' });
        return false;
      }
    }

    // ROBLOX GROUP
    case 'roblox-group': {
      try {
        const { body: { data } } = await superagent.get(`https://groups.roblox.com/v2/groups?groupIds=${req.body.url}`)
          .set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');

        if (!data[0]) {
          res.status(404).json({ success: false, error: 'That group could not be found, make sure you are providing the group ID.' });
          return false;
        }
        req.body.url = data[0].id;

        return {
          title: data[0].name
        };
      } catch(err) {
        res.status(404).json({ success: false, error: 'That group could not be found, the Roblox API may be down if the ID is valid, try again later.' });
        return false;
      }
    }

    // STATUS PAGE
    case 'statuspage': {
      try {
        const { body } = await superagent.get(`https://${new URL(req.body.url).hostname}/api/v2/summary.json`)
          .set('User-Agent', 'SocialFeeds-API/1 (NodeJS)');
        if (!body || !body.page || !body.scheduled_maintenances) {
          res.status(404).json({ success: false, error: 'That page could not be found, make sure the page is managed by statuspage.io!' });
          return false;
        }

        return {
          title: `${body.page.name} Status`,
          icon: 'https://cdn.discordapp.com/emojis/809109311271600138.png'
        };
      } catch(err) {
        res.status(404).json({ success: false, error: 'That page could not be found, make sure the page is managed by statuspage.io!' });
        return false;
      }
    }
  }

  // No feed found
  res.status(400).json({ success: false, error: 'That is not a correct feed type. If you believe this is an issue, please get in touch! :)' });
  return false;
}

async function createWebhook (client, channelID) {
  let webhooks;
  try {
    webhooks = await client.getChannelWebhooks(channelID);
  } catch (e) {
    throw new Error('Missing Permissions');
  }

  if (webhooks.length) {
    const webhook = webhooks.find(hook => hook.user.id === config.clientID);
    if (webhook) return webhook;
  }

  const user = await client.getRESTUser(config.clientID);
  const { body } = await superagent.get(user.dynamicAvatarURL('png'))
    .catch(err => console.error(err));
  const avatar = `data:image/png;base64,${body.toString('base64')}`;

  return client.createChannelWebhook(channelID, {
    name: 'SocialFeeds',
    avatar: avatar
  }, 'Created Feed Webhook');
}

async function sendFeedMessage(client, webhook, userID, feed) {
  const user = await client.getRESTUser(userID);
  const feedType = {
    youtube: 'YouTube',
    reddit: 'Reddit',
    rss: 'RSS',
    twitch: 'Twitch',
    twitter: 'Twitter',
    statuspage: 'status page',
    'roblox-group': 'Roblox group'
  }[feed.type];

  return client.executeWebhook(webhook.id, webhook.token, {
    content: [
      `Pssst... **${user.username}#${user.discriminator}** has added ${feedType} feed for **${feed.display && feed.display.title ? feed.display.title : feed.url}** via the web dashboard.`,
      'Most recent updates will appear here. It may take a few moments to refresh.'
    ].join('\n')
  });
}
