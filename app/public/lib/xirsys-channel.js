/*********************************************************************************
  The MIT License (MIT) 

  Copyright (c) 2018 Xirsys

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
var _ch = $xirsys.channel = function (apiUrl, info ) {
    if(!info) info = {};
    console.log('*channel*  apiURL: ',apiURL,', info: ',info);
    //internal values
    this.apiUrl = !!apiUrl ? apiUrl : '/webrtc';
    this.info = info;
    this.evtListeners = {};

    //path to channel we are sending data to.
    if(!!info.channel) this.defaultChannel = this.cleanChPath(info.channel);
    console.log('*channel*  defaultChannel: '+this.defaultChannel);
}

_ch.prototype.chDepth = 'depth=10';//query depth of sub-channels. Set depth if your channel has a deep subchannel path.
_ch.prototype.apiLayer = '_ns';//API layer for Channels aka Namespace

//events
_ch.prototype.NEW_CHANNEL = 'newChannel';
_ch.prototype.REMOVE_CHANNEL = 'removeChannel';
_ch.prototype.ON_CHANNELS = 'onChannels';

//create a new channel. 
_ch.prototype.addChannel = function(channel){
    var newPath = this.cleanChPath(channel);
    var path = this.apiUrl+"/"+this.apiLayer + newPath;
    console.log('*channel*  addChannel PUT '+path);
    var own = this;
    $.ajax({
        url: path,
        type: 'PUT',
        dataType: 'json',
        error: function(data) {console.log('*channel* doChannel error: ', data);},
        success: function(data) {
            console.log('*channel* addChannel ',data);
            //own.doSignal();
            if(data.s == 'ok'){
                own.emit(own.NEW_CHANNEL, {channel:channel,v:data.v});
            }
        }
    });
}

_ch.prototype.removeChannel = function(channel){
    var chPath = this.cleanChPath(channel);
    var path = this.apiUrl+"/"+this.apiLayer + chPath;
    console.log('*channel*  removeChannel DELETE '+path);
    var own = this;
    $.ajax({
        url: path,
        type: 'DELETE',
        dataType: 'json',
        error: function(data) { console.log('*channel*  error: ', data);},
        success: function(data) {
            console.log('*channel*  removeChannel ',data);
            if(data.s == 'ok'){
                own.emit(own.REMOVE_CHANNEL, {channel:channel});
            }
        }
    });
    return true;
}

_ch.prototype.getChannels = function(channel,info){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    var depth = "depth="+(!!info.depth ? info.depth : this.chDepth);
    var path = this.apiUrl+"/"+this.apiLayer + channel + '?' + depth;
    console.log('*channel*  getChannels GET  '+path);
    var own = this;
    $.ajax({
        url: path,
        type: "GET",
        dataType: "json",
        error: function(data) { console.log('*channel*  error: ', data);}
    }).done(function (data) {
        console.log('*channel*  getChannels() _ns/ ',data);
        if (data.s == "ok"){
            //update entire channel list
            own.emit(own.ON_CHANNELS, {path:channel,list:data.v});
        } else {
            console.log(data.v);
        }
    })
}


//UTILS

//formats the custom channel path how we need it.
_ch.prototype.cleanChPath = function(path){
    //has slash at front
    if(path.indexOf('/') != 0) path = '/'+path;
    if(path.lastIndexOf('/') == (path.length - 1)) path = path.substr(0,path.lastIndexOf('/'));
    //console.log('*channel*  cleanChPath path: '+path);
    return path;
}



/* EVENTS */

_ch.prototype.on = function(sEvent,cbFunc){
    //console.log('*p2group*  on ',sEvent,', func: '+cbFunc);
    if(!sEvent || !cbFunc) {
        console.log('error:  missing arguments for "on" event.');
        return false;
    }
    //if event does not exist create it and give it an array for listeners.
    if(!this.evtListeners[sEvent]) this.evtListeners[sEvent] = [];
    //add listener to event.
    this.evtListeners[sEvent].push(cbFunc);
}
_ch.prototype.off = function(sEvent,cbFunc){
    if (!this.evtListeners.hasOwnProperty(sEvent)) return false;//end

    var index = this.evtListeners[sEvent].indexOf(cbFunc);
    if (index != -1) {
        this.evtListeners[sEvent].splice(index, 1);
        return true;//else end here.
    }
    return false;//else end here.
}

_ch.prototype.emit = function(sEvent, data){
    var handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        var l = handlers.length;
        for(var i=0; i<l; i++){
            var item = handlers[i];
            item.apply(this,[{type:sEvent,data:data}]);
        }
    }
}

console.log('$xirsys.channel Loaded Successfuly!!!');
_ch = null;
