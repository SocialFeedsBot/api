// Constants
const Eris = require('eris');
const { MongoClient } = require('mongodb');
const GatewayClient = require('gateway-client');
const Logger = require('./logger/');
const Twitter = require('twitter');
const express = require('express');
const superagent = require('superagent');
const btoa = require('btoa');
const cors = require('cors');
const config = require('../config');
const bodyParser = require('body-parser');

// Init
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
const logger = new Logger('API', [config.token, config.jwtSecret, config.twitterConsumerKey,
  config.twitterConsumerSecret, config.youtubeKey, config.clientSecret, config.gateway.secret]);

process.on('unhandledRejection', (err) => logger.error(`Unhandled rejection: ${err.stack}`));

// Versions
const v1 = require('./v1/');
app.use('/v1', v1);

app.use((req, res, next) => {
  logger.debug(`${req.method.toUpperCase()} ${req.url}`);
  next();
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
  app.startedAt = Date.now();

  const { body } = await superagent.post('https://api.twitter.com/oauth2/token?grant_type=client_credentials')
    .set('Authorization', `Basic ${btoa(`${config.twitterConsumerKey}:${config.twitterConsumerSecret}`)}`);
  app.locals.twitterClient = new Twitter({
    consumer_key: config.twitterConsumerKey,
    consumer_secret: config.twitterConsumerSecret,
    bearer_token: body.access_token
  });

  const { body: twitch } = await superagent.post('https://id.twitch.tv/oauth2/token')
    .query({
      client_id: config.twitchClient,
      client_secret: config.twitchSecret,
      grant_type: 'client_credentials',
      scope: 'user:read:email'
    });
  app.locals.twitchToken = twitch.access_token;

  await db.collection('feeds').createIndex({ type: 1 });
  await db.collection('feeds').createIndex({ url: 1 });

  app.listen(config.port);

  gw.sendReady();
}

const worker = new GatewayClient(config.gateway.use, 'api', config.gateway.address, config.gateway.secret);

worker
  .on('error', (err) => logger.extension('Gateway').error(err))
  .on('connect', (ms) => logger.extension('Gateway').info(`Gateway connected in ${ms}ms`))
  .once('ready', () => start(worker));

worker.connect();
