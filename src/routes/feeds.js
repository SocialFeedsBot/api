const router = module.exports = require('express').Router();
const jwt = require('jsonwebtoken');
const superagent = require('superagent');
const config = require('../../config');

router.get('/', async (req, res) => {
  try {
    const { bot } = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
    if (!bot) throw new Error('');
  } catch(e) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  let feeds = await req.app.locals.db.collection('feeds').find().toArray();
  feeds = (feeds.map(feed => feed.feeds.map(f => ({
    type: f.type,
    url: f.url,
    guildID: feed.guildID,
    webhook: { id: feed._id, token: feed.token }
  }))) || []).flat();

  res.status(200).json(feeds);
});

router.get('/:guildID', async (req, res) => {
  let userID;
  let isBot;
  try {
    let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
    userID = data.id;
    isBot = !!data.bot;
  } catch(e) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  let guild;
  if (!isBot) {
    let member = req.app.locals.storedUsers.get(userID);
    if (!member) {
      res.status(403).json({ error: 'Not authenticated' });
      return;
    }

    guild = member.guilds.filter(({ id }) => id === req.params.guildID);
    if (!guild || !(guild.permissions & 0x20)) {
      res.status(403).json({ error: 'You cannot manage this server' });
      return;
    }
  }

  let feeds = await req.app.locals.db.collection('feeds').find({ guildID: req.params.guildID }).toArray();
  feeds = feeds.map(feed => feed.feeds.map(f => ({
    type: f.type,
    url: f.url,
    webhook: { id: feed._id, token: feed.token }
  }))).flat();

  res.status(200).json(feeds);
});

router.post('/new', async (req, res) => {
  let userID;
  let isBot;
  try {
    let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
    userID = data.id;
    isBot = !!data.bot;
  } catch(e) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  // Validate whether or not the URL is correct.
  if (req.body.feed.type === 'youtube') {
    try {
      await superagent.get(`https://youtube.com/channel/${req.body.feed.url}`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid YouTube Channel' });
      return;
    }
  } else if (req.body.feed.type === 'twitter') {
    try {
      await superagent.get(`https://api.twitter.com/1.1/statuses/user_timeline?screen_name=${req.body.feed.url}`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid Twitter Account' });
      return;
    }
  } else if (req.body.feed.type === 'twitch') {
    try {
      await superagent.get(`https://twitch.tv/${req.body.feed.url}`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid Twitch Channel' });
      return;
    }
  } else if (req.body.feed.type === 'rss') {
    try {
      await superagent.get(req.body.feed.url).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
    } catch(err) {
      res.status(400).json({ success: false, error: 'Invalid RSS URL' });
      return;
    }
  } else if (req.body.feed.type === 'reddit') {
    try {
      const a = await superagent.get(`https://reddit.com/r/${req.body.feed.url}/about.json`).set('User-Agent', 'DiscordFeeds-API/1 (NodeJS)');
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
    if (!guild || !(guild.permissions & 0x20)) {
      res.status(403).json({ success: false, error: 'You cannot manage this server' });
      return;
    }
  }

  let document = await req.app.locals.db.collection('feeds').findOne({ _id: req.body.webhook.id });
  if (document) {
    delete document._id;
  }

  if (document) {
    document.feeds.push(req.body.feed);
    await req.app.locals.db.collection('feeds').updateOne({ _id: req.body.webhook.id }, { $set: document });

    res.status(200).json({ success: true });
  } else {
    await req.app.locals.db.collection('feeds').insertOne({
      _id: req.body.webhook.id,
      token: req.body.webhook.token,
      feeds: [req.body.feed],
      guildID: req.body.guildID
    });

    res.status(200).json({ success: true });
  }
});

router.delete('/delete', async (req, res) => {
  let userID;
  let isBot;
  try {
    let data = jwt.verify(req.headers.authorization, config.jwtSecret, { algorithm: 'HS256' });
    userID = data.id;
    isBot = !!data.bot;
  } catch(e) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  let guild;
  if (!isBot) {
    let member = req.app.locals.storedUsers.get(userID);
    if (!member) {
      res.status(403).json({ success: false, error: 'Not authenticated' });
      return;
    }

    guild = member.guilds.filter(({ id }) => id === req.body.guildID);
    if (!guild || !(guild.permissions & 0x20)) {
      res.status(403).json({ success: false, error: 'You cannot manage this server' });
      return;
    }
  }

  let document = await req.app.locals.db.collection('feeds').findOne({ _id: req.body.webhook.id });
  if (!document) {
    res.status(404).json();
    return;
  }

  delete document._id;
  const index = document.feeds.findIndex(feed => feed.url === req.body.feed.url && feed.type === req.body.feed.type);
  if (index > -1) {
    document.feeds.splice(index, 1);
  }

  await req.app.locals.db.collection('feeds').updateOne({ _id: req.body.webhook.id }, { $set: document });
  res.status(200).json({ success: true });
});
