// Constants
const Eris = require('eris');
const Redis = require('ioredis');
const Rest = require('./discord/RequestHandler');
const { MongoClient } = require('mongodb');
const GatewayClient = require('./gateway');
const winston = require('winston');
const Twitter = require('twitter');
const express = require('express');
const superagent = require('superagent');
const btoa = require('btoa');
const cors = require('cors');
const config = require('../config');
const bodyParser = require('body-parser');
const sentry = require('@sentry/node');

if (config.sentry) {
  sentry.init({
    dsn: config.sentry
  });
}

// Set up logger
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message} ${JSON.stringify(Object.assign({}, info, {
      level: undefined,
      message: undefined,
      splat: undefined,
      label: undefined,
      timestamp: undefined
    }))}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'log.log' })
  ]
});

// Init
const app = express();
app.use(bodyParser.json({
  verify: (req, res, buf, encoding) => {
    if (req.url.includes('webhook')) req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`, { src: 'api' });
  next();
});

process.on('unhandledRejection', (err, p) => logger.error(`Unhandled rejection: ${err.stack}`, { promise: p }));

// Versions
const v1 = require('./v1/');
const v2 = require('./v2/');
app.use('/v1', v1);
v2(app);

// Start
async function start(gw) {
  const mongoClient = await MongoClient.connect(config.databaseURL, { useUnifiedTopology: true });
  const db = mongoClient.db();
  const client = new Eris(`Bot ${config.token}`, { restMode: true });

  app.locals.discordRest = new Rest({ token: config.token });
  app.locals.db = db;
  app.locals.gw = gw;
  app.locals.logger = logger;
  app.locals.client = client;
  app.startedAt = Date.now();
  app.locals.redis = new Redis(config.redis);
  app.locals.storedUsers = new Map();

  const { body } = await superagent.post('https://api.twitter.com/oauth2/token?grant_type=client_credentials')
    .set('Authorization', `Basic ${btoa(`${config.twitterConsumerKey}:${config.twitterConsumerSecret}`)}`);
  app.locals.twitterClient = new Twitter({
    consumer_key: config.twitterConsumerKey,
    consumer_secret: config.twitterConsumerSecret,
    bearer_token: body.access_token
  });

  setTwitchToken();

  await db.collection('feeds').createIndex({ type: 1 });
  await db.collection('feeds').createIndex({ url: 1 });

  app.listen(config.port);

  gw.sendReady();
}

async function setTwitchToken() {
  const { body: twitch } = await superagent.post('https://id.twitch.tv/oauth2/token')
    .query({
      client_id: config.twitchClient,
      client_secret: config.twitchSecret,
      grant_type: 'client_credentials',
      scope: 'user:read:email'
    });
  app.locals.twitchToken = twitch.access_token;
  setTimeout(() => setTwitchToken(), twitch.expires_in);
}

const worker = new GatewayClient(config.gateway.use, 'api', config.gateway.address, config.gateway.secret);

worker
  .on('error', (err) => logger.error(err, { src: 'gateway' }))
  .on('connect', (ms) => logger.info(`Gateway connected in ${ms}ms`, { src: 'gateway' }))
  .once('ready', () => start(worker));

worker.connect();
