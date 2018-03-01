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
let _md = $xirsys.media = function (info) {
    if(!info) info = {};
    console.log('*media*  info: ',info);
    //internal values
    this.info = info;
    this.evtListeners = {};
    this.getLocalDevices()
        .then( devices => {
            this.updateDevices(devices);
        });
}

_md.prototype.localDevices;
_md.prototype.localStream;

//events
_md.prototype.DEVICES_UPDATED = 'devicesUpdated';
_md.prototype.ON_LOCAL_STREAM = 'onLocalStream';

/* PUBLIC */

_md.prototype.getUserMedia = function(constraints,cbSuccess,cbFail){
    if(!constraints) constraints = {audio:true,video:true};
    //return promise
    var own = this;
    return navigator.mediaDevices.getUserMedia(constraints)
        .then( str => {
            own.localStream = str;
            own.emit(own.ON_LOCAL_STREAM, str);
            return str;
        });
        /* .catch(err => { 
            console.log('Could not get Media: ', err);
            throw err;
        }); */
};

_md.prototype.getLocalDevices = function(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.log("Error: Could not get list of media devices!  This might not be supported by this browser.");
        return;
    }
    let d = navigator.mediaDevices.enumerateDevices();
    return d;
}

/* PRIVATE */

_md.prototype.updateDevices = function(list){
    console.log('*media*  updateDevices ',list);
    if(arguments.length == 0) return;
    //set local list. dispatch event that list is updated.
    let items = {audioin:[],videoin:[]};
        
    list.forEach(device => {
        //console.log('device: ',device);
        if(device.deviceId == 'default'){
            if(!items.defaults) items.defaults = [];
            items.defaults.push(device);
            return;
        }
        switch(device.kind) {
            case 'audioinput':
                if(device.deviceId != 'default'){
                    items.audioin.push(device);
                }
                break;
            case 'videoinput':
                if(device.deviceId != 'default'){
                    items.videoin.push(device);
                }
                break;
        }
    });
    //console.log('Items list: ',items);
    this.localDevices = items;
    this.emit(this.DEVICES_UPDATED, this.localDevices);
}

//UTILS



/* EVENTS */

_md.prototype.on = function(sEvent,cbFunc){
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
_md.prototype.off = function(sEvent,cbFunc){
    if (!this.evtListeners.hasOwnProperty(sEvent)) return false;//end

    let index = this.evtListeners[sEvent].indexOf(cbFunc);
    if (index != -1) {
        this.evtListeners[sEvent].splice(index, 1);
        return true;//else end here.
    }
    return false;//else end here.
}

_md.prototype.emit = function(sEvent, data){
    let handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        let l = handlers.length, i;
        for(i=0; i<l; i++){
            let item = handlers[i];
            item.apply(this,[{type:sEvent,data:data}]);
        }
    }
}

console.log('$xirsys.media Loaded Successfuly!!!');
_md = null;
