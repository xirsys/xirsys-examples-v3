let express = require('express');
let https = require('https');

// Constructor
function WebRtc(xirsys) {
  let router = express.Router();
  // check if method is defined in request
  router.use('/', function (req, res, next) {
    let uri = req.url.split('?').shift();
    console.log(uri, req.params);
    if (req.params.method === null && uri.length <= 1) {
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
      let o = {s: 'ok', v: (!!path ? path : '')};
      console.log('send path: ', o);
      res.send(o);
    } else {
      next();
    }
  });
  // returns app path to client.
  router.use('/:method/', function (req, res, next) {
    if (req.params.method === '_turn' && xirsys['staticCredentials']) {
      let o = xirsys['staticCredentials'];
      let msg;
      let rx = new RegExp(/^\s*$/);//checks empty strings
      let resObj;
      for(let i in o){
        if( !o[i] || rx.test(o[i]) ){
          msg = i + " -- " + o[i];
          break;
        }
      }
      if(msg){
        next();// request from service
      }else{
        resObj = {
          v: {
            iceServers:[
              {url:`stun:${o.domain}.xirsys.com`},
              {username:o.username, url:`turn:${o.domain}:80?transport=udp`, credential:o.credential},
              {username:o.username, url:`turn:${o.domain}:3478?transport=udp`, credential:o.credential},
              {username:o.username, url:`turn:${o.domain}:80?transport=tcp`, credential:o.credential},
              {username:o.username, url:`turn:${o.domain}:3478?transport=tcp`, credential:o.credential},
              {username:o.username, url:`turn:${o.domain}:443?transport=tcp`,  credential:o.credential},
              {username:o.username, url:`turn:${o.domain}:5349?transport=tcp`, credential:o.credential}
              ]
          },
          s:"ok"
        }
      }
      res.send(JSON.stringify(resObj));
    } else {
      next();// not _turn request
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
    let methods = ['/_token', '/_turn', '/_subs', '/_data', '/_acc'];
    let uri = req.url.split('?').shift();
    if (methods.indexOf(uri) !== -1) {
      let arr = req.url.split('?');
      req.url = arr[0] + "/" + xirsys.info.channel;
      if (arr[1]) {
        req.url = req.url + "?" + arr[1];
      }
    }
    console.log('applying ', req.url);
    next();
  });
  //proxy request if no error is found
  router.use(function (req, res) {
    //if error from proxy and respond with error
    if (req.error) {
      res.send(JSON.stringify(req.error));
    }
    //if error null proxy request to xirsys
    else {
      let options = {
        method:  req.method,
        host:    xirsys.gateway,
        path:    req.url,
        headers: {
          "Authorization": "Basic " + new Buffer(xirsys.info.ident + ":" + xirsys.info.secret).toString("base64")
        }
      };
      if (req.method == 'PUT' || req.method == 'POST') {
        let js = JSON.stringify(req.body);
        options.headers['Content-Length'] = js.length;
        options.headers["Content-Type"] = "application/json";
        console.warn(req.method, " - ", js);
      }
      //make call to Xirsys API, with modified request. Expect and return response to client.
      let h = https.request(options, function (httpres) {
        let str = '';
        httpres.on('data', function (data) {
          str += data;
        });
        //error - returns 500 status and formatted response
        httpres.on('error', function (e) {
          console.log('error: ', e);
          let o = {s: "error", v: "Proxy Request Error"};
          res.status(500).send(JSON.stringify(o));
        });
        httpres.on('end', function () {
          console.log("Requested: ", options.path, "\n : ", str);
          res.send(str);
        });
      })

      if (req.method == 'PUT' || req.method == 'POST') {
        h.write(js);
      }
      h.end();
      //console.log('*h    ',h);
    }
  });
  return router;
}

// export the class
module.exports = WebRtc;