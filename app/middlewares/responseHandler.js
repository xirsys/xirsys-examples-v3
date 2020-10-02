function getPath(req){
  let path       = req.url.split('?').shift();
  let slashIndex = path.indexOf('/', 1);
  if (slashIndex !== -1) {
    path   = path.substr(0, slashIndex);
  }
  return path;
}
module.exports = function (xirsys) {
  return [
    (req, res, next) => {
      console.warn('REQUEST RESPONSE - ', req.error, req.success);
      let path = getPath(req);
      if (path === '/_turn' && req.method === 'PUT') {
        let v = {iceServers:xirsys.fallbackIceServers};
        if(req.success){
          if(req.success.v) {
            if (req.success.v.iceServers) {
              v.iceServers = req.success.v.iceServers;
            }
          }
        }
        req.error   = null;
        req.success = {
          v: v,
          s: "ok"
        };
      }
      next();
    },
    (req, res) => {
      res.type('application/json');
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
