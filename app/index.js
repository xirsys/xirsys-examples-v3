const bodyParser = require('body-parser'),
    path = require('path'),
    config = require('config'),
    express = require('express'),
    cors = require('cors'),
	httpsport = process.env.SECURE_PORT || config.get('host').httpsport || 3443;
//
//  Basic Express App
//


let xirsys = config.get('xirsys');//Xirsys account info for API.
let webrtc = require('./routes/webrtc.js');//Xirsys API module
let app = express()
    .set('trust proxy', 'loopback')
    .use(cors())
    .use(bodyParser.json())//json parser
    .use(bodyParser.urlencoded({ extended: true }))//urlencoded parser
    .use(express.static(path.join(__dirname, 'public')))//path to examples
    .use("/webrtc", webrtc(xirsys));//watch API calls

module.exports = app;
