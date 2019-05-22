//import { setTimeout } from "timers";

/*********************************************************************************
  The MIT License (MIT)

  Copyright (c) 2017 Xirsys

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.

*********************************************************************************/

if(!$xirsys) var $xirsys = new Object();
var _sig = $xirsys.signal = function (apiUrl, userName, info ) {
    if(!info) info = {};
    this.info = info;
    //internal values
    this.sig = null;//local signal object.
    this.tmpToken;//authorized token for signal calls
    this.sigHostPath;//full authorized path to signaling service.
    this.pendListeners = [];//event listener - hold until init.
    this.heartbeat;//interval that keeps the signal open.
    this.evtListeners = {};

    //path to channel we are sending data to.
    //this.channelPath = !!info.channel ? this.cleanChPath(info.channel) : '';

    this.userName = !!userName ? userName : null;
    this.apiUrl = !!apiUrl ? apiUrl : '/webrtc';
    //console.log('*signal*  constructed');
    this.connectTo( !!info.channel ? info.channel : '' );
}

_sig.prototype.ver = 'v2';
_sig.prototype.keepAliveInt = 800;
_sig.prototype.connected = false;

_sig.prototype.close = function(){
    console.log('close ',this.sig);
    if(this.heartbeat) this.stopHeart();
    if(this.sig) this.sig.close();
}

_sig.prototype.connectTo = function(channel){
    this.channelPath = !!channel ? this.cleanChPath(channel) : '';
    console.log('connectTo: ',this.channelPath);
    //if connected stop current, then do new.
    if(!!this.sig){
        this.close();
        var own = this;
        setTimeout(() => {own.doToken()}, 800);
    } else if(!!this.apiUrl){//!!this.userName &&
        if(this.info.ident && this.info.secret){
            this.doToken(this.info.ident, this.info.secret);//first get our token.
        }else {
            this.doToken();
        }
    } else {
        console.log('Error: Could connect signal!');
    }
    return true;
}

_sig.prototype.doToken = function(ident, secret){
    var path = this.apiUrl+"/_token"+this.channelPath+"?k="+this.userName;
    console.log('*signal*  PUT doToken to '+path);
    var own = this;
    var _headers = {};
    if(ident && secret){
        _headers["Authorization"] = "Basic " + btoa(ident + ":" + secret);
    }
    $.ajax({
        url: path,
        type: 'PUT',
        dataType: 'json',
        headers: _headers,
        error: function(data) {console.log('*signal*  error: ', data);},
        success: function(data) {
            own.tmpToken = data.v;
            if(own.tmpToken == 'no_namespace') {
                console.log('*signal*  fail: ', own.tmpToken);
                return;
            }
            console.log('*signal*  token: ',own.tmpToken);
            if(own.info.ident && own.info.secret){
                own.doSignal(own.info.ident, own.info.secret);//first get our token.
            }else {
                own.doSignal();
            }
        }
    });
}

_sig.prototype.doSignal = function(ident, secret){
    console.log('*signal*  GET doSignal to '+this.apiUrl+'/_host'+this.channelPath+'?type=signal&k='+this.userName);
    var own = this;
    var path = this.info.channel ? this.apiUrl+'/_host'+this.channelPath+'?type=signal&k='+this.userName :this.apiUrl+'/_host?type=signal&k='+this.userName;
    var _headers = {};
    if(ident && secret){
        _headers["Authorization"] = "Basic " + btoa(ident + ":" + secret);
    }
    $.ajax({
        url: path,
        type: 'GET',
        dataType: 'json',
        headers: _headers,
        error: function(data) { console.log('*signal*  error: ', data);},
        success: function(data) {
            own.host = data.v +'/'+own.ver+'/'+ own.tmpToken;
            console.log('signal host: ',own.host);
            own.setupSocket();
        }
    });
}

//setup socket to signaling server.
_sig.prototype.setupSocket = function(){
    console.log('*signal*  setupSocket to '+this.host);
    var own = this;
    this.sig = new WebSocket(this.host);
    //notify when connection is open
    this.sig.addEventListener('open', evt => {
        own.startHeart();
        own.connected = true;
    });
    //notify when connection closed
    this.sig.addEventListener('close', evt => {
        if(this.heartbeat) own.stopHeart();
        own.connected = false;
        this.sig = null;
    });

    //add pending listeners to signaling object.
    var l = this.pendListeners.length;
    if(l > 0){
        for( var i=0; i<l; i++ ){
            var item = this.pendListeners[i];
            this.on(item.event,item.f);
        }
        this.pendListeners = [];
    }
    //notify when a message is received from signal network.
    this.sig.addEventListener('message', msg => {
        var pkt = JSON.parse(msg.data);
        console.log('*signal*  signal message! ',pkt);
        var payload = pkt.p;//the actual message data sent
        var meta = pkt.m;//meta object
        var msgEvent = meta.o;//event label of message
        var toPeer = meta.t;//msg to user (if private msg)
        var fromPeer = meta.f;//msg from user
        if(!!fromPeer) {//remove the peer path to display just the name not path.
            var p = fromPeer.split("/");
            fromPeer = p[p.length - 1];
        }
        switch (msgEvent) {
            //first connect, list of all peers connected.
            case "peers":
                //this is first call when you connect,
                //  so we can check for channelPath here dynamically.
                var sysNum = meta.f.lastIndexOf('__sys__');
                if(sysNum > -1 && !this.channelPath){
                    own.channelPath = meta.f.substring(0,sysNum);//save message path for sending.
                    console.log('*signal*  channelPath ',this.channelPath);
                }
                //setUsers(payload.users);
                break;
            //new peer connected
            case "peer_connected":
                //addUser(fromPeer);
                break;
            //peer left.
            case "peer_removed":
                //removeUser(fromPeer);
                break;
            //message received. Call to display.
            case 'message':
                //onUserMsg(payload.msg, fromPeer, toPeer);
                var data = payload.msg;
                data.f = fromPeer;
                if(data.type == 'candidate' || data.type == 'offer' || data.type == 'answer' || data.type == 'custom' ){
                    own.emit(data.type, data);
                }
                break;
        }
        own.emit('message', msg.data);
    });
    //console.log('sig:  ',this.sig);
}
// User event, sends user message.
_sig.prototype.sendMessage = function(msg, toPeer, info){
    if(!info) info = {};
    console.log('*signal*  sendMessage: ',msg,', to: ',toPeer,' info: ',info);
    if(msg == undefined || msg.length < 1) return;
    var pkt = {
        t: "u", // user message service
        m: {
            f: this.channelPath + this.userName,
            o: !!info.m_event ? info.m_event : 'message'
        },
        p: {msg:msg}
    }
    //if its to a peer, add direct message var (t) to meta object.
    if(!!toPeer) pkt.m.t = toPeer;
    //console.log('*signal*  sendMessage pkt: ',pkt);
    this.sig.send(JSON.stringify(pkt));

    return pkt;
}

//formats the custom channel path how we need it.
_sig.prototype.cleanChPath = function(path){
    //has slash at front
    if(path.indexOf('/') != 0) path = '/'+path;
    if(path.lastIndexOf('/') == (path.length - 1)) path = path.substr(0,path.lastIndexOf('/'));
    //console.log('cleanChPath new path: '+path);
    return path;
}

//Keeps pinging signal server to keep connection alive.
_sig.prototype.startHeart = function(){
    //console.log('*signal*  startHeart ',this.keepAliveInt);
    if(!!this.heartbeat) clearInterval(this.heartbeat);
    var own = this;
    this.heartbeat = setInterval(function () {own.sig.send('ping');}, $xirsys.signal.keepAliveInt);
}
_sig.prototype.stopHeart = function(){
    clearInterval(this.heartbeat);
    this.heartbeat = null;
    //this.sig = null;
    console.log('signal closed!');
}

//events
_sig.prototype.on = function(sEvent,cbFunc){
    //console.log('*signal*  on ',sEvent,', func: '+cbFunc);
    if(!sEvent || !cbFunc) {
        console.log('error:  missing arguments for "on" event.');
        return false;
    }
    //if event does not exist create it and give it an array for listeners.
    if(!this.evtListeners[sEvent]) this.evtListeners[sEvent] = [];
    //add listener to event.
    this.evtListeners[sEvent].push(cbFunc);
}
_sig.prototype.off = function(sEvent,cbFunc){
    if (!this.evtListeners.hasOwnProperty(sEvent)) return false;//end

    var index = this.evtListeners[sEvent].indexOf(cbFunc);
    if (index != -1) {
        this.evtListeners[sEvent].splice(index, 1);
        return true;//else end here.
    }
    return false;//else end here.
}

_sig.prototype.emit = function(sEvent, data){
    //console.log('*signal*  emit ',sEvent,', func: '+data);
    var handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        var l = handlers.length;
        for(var i=0; i<l; i++){
            var item = handlers[i];
            item.apply(this,[{type:sEvent,data:data}]);
        }
    }
}
console.log('$xirsys.signal Loaded Successfuly!!!');
_sig = null;
