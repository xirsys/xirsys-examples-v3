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

    //internal values
    this.sig = null;//local signal object.
    this.tmpToken;//authorized token for signal calls
    this.sigHostPath;//full authorized path to signaling service.
    this.pendListeners = [];//event listener - hold until init.
    this.heartbeat;//interval that keeps the signal open.
    this.evtListeners = {};

    //path to channel we are sending data to.
    this.channelPath = !!info.channelPath ? info.channelPath : '';

    this.userName = !!userName ? userName : null;
    this.apiUrl = !!apiUrl ? apiUrl : '/webrtc';
    console.log('*signal*  constructed');
    if(!!this.userName && !!this.apiUrl){
        this.doToken();//first get our token.
    }
}

_sig.prototype.ver = 'v2';
_sig.prototype.keepAliveInt = 800;


_sig.prototype.doToken = function(){
    console.log('*signal*  PUT doToken to '+this.apiUrl+'/_token?k='+this.userName);
    var own = this;
    $.ajax({
        url: this.apiUrl+'/_token?k='+this.userName,
        type: 'PUT',
        dataType: 'json',
        error: function(data) {console.log('*signal*  error: ', data);},
        success: function(data) {
            own.tmpToken = data.v;
            console.log('*signal*  token: ',own.tmpToken);
            own.doSignal();
        }
    });
}

_sig.prototype.doSignal = function(){
    console.log('GET doSignal to '+this.apiUrl+'/_host?type=signal&k='+this.userName);
    var own = this;
    $.ajax({
        url: this.apiUrl+'/_host?type=signal&k='+this.userName,
        type: 'GET',
        dataType: 'json',
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
    this.sig.addEventListener('open', evt => {  own.startHeart(); });//notify when connection is open
    //notify when connection closed
    this.sig.addEventListener('close', evt => { 
        clearInterval(own.heartbeat);
        own.heartbeat = null;
        console.log('signal closed!');
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
        //console.log('signal message! ',pkt);
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
                if(data.type == 'candidate' || data.type == 'offer' || data.type == 'answer'){
                    own.emit(data.type, data);
                }
                break;
        }
    });
    console.log('sig:  ',this.sig);
}
// User event, sends user message.
_sig.prototype.sendMessage = function(msg, toPeer){
    //console.log('*signal*  sendMessage: ',msg,', to: ',toPeer);
    if(msg == undefined || msg.length < 1) return;
    var pkt = {
        t: "u", // user message service
        m: {
            f: this.channelPath + this.userName,
            o: 'message'
        },
        p: {msg:msg}
    }
    if(!!toPeer) pkt.m.t = toPeer;
    //console.log('*signal*  sendMessage pkt: ',pkt);
    this.sig.send(JSON.stringify(pkt));
}

//Keeps pinging signal server to keep connection alive.
_sig.prototype.startHeart = function(){
    //console.log('*signal*  startHeart ',this.keepAliveInt);
    if(!!this.heartbeat) clearInterval(this.heartbeat);
    var own = this;
    this.heartbeat = setInterval(function () {own.sig.send('ping');}, $xirsys.signal.keepAliveInt);
}

//events
_sig.prototype.on = function(sEvent,cbFunc){
    //todo set events that we use to dispatch
    //console.log('*signal*  add event: ',sEvent,', func: ',cbFunc);
    if( !!this.sig ){
        this.sig.addEventListener(sEvent,cbFunc);
    } else {
        this.pendListeners.push({event:sEvent,f:cbFunc});
        console.log('pending listeners: ',this.pendListeners);
    }
}
_sig.prototype.off = function(sEvent,cbFunc){
    //todo set events that we use to dispatch
    //console.log('*signal*  remove event: ',sEvent,', func: ',cbFunc);
    this.sig.removeEventListener(sEvent,cbFunc);
}
_sig.prototype.emit = function(sEvent, data){
    var e  = new MessageEvent(sEvent,{data: data});
    this.sig.dispatchEvent(e);//, data
}

console.log('$xirsys.signal Loaded Successfuly!!!');
_sig = null;
