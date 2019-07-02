module.exports = function (xirsys) {
  return [
    (req, res, next) => {
      if (req.error) {
        console.warn('REQUEST ERROR - ', req.params, req.error);
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

          if (path === '/_turn' && req.method === 'PUT') {
            req.error   = null;
            req.success = {
              v: xirsys.iceServers || [{"url": "stun:stun.l.google.com:19305"},
                {"url": "stun1:stun.l.google.com:19305"},
                {"url": "stun2:stun.l.google.com:19305"},
                {"url": "stun3:stun.l.google.com:19305"},
                {"url": "stun4:stun.l.google.com:19305"},
                {"url": "stun:stun.services.mozilla.com"}],
              s: "ok"
            };
          }
        }
        next();
      } else {
        next();
      }
    },
    (req, res) => {
      if (req.error) {
        res.status(500).send(req.error);
      } else {
        if (req.success) {
          res.send(req.success);
        }
      }
    }
  ];
};
