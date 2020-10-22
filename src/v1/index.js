const router = module.exports = require('express').Router();
const fs = require('fs');

const scanDirectory = path => {
  fs.readdirSync(path).forEach(file => {
    if (!file.endsWith('.js')) {
      scanDirectory(`${path}/${file}`);
    } else if (file === 'index.js') {
      const Route = require(`${path}/${file}`);
      const route = new Route();
      router.use(`${path.replace(`${__dirname}/routes/`, '')}`, route.router);
    }
  });
};

scanDirectory(`${__dirname}/routes/`);
