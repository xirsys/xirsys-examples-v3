const https = require('https');
const http = require('http');
const app = require('./app');
const fs = require('fs');
const httpport = process.env.PORT || 3080;
const httpsport = process.env.SECURE_PORT || 3443;

var httpsOptions = {
    key: fs.readFileSync('./app/cert/server.key')
    , cert: fs.readFileSync('./app/cert/server.crt')
};

app.all('*', function(req, res, next){
    if (req.secure) {
        return next();
    }
    res.redirect('https://localhost:'+httpsport+req.url);
});

https.createServer(httpsOptions, app).listen(httpsport, function (err) {
    if (err) {
        throw err
    }
    console.log('Secure server is listening on '+httpsport+'...');
});

http.createServer(app).listen(httpport, function(err) {
    if (err) {
        throw err
    }
    console.log('Insecure server is listening on port ' + httpport + '...');
});

