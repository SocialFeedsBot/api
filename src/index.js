// Constants
const isProduction = !process.env.DEV;
const Eris = require('eris');
const Redis = require('ioredis');
const Rest = require('./discord/RequestHandler');
const { MongoClient } = require('mongodb');
const GatewayClient = require('./gateway');
const winston = require('winston');
const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const config = require(isProduction ? '../config' : '../config.dev');
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
app.use(async (req, res, next) => {
  logger.debug(`${req.method.toUpperCase()} ${req.url}`);
  if (config.prometheus && config.prometheus.use) {
    await superagent.post(`${config.prometheus.url}/request?url=${encodeURIComponent(req.url)}`)
      .send(req.url);
  }
  next();
});
app.use(bodyParser.json({
  verify: (req, res, buf, encoding) => {
    if (req.url.includes('webhook')) req.rawBody = buf;
  }
}));
app.use(cors());

process.on('unhandledRejection', (err, p) => logger.error(`Unhandled rejection: ${err.stack}`, { promise: p }));

// Versions
const v2 = require('./v2/');
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

  setTwitchToken();

  await db.collection('feeds').createIndex({ type: 1 });
  await db.collection('feeds').createIndex({ url: 1 });

  app.listen(config.port);

  gw.sendReady();
}

async function setTwitchToken() {
  try {
    const { body: twitch } = await superagent.post('https://id.twitch.tv/oauth2/token')
      .query({
        client_id: config.twitchClient,
        client_secret: config.twitchSecret,
        grant_type: 'client_credentials',
        scope: 'user:read:email'
      });
    app.locals.twitchToken = twitch.access_token;
    setTimeout(() => setTwitchToken(), twitch.expires_in);
  } catch (e) {
    logger.error(`Unable to get Twitch token: ${e.message}`, { src: 'twitchToken' });
  }
}

logger.info(`Running in ${isProduction ? 'production' : 'development'} environment`, { src: 'process' });
const worker = new GatewayClient(config.gateway.use, 'api', config.gateway.address, config.gateway.secret);

worker
  .on('error', (err) => logger.error(err, { src: 'gateway' }))
  .on('connect', (ms) => logger.info(`Gateway connected in ${ms}ms`, { src: 'gateway' }))
  .once('ready', () => start(worker));

worker.connect();
