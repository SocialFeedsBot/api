const router = module.exports = require('express').Router();
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../config');

const isAuthed = require('../utils/auth');

router.get('/', async (req, res) => {
  try {
    const { bot } = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
    if (!bot) throw new Error('');
  } catch(e) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  console.log(req.query)
  let feeds = await req.app.locals.db.collection('feeds').find(req.query || undefined).toArray();
  feeds = feeds.map(feed => feed.feeds.map(f => {
    return {
      type: f.type,
      url: f.url,
      guildID: feed.guildID,
      webhook: { id: feed._id, token: feed.token }
    };
  })).flat().filter(a => a);

  res.status(200).json(feeds);
});

router.get('/:guildID', async (req, res) => {
  const { auth, isBot, userID } = isAuthed(req, res);
  if (!auth) return;

  let guild;
  if (!isBot) {
    let member = req.app.locals.storedUsers.get(userID);
    if (!member) {
      res.status(403).json({ error: 'Not authenticated' });
      return;
    }

    guild = member.filter(({ id }) => id === req.params.guildID);
    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return;
    }

    if (!guild.permissions & 1 << 3 && !guild.permissions & 1 << 5) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  let feeds = await req.app.locals.db.collection('feeds').find({ guildID: req.params.guildID }).toArray();
  feeds = (await Promise.all(feeds.map(async feed => await Promise.all(feed.feeds.map(async f => {
    let info;
    try {
      info = await req.app.locals.client.getWebhook(feed._id, feed.token);
    } catch(e) {
      return null;
    }

    return {
      type: f.type,
      url: f.url,
      channelID: info.channel_id,
      webhook: { id: feed._id, token: feed.token }
    };
  }))))).flat().filter(f => f);

  res.status(200).json(feeds);
});

router.post('/new', async (req, res) => {
  const { auth, isBot, userID } = isAuthed(req, res);
  if (!auth) return;

  // Validate whether or not the URL is correct.
  if (req.body.type === 'youtube') {
    try {
      await superagent.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${req.body.url}&key=${config.youtubeKey}`)
        .set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: err.response.body.error.message });
      return;
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
      res.status(400).json({ success: false, error: 'Invalid Twitter Account' });
      return;
    }
  } else if (req.body.type === 'twitch') {
    try {
      await superagent.get(`https://twitch.tv/${req.body.url}`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid Twitch Channel' });
      return;
    }
  } else if (req.body.type === 'rss') {
    try {
      await superagent.get(req.body.url).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid RSS URL' });
      return;
    }
  } else if (req.body.type === 'reddit') {
    try {
      const a = await superagent.get(`https://reddit.com/r/${req.body.url}/about.json`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
      if (a.body.data.over18 && !req.body.nsfw) {
        res.status(400).json({ success: false, error: 'Subreddit is over 18 and the specified channel is not an NSFW channel' });
      }
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid Subreddit name' });
      return;
    }
  }

  let guild;
  if (!isBot) {
    let member = req.app.locals.storedUsers.get(userID);
    if (!member) {
      res.status(403).json({ success: false, error: 'Not authenticated' });
      return;
    }

    guild = member.guilds.filter(({ id }) => id === req.body.guildID);
    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return;
    }

    if (!guild.permissions & 1 << 3 && !guild.permissions & 1 << 5) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  let webhook;
  try {
    webhook = await createWebhook(req.app.locals.client, req.body.channelID);
  } catch(e) {
    console.log(e);
    res.status(403).json({ success: false, error: 'I do not have permissions to create webhooks.' });
    return;
  }

  let document = await req.app.locals.db.collection('feeds').findOne({ _id: webhook.id });
  if (document) {
    delete document._id;
  }

  if (document) {
    document.feeds.push({ type: req.body.type, url: req.body.url });
    await req.app.locals.db.collection('feeds').updateOne({ _id: webhook.id }, { $set: document });

    res.status(200).json({ success: true });
  } else {
    await req.app.locals.db.collection('feeds').insertOne({
      _id: webhook.id,
      token: webhook.token,
      feeds: [{ type: req.body.type, url: req.body.url }],
      guildID: req.body.guildID
    });

    res.status(200).json({ success: true });
  }
});

router.delete('/delete', async (req, res) => {
  const { auth, isBot, userID } = isAuthed(req, res);
  if (!auth) return;

  let guild;
  if (!isBot) {
    let member = req.app.locals.storedUsers.get(userID);
    if (!member) {
      res.status(403).json({ success: false, error: 'Not authenticated' });
      return;
    }

    guild = member.filter(({ id }) => id === req.body.guildID);
    if (!guild) {
      res.status(404).json({ error: 'Unknown guild' });
      return;
    }

    if (!guild.permissions & 1 << 3 && !guild.permissions & 1 << 5) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  let document = await req.app.locals.db.collection('feeds').findOne({ _id: req.body.webhook.id });
  if (!document) {
    res.status(404).json({ success: false, error: 'Webhook is non existant' });
    return;
  }

  delete document._id;
  const index = document.feeds.findIndex(feed => feed.url === req.body.feed.url && feed.type === req.body.feed.type);
  if (index > -1) {
    document.feeds.splice(index, 1);
  } else {
    res.status(404).json({ success: false, error: 'Feed is non existant' });
    return;
  }

  await req.app.locals.db.collection('feeds').updateOne({ _id: req.body.webhook.id }, { $set: document });
  res.status(200).json({ success: true });
});

async function createWebhook(client, channelID) {
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
