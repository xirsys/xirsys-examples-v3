let express          = require('express');
let https            = require('https');
let requester        = require('../middlewares/requestHandler');
let responder        = require('../middlewares/responseHandler');
let preferredgateway = require('../middlewares/preferredgateway');

// Constructor
function WebRtc(xirsys) {
  let router = express.Router();
  // check if method is defined in request
  router.use('/', function (req, res, next) {
    let uri = req.url.split('?').shift();
    console.log(uri, req.params);
    if (req.params.method == null && uri.length <= 1) {
      req.error = {
        "s": "error",
        "v": "method_not_found"
      };
    }
    next();
  });
  // check if method is an allowed service
  router.use('/:method/', function (req, res, next) {
    if (req.params.method != null) {
      //console.log(xirsys['allowedServices'].indexOf('/'+req.params.method) , req.params.method);
      if (xirsys['allowedServices'].indexOf('/' + req.params.method) === -1) {
        req.error = {
          "s": "error",
          "v": "not_allowed"
        };
      }
    }
    next();
  });
  // returns app path to client.
  router.use('/:method/', function (req, res, next) {
    if (req.params.method != null && req.params.method === '_path') {
      let path = xirsys['info']['channel'];
      let o    = {s: 'ok', v: (!!path ? path : '')};
      console.log('send path: ', o);
      res.send(o);
    } else {
      next();
    }
  });
  //check request for allowedClientSetChannel
  router.use('/:method/:channel', function (req, res, next) {
    if (xirsys['overrideAllowedChannel'] === true) {
      xirsys.info.channel = req.params.channel != null ? req.params.channel : xirsys.info.channel;
    } else {
      req.error = {
        "s": "error",
        "v": "channel_override_not_allowed"
      };
    }
    next();
  });
  //apply channel to request/methods that require it only
  router.use(function (req, res, next) {
    console.log('Req Channel - URL: ', req.url);
    let methods    = ['/_token', '/_turn', '/_subs', '/_data', '/_acc'];
    let path       = req.url.split('?').shift();
    let slashIndex = path.indexOf('/', 1);
    let suffix;//if we have a trailing path, were using custom channels.
    if (slashIndex !== -1) {
      suffix = path.substr(slashIndex);
      path   = path.substr(0, slashIndex);
    }
    if (methods.indexOf(path) !== -1) {
      let arr = req.url.split('?');
      //if suffix exists, do not add root channel path, we can assume were overriding channel paths.
      req.url = arr[0] + "/" + (!!suffix ? '' : xirsys.info.channel);
      if (arr[1] != null) {
        req.url = req.url + "?" + arr[1];
      }
      console.log('has suffix ', suffix);
      console.log('Method ' + path + ' - Req URL: ', req.url);
    }
    next();
  });
  //proxy request if no error is found
  router.use(preferredgateway(xirsys), requester(xirsys), responder(xirsys));
  return router;
}

// export the class
module.exports = WebRtc;
