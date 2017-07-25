const bodyParser = require('body-parser'),
    path = require('path'),
    config = require('config'),
    express = require('express'),
	httpsport = process.env.SECURE_PORT || config.get('host').httpsport || 3443;
//
//  Basic Express App
//
var xirsys = config.get('xirsys');//Xirsys account info for API.
var webrtc = require('./routes/webrtc.js');//Xirsys API module
var app = express()
    .use(bodyParser.json())//json parser
    .use(bodyParser.urlencoded({ extended: true }))//urlencoded parser
    .all('*', function(req, res, next){
        if (req.secure) {
            return next();
        }
        res.redirect(req.protocol+'://'+req.hostname+':'+httpsport+req.originalUrl);
    })//redirects all http request to https
    .use(express.static(path.join(__dirname, 'public')))//path to examples
    .use("/webrtc",webrtc(xirsys));//watch API calls

module.exports = app;
