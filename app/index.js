const bodyParser = require('body-parser'),
    path = require('path'),
    config = require('config'),
    express = require('express'),
    cors = require('cors'),
	httpsport = process.env.SECURE_PORT || config.get('host').httpsport || 3443;
//
//  Basic Express App
//
let xirsys = config.util.toObject( config.get('xirsys') );//Xirsys account info for API.
let webrtc = require('./routes/webrtc.js');//Xirsys API module
let admin = require('./routes/admin.js');//Xirsys API module
let app = express()
  	.set('view engine', 'ejs')
	.use(cors())
    .use(bodyParser.json())//json parser
    .use(bodyParser.urlencoded({ extended: true }))//urlencoded parser
    .use("/webrtc",webrtc(xirsys))
	.use("/admin",admin(xirsys))
  	.use(express.static(path.join(__dirname, 'public')));//path to examples;//watch API calls

module.exports = app;
