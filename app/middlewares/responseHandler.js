module.exports = function (xirsys) {
  return [
    (req, res, next) => {
      if (req.error) {
        console.warn('REQUEST ERROR - ', req.params.method, req.error);
        if (req.params.method === '_turn' && req.method === 'PUT') {
          req.error   = null;
          req.success = {
            v: iceServers || [{"url": "stun:stun.l.google.com:19305"},
                              {"url": "stun:stun.services.mozilla.com"}],
            s: "ok"
          };
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
