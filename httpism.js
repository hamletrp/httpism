var merge = require('./merge');
var resolveUrl = require('./resolveUrl');
var utils = require('./middlewareUtils');

function client(url, options, middlewares) {
  return new Httpism(url, options, middlewares);
}

function Httpism(url, options, middlewares) {
  this.url = url;
  this._options = options;
  this.middlewares = middlewares;
}

Httpism.prototype.send = function(method, url, body, _options, api) {
  var options = merge(_options, this._options)
  var request = {
    method: method,
    url: resolveUrl(this.url, url),
    headers: options.headers || {},
    body: body,
    options: options
  };

  var self = this;

  function sendToMiddleware(index) {
    if (index < self.middlewares.length) {
      var middleware = self.middlewares[index];
      return middleware(request, function () { return sendToMiddleware(index + 1); }, self);
    }
  }

  return sendToMiddleware(0).then(function (response) {
    return makeResponse(self, response);
  }, function (e) {
    if (e.redirectResponse) {
      return e.redirectResponse;
    } else {
      throw e;
    }
  });
};

function makeResponse(api, response) {
  return utils.extend(new Httpism(api.url, api._options, api.middlewares), response);
}

Httpism.prototype.api = function (url, options, middlewares) {
  var args = parseClientArguments(url, options, middlewares);

  return new Httpism(
    resolveUrl(this.url, args.url),
    merge(args.options, this._options),
    args.middlewares
      ? args.middlewares.concat(this.middlewares)
      : this.middlewares
  );
};

function addMethod(method) {
  Httpism.prototype[method] = function (url, options) {
    return this.send(method, url, undefined, options, this);
  };
}

function addMethodWithBody(method) {
  Httpism.prototype[method] = function (url, body, options) {
    return this.send(method, url, body, options, this);
  };
}

addMethod('get');
addMethod('delete');
addMethod('head');
addMethodWithBody('post');
addMethodWithBody('put');
addMethodWithBody('patch');
addMethodWithBody('options');

function resolveUrl(base, url) {
  if (base) {
    return resolveUrl(base, url);
  } else {
    return url;
  }
}

function parseClientArguments() {
  var url, options, middlewares;

  for(var n = 0; n < arguments.length; n++) {
    var arg = arguments[n];

    if (typeof arg === 'string') {
      url = arg;
    } else if (typeof arg === 'function') {
      middlewares = [arg];
    } else if (arg instanceof Array) {
      middlewares = arg;
    } else if (arg instanceof Object) {
      options = arg;
    }
  }

  return {
    url: url,
    options: options,
    middlewares: middlewares
  };
}

module.exports = client;
