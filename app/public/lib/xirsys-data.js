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

var _dl = $xirsys.dataLayer = function (apiUrl, info ) {
    if(!info) info = {};
    //internal values
    this.apiUrl = !!apiUrl ? apiUrl : '/webrtc';
    this.info = info;
    this.evtListeners = {};

    //path to dataLayer we are sending data to.
    if(!!info.channel) this.defaultChannel = this.cleanChPath(info.channel);
    console.log('*dataLayer*  defaultChannel: '+this.defaultChannel);
}

_dl.prototype.apiLayer = '_data';//API layer for Channels aka Namespace
//events
_dl.prototype.NEW_KEYS = 'newKeys';
_dl.prototype.NEW_ITEM = 'newItem';
_dl.prototype.REMOVED_ITEM = 'removedItem';

//return list of all keys from the dataLayer.
_dl.prototype.getKeys = function(channel) {
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    var path = this.apiUrl + '/' + this.apiLayer + channel;
    console.log('*dataLayer*  getKeys GET  '+path);
    var own = this;
    $.ajax({
        url: path,
        type: 'GET',
        dataType: 'json',
        error: function(data) {console.log('*dataLayer*  getKeys error: ', data);},
        success: function(data) {
            console.log('*dataLayer*  getKeys ',data);
            //own.doSignal();
            own.emit(own.NEW_KEYS, data.v);
        }
    });
}

_dl.prototype.getItem = function(idSlot,channel){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    console.log('*dataLayer*  getItem GET  '+channel);
}

_dl.prototype.updateItem = function(idSlot,data,channel){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    console.log('*dataLayer*  updateItem POST  '+channel);
}

//create a new channel. 
_dl.prototype.addItem = function(key,val,channel){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    var path = this.apiUrl + '/' + this.apiLayer + channel;
    var d = {k:key,v:val};
    console.log('*dataLayer*  addItem PUT  '+path,' data: ',d);
    var own = this;
    $.ajax({
        url: path,
        type: 'PUT',
        dataType: 'json',
        data: d,
        error: function(data) {console.log('*dataLayer* addItem error: ', data);},
        success: function(data) {
            console.log('*dataLayer* addItem ',data);
            //own.doSignal();
            if(data.s == 'ok'){
                own.emit(own.NEW_ITEM, {k:key,v:data.v});
            }
        }
    });
}

_dl.prototype.removeItem = function(key,channel){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    var path = this.apiUrl + '/' + this.apiLayer + channel + '?k='+key;
    console.log('*dataLayer*  removeItem DELETE  '+path);
    var own = this;
    $.ajax({
        url: path,
        type: 'DELETE',
        dataType: 'json',
        error: function(data) { console.log('*dataLayer*  error: ', data);},
        success: function(data) {
            console.log('*dataLayer* removeItem ',data);
            if(data.s == 'ok'){
                own.emit(own.REMOVED_ITEM, {k:key,v:data.v});
            }
        }
    });
}

_dl.prototype.watchItem = function(idSlot,channel){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    console.log('*dataLayer*  watchItem POST  '+channel);
}

_dl.prototype.removeAll = function(channel){
    channel = !!channel ? this.cleanChPath(channel) : this.defaultChannel;
    console.log('*dataLayer*  removeAll DELETE  '+channel);
}


/* UTILS */

//formats the custom channel path how we need it.
_dl.prototype.cleanChPath = function(path){
    //has slash at front
    if(path.indexOf('/') != 0) path = '/'+path;
    if(path.lastIndexOf('/') == (path.length - 1)) path = path.substr(0,path.lastIndexOf('/'));
    //console.log('*dataLayer*  cleanChPath path: '+path);
    return path;
}



/* EVENTS */

_dl.prototype.on = function(sEvent,cbFunc){
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
_dl.prototype.off = function(sEvent,cbFunc){
    if (!this.evtListeners.hasOwnProperty(sEvent)) return false;//end

    var index = this.evtListeners[sEvent].indexOf(cbFunc);
    if (index != -1) {
        this.evtListeners[sEvent].splice(index, 1);
        return true;//else end here.
    }
    return false;//else end here.
}
_dl.prototype.emit = function(sEvent, data){
    var handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        var l = handlers.length;
        for(var i=0; i<l; i++){
            var item = handlers[i];
            item.apply(this,[{type:sEvent,data:data}]);
        }
    }
}

console.log('$xirsys.dataLayer Loaded Successfuly!!!');
_dl = null;
