// Constants
const Eris = require('eris');
const { MongoClient } = require('mongodb');
const GatewayClient = require('./gateway/GatewayClient');
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

  await db.collection('feeds').createIndex({ type: 1 });
  await db.collection('feeds').createIndex({ url: 1 });

  app.listen(config.port);
}

const worker = new GatewayClient(config.gateway);

worker
  .on('error', (err) => logger.extension('Gateway').error(err))
  .on('connect', (ms) => logger.extension('Gateway').info(`Gateway connected in ${ms}ms`))
  .once('ready', () => start(worker));

worker.connect();
