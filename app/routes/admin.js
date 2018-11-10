let express = require('express');
let https   = require('https');
const Emitter = require('../../events/Emitter');
//let session = require('express-session');

let config = require('config');
// Constructor
function Admin(xirsys) {
  let router = express.Router();
  // check if method is defined in request
  router.use((req, res, next)=> {
    // -----------------------------------------------------------------------
    // authentication middleware

    //const auth = {login: 'yourlogins', password: 'yourpasswords'}; // change this
    const auth = config.get('admin');
    // parse login and password from headers
    const b64auth           = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = new Buffer(b64auth, 'base64').toString().split(':');

    // Verify login and password are set and correct
    if (!login || !password || login !== auth.login || password !== auth.password) {
      res.set('WWW-Authenticate', 'Basic realm="401"'); // change this
      res.status(401).send('Authentication required.');// custom message
      return
    }

    // -----------------------------------------------------------------------
    // Access granted...
    next()
  });

  router.post('/apply',(req, res, next)=>{
    delete req.body._locals;
    Emitter.emit('apply', req.body);
    res.send('done');

  });
  router.post('/reset',(req, res, next)=>{
    console.log(req.headers.authorization);
    Emitter.emit('reset', req.body);
    res.send('done');
  });
  router.get('/logout',(req, res, next)=>{
    if (req.headers && req.headers.authorization) {
      delete req.headers.authorization;
      res.set('WWW-Authenticate', 'Basic realm="401"'); // change this
      res.status(401).send('Authentication required.');// custom message
      return;
    }
    res.send('done');
  });

  router.get('/',(req, res, next)=>{
    res.render('admin/index', xirsys.info);
  });



  return router;
}

// export the class
module.exports = Admin;
