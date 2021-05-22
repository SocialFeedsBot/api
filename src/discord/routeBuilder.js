const noop = () => {}; // eslint-disable-line no-empty-function
const methods = ['get', 'post', 'delete', 'patch', 'put'];

module.exports = (manager) => {
  const route = [];
  const handler = {
    get (target, name) {
      if (methods.includes(name)) {
        return (data = {}, query = {}, customToken = null) => manager.request(name, route.join('/'), data, query, customToken);
      }
      route.push(name);
      return new Proxy(noop, handler);
    },

    apply (target, _, args) {
      route.push(...args.filter(x => x !== null));
      return new Proxy(noop, handler);
    }
  };

  return new Proxy(noop, handler);
};

