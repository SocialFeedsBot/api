const fs = require('fs');

module.exports = (app) => {
  const scan = (dir) => {
    fs.readdirSync(dir).forEach((file) => {
      if (file.endsWith('.js')) {
        let route = `${dir}/${file}`.split('/');
        route.splice(0, route.indexOf('routes') + 1);

        if (route[route.length - 1] === 'index.js') {
          route.splice(-1);
        } else {
          route[route.length - 1] = route[route.length - 1].slice(0, -3);
        }

        route = route.map(name => name.replace(/^_/, ':')).join('/');

        const methods = require(`${dir}/${file}`);
      } else {
        scan(`${dir}/${file}`);
      }
    });
  };

  scan(`${__dirname}/routes/`);
};

/*

routes/
  feeds/
    :id/
      index.js
  index.js

  guilds/
    @me/
      index.js
    :id/
      index.js

  users/
    @me/
      index.js
    :id/
      index.js

*/
