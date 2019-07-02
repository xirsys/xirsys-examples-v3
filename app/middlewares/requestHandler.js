let https   = require('https');
let request = function (options) {
  console.log(options);
  return new Promise((resolve, reject) => {
    //make call to Xirsys API, with modified request. Expect and return response to client.
    let h = https.request(options, function (httpres) {
      let str = '';
      httpres.on('data', function (data) {
        str += data;
      });
      //error - returns 500 status and formatted response
      httpres.on('error', function (e) {
        reject({s: "error", v: "Proxy Request Error"});//todo - better error
      });
      httpres.on('end', function () {
        console.log("Requested: ", options.path, "\n : ", str);
        let result = JSON.parse(str);
        if(result.s !== 'ok'){
          return reject(result)
        }
        resolve(result);
      });
    });
    if (options.method === 'PUT' || options.method === 'POST') {
      let js                            = JSON.stringify(options.body);
      options.headers['Content-Length'] = js.length;
      options.headers["Content-Type"]   = "application/json";
      h.write(js);
    }
    h.on('error', (e) => {
      console.log(e.message);
      reject({s: "error", v: "Proxy Request Error"});//todo - better error
    });
    h.end();
  });
};

module.exports = function (xirsys) {
  let options = {};
  let success, error;
  console.log('RH1');
  return [
    (req, res, next) => {
      if (req.error) {
        next();
      } else {
        //construct options
        options = {
          host:    'global.xirsys.com',//req.PREFERRED_XIRSYS_GATEWAY,
          method:  req.method,
          path:    req.url,
          headers: {
            "Authorization": "Basic " + Buffer.from(xirsys.info.ident + ":" + xirsys.info.secret).toString("base64")
          },
          body:    req.body
        };
        request(options)
          .then((result) => {
            success = result;
            next();
          })
          .catch((err) => {
            error = err;
            next()
          });
      }
    },
    (req, res, next) => {
      if (success) {
        req.success = success;
        return next();
      }
      //
      if (error && JSON.stringify(error) !== JSON.stringify({s: "error", v: "Proxy Request Error"})) {
        return next();
      }

      options.host = xirsys.gateway;// overrides to global/default gateway
      request(options)
        .then((result) => {
          req.success = result;
          next();
        })
        .catch((err) => {
          req.error = err;
          next()
        });
    }]
};
