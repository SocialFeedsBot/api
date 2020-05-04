// Constants
const Eris = require('eris');
const Redis = require('ioredis');
const { MongoClient } = require('mongodb');
const express = require('express');
const config = require('../config');
const bodyParser = require('body-parser');

// App
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routing
const feedsRoute = require('./routes/feeds');
app.use('/feeds', feedsRoute);

// Start
async function start() {
  const mongoClient = await MongoClient.connect(config.databaseURL, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoClient.db();

  const redis = new Redis(config.redis);
  const client = new Eris(config.token, { restMode: true });

  app.locals.db = db;
  app.locals.client = client;
  app.locals.storedUsers = new Map();

  app.listen(config.port);

  setInterval(async () => {
    await redis.set('serviceStatus:api', JSON.stringify({ lastUpdated: Date.now() }), 'EX', 604800);
  }, 5000);
}

start();
