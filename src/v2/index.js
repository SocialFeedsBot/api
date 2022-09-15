const fs = require('fs');

const replace = {
  _id: ':id([0-9]+)'
};

module.exports = (app) => {
  const scan = (dir) => {
    const directory = fs.readdirSync(dir);
    directory.forEach((file) => {
      if (file.endsWith('.js')) {
        if (file === 'index.js') {
          file = '';
        }

        const Route = require(`${dir}/${file}`);
        const route = new Route(`${dir}/${file}`);

        Object.getOwnPropertyNames(Route.prototype).filter(m => !m.includes('Middleware') && !m.includes('constructor')).forEach((routeName) => {
          const [method, ...path] = routeName.split(/(?=[A-Z])/);
          const middleware = route[`${path.length > 0 ? `${method}${path.join('')}` : method}Middleware`];

          if (path.length === 0) {
            if (middleware) {
              route.router[method]('/', middleware.bind(route), route[method].bind(route));
            } else {
              route.router[method]('/', route[method].bind(route));
            }
          } else if(path.length > 0) {
            if (middleware) {
              route.router[method](`/${path.join('/').toLowerCase()}`, middleware.bind(route), route[`${method}${path.join()}`].bind(route));
            } else {
              route.router[method](`/${path.join('/').toLowerCase()}`, route[`${method}${path.join('')}`].bind(route));
            }
          }
        });

        let routeString = `/v2${dir.replace(`${__dirname}/routes/`, '')}`;
        Object.keys(replace).forEach(key => {
          routeString = routeString.replace(new RegExp(key, 'g'), replace[key]);
        });

        app.use(routeString, route.router);
      } else {
        scan(`${dir}/${file}`);
      }
    });
  };

  scan(`${__dirname}/routes/`);
};
