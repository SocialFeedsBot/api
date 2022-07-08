const fs = require('fs');

module.exports = (logger, app) => {
  const scan = (dir) => {
    const directory = fs.readdirSync(dir);
    directory.forEach((file) => {
      if (file.endsWith('.js')) {
        while (dir.indexOf('_') > -1) {
          dir = dir.replace('_', ':');
        }

        if (file === 'index.js') {
          file = '';
        }

        logger.debug('Filtered route', dir.replace(`${__dirname}/routes/`, ''));
        const Route = require(`${dir}/${file}`);
        const route = new Route(`${dir}/${file}`, logger);

        Object.getOwnPropertyNames(Route.prototype).filter(m => !m.includes('Middleware') && !m.includes('constructor')).forEach((routeName) => {
          const [method, ...path] = routeName.split(/(?=[A-Z])/);
          const middleware = route[`${path.length ? `${method}${path.join('')}` : method}Middleware`];

          if (path.length === 0) {
            if (middleware) {
              route.router.get(
                '/',
                middleware.bind(route),
                route[method].bind(route)
              );
            } else {
              route.router.get(
                '/',
                route[method].bind(route)
              );
            }
          } else if(path.length > 0) {
            if (middleware) {
              route.router[method](
                `/${path.join('/').toLowerCase()}`,
                middleware.bind(route),
                route[`${method}${path.join()}`].bind(route)
              );
            } else {
              route.router[method](
                `/${path.join('/').toLowerCase()}`,
                route[`${method}${path.join('')}`].bind(route)
              );
            }
          }
        });

        app.use(`/v2${dir.replace(`${__dirname}/routes/`, '')}`, route.router);
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
