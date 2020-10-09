const router = module.exports = require('express').Router();
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../config');

const isAuthed = require('../utils/auth');

router.get('/', async (req, res) => {
  const { auth, isBot } = isAuthed(req, res);
  if (!auth || !isBot) return;

  let feeds = await req.app.locals.db.collection('feeds').find({ $elemMatch: req.query }).toArray();
  feeds = feeds.map(feed => ({
    type: feed.type,
    url: feed.url,
    guildID: feed.guildID,
    webhook: { id: feed.webhook_id, token: feed.webhook_token }
  }));

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
  feeds = (await Promise.all(feeds.map(async feed => {
    let info;
    try {
      info = await req.app.locals.client.getWebhook(feed.webhook_id, feed.webhook_token);
    } catch (e) {
      return null;
    }

    return {
      type: feed.type,
      url: feed.url,
      channelID: info.channel_id,
      webhook: { id: feed.webhook_id, token: feed.webhook_token }
    };
  })));

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

  await req.app.locals.db.collection('feeds').insertOne({
    webhook_id: webhook.id,
    webhook_token: webhook.token,
    type: req.body.type,
    url: req.body.url,
    guildID: req.body.guildID
  });

  res.status(200).json({ success: true });
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
