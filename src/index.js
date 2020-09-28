// Constants
const Eris = require('eris');
const { MongoClient } = require('mongodb');
const GatewayClient = require('./gateway/GatewayClient');
const Twitter = require('twitter');
const express = require('express');
const superagent = require('superagent');
const btoa = require('btoa');
const cors = require('cors');
const config = require('../config');
const bodyParser = require('body-parser');

// App
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Routing
const feedsRoute = require('./routes/feeds');
const oauthRoute = require('./routes/oauth');
const usersRoute = require('./routes/users');
const guildsRoute = require('./routes/guilds');
app.use('/guilds', guildsRoute);
app.use('/users', usersRoute);
app.use('/feeds', feedsRoute);
app.use('/oauth', oauthRoute);

app.get('/status', async (req, res) => {
  if (req.app.locals.gw.connected) {
    const shards = await req.app.locals.gw.request({ t: 'cluster', id: 'all' }, 'this.shards.map(s => ({ uptime: this.uptime, id: s.id, cluster: this.clusterID, status: s.status, guilds: this.guilds.filter(g => g.shard.id === s.id).length }));');
    const feeds = await req.app.locals.gw.request({ t: 'feeds' }, '({ uptime: Date.now() - this.startedAt })');
    const api = await req.app.locals.gw.request({ t: 'api' }, '({ uptime: process.uptime() * 1000 })');

    res.status(200).json({ shards: shards.flat(), feeds: feeds[0], api: api[0] });
  } else {
    res.status(200).json({ shards: [], feeds: { uptime: 0 }, api: { uptime: 0 } });
  }
});

// Start
async function start(gw) {
  const mongoClient = await MongoClient.connect(config.databaseURL, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoClient.db();
  const client = new Eris(`Bot ${config.token}`, { restMode: true });

  app.locals.db = db;
  app.locals.gw = gw;
  app.locals.client = client;
  app.locals.storedUsers = new Map();

  const { body } = await superagent.post('https://api.twitter.com/oauth2/token?grant_type=client_credentials')
    .set('Authorization', `Basic ${btoa(`${config.twitterConsumerKey}:${config.twitterConsumerSecret}`)}`);
  app.locals.twitterClient = new Twitter({
    consumer_key: config.twitterConsumerKey,
    consumer_secret: config.twitterConsumerSecret,
    bearer_token: body.access_token
  });

  gw.on('request', async (id, data) => {
    try {
      let res = await eval(data.input);
      gw.resolve(id, res);
    } catch(err) {
      gw.resolve(id, err.stack);
    }
    return undefined;
  });

  await db.collection('feeds').createIndex({ type: 0 });
  await db.collection('feeds').createIndex({ url: 0 });

  app.listen(config.port);
}

const worker = new GatewayClient(config.gateway);

worker
  .on('error', (err) => console.log('Gateway error:', err))
  .on('connect', (ms) => console.log(`Gateway connected in ${ms}ms`))
  .once('ready', () => start(worker));

worker.connect();
