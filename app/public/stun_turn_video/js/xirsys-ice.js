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
var _ice = $xirsys.ice = function (apiUrl, info) {
    this.apiUrl = !!apiUrl ? apiUrl : '/webrtc';
    //info can have TURN only filter.
    //console.log('*ice*  constructor: ',this.apiUrl);
    this.evtListeners = {};
    this.iceServers;
    if(!!this.apiUrl){
        this.doICE();//first get our token.
    }
}

_ice.prototype.onICEList = 'onICEList';

_ice.prototype.doICE = function () {
    console.log('*ice*  doICE: ',this.apiUrl);
    var own = this;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function($evt){
        if(xhr.readyState == 4 && xhr.status == 200){
            var res = JSON.parse(xhr.responseText);
            console.log('*ice*  response: ',res);
            own.iceServers = own.urlToUrls(res.v.iceServers);
            
            own.emit(own.onICEList);
        }
    }
    xhr.open("PUT", this.apiUrl+"/_turn", true);
    xhr.send();
}

//check for depricated RTCIceServer url property, needs to be urls now.
_ice.prototype.urlToUrls = function(arr){
    var l = arr.length, i;
    for(i=0; i<l; i++){
        var item = arr[i];
        var v = item.url;
        if(!!v){
            item.urls = v;
            delete item.url;
        }
    }
    return arr;
}

_ice.prototype.on = function(sEvent,cbFunc){
    //console.log('*ice*  on ',sEvent);
    if(!sEvent || !cbFunc) {
        console.log('error:  missing arguments for on event.');
        return false;
    }
    if(!this.evtListeners[sEvent]) this.evtListeners[sEvent] = [];
    this.evtListeners[sEvent].push(cbFunc);
}
_ice.prototype.off = function(sEvent,cbFunc){
    //console.log('off');
    this.evtListeners.push(cbFunc);
}

_ice.prototype.emit = function(sEvent, data){
    var handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        var l = handlers.length;
        for(var i=0; i<l; i++){
            var item = handlers[i];
            item.apply(this,[{type:this.onICEList}]);
        }
    }
}

console.log('$xirsys.ice Loaded Successfuly!!!');
_ice = null;