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
var _p2p = $xirsys.p2p = function (signal, mediaStream, servers) {
    //info can have TURN only filter.
    console.log('*p2p*  constructor - servers: ',servers,', mediaStream: ',mediaStream,', sig: ',signal);
    this.evtListeners = {};
    this.pc;//peer connection

    var own = this;
    this.sig = signal;
    if(!!this.sig) {
        this.sig.on('candidate', evt => { own.receiveCandidate(evt); });
        this.sig.on('offer', evt => { own.receiveOffer(evt); });
        this.sig.on('answer', evt => { own.receiveAnswer(evt); });
    }
    this.servers = !!servers ? servers : {};
    this.stream = mediaStream;
    this.remotePeerID;
    this.remoteStreams = {};

    this.isCaller;//true / false
}

_p2p.prototype.callPeer = function(custID){
    console.log('*p2p*  callPeer ',custID);
    if(this.createPeerConnection()){
        this.isCaller = true;
        var own = this;
        this.remotePeerID = custID;
        this.pc.addStream(this.stream);
        this.pc.createOffer ( 
            desc => {own.setLocalAndSendMessage(desc);}, // success
            err => {own.onCreateSessionDescriptionError(err);} // error
        );
    }
}

_p2p.prototype.receiveCandidate = function(evt){
    var iceCandidate = evt.data;
    //console.log('*p2p*  receiveCandidate ',iceCandidate);
    var rtcIceCandidate = new RTCIceCandidate(iceCandidate);
    this.pc.addIceCandidate(rtcIceCandidate);
}

_p2p.prototype.receiveOffer = function(evt){
    var desc = evt.data;
    //console.log('*p2p*  receiveOffer ',desc);
    if(!this.remotePeerID && !!desc.f) this.remotePeerID = desc.f;
    if(!this.pc && !this.isCaller) {
        if(this.createPeerConnection()){
            this.pc.addStream(this.stream);
        }
    }
    var own = this;
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
    this.pc.createAnswer(
        desc => {own.setLocalAndSendMessage(desc);}, // success
        err => {own.onCreateSessionDescriptionError(err);} // error
    );
}

_p2p.prototype.receiveAnswer = function(evt){
    var desc = evt.data;
    //console.log('*p2p*  receiveAnswer ',desc);
    if(this.remotePeerID != desc.f) return;//not the droid were looking for.
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
}

_p2p.prototype.createPeerConnection = function(){
    console.log('*p2p*  createPeerConnection ');
    try {
        var own = this;
        this.pc = new RTCPeerConnection(this.servers);
        this.pc.onicecandidate = function(evt) {
            //send to peer 
            var candidate = evt.candidate;
            if(!!candidate){
                own.sig.sendMessage({
                    type:'candidate',
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex
                }, own.remotePeerID);
            }
        }
        this.pc.onaddstream = function(evt) {
            console.log('*p2p*  onaddstream ',evt);
            own.addStream(evt.stream);//remoteStreams
        }
        this.pc.onremovestream = function(evt) {
            console.log('*p2p*  onremovestream ',evt);
        }
        return true;
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        return false;
    }
}

_p2p.prototype.hangup = function(callId) {
    var stream = this.remoteStreams[callId];
    this.pc.close();
    this.remoteStreams[callId] = null;
    //if no streams close and nulify pc.
    this.pc = null;
    this.emit('peer.disconnect', callId);
}

_p2p.prototype.addStream = function(remoteStream) {
    this.remoteStreams[this.remotePeerID] = remoteStream;
    this.emit('peer.connect.success', this.remotePeerID);
}
_p2p.prototype.getLiveStream = function(remotePeerID) {
    return this.remoteStreams[remotePeerID];
}
_p2p.prototype.setLocalAndSendMessage = function(sessionDescription) {
    console.log('*p2p*  setLocalAndSendMessage sending message', sessionDescription);
    this.pc.setLocalDescription(sessionDescription);
    //sendMessage(sessionDescription);
    this.sig.sendMessage(sessionDescription, this.remotePeerID);
}

_p2p.prototype.onCreateSessionDescriptionError = function(error) {
  console.log('Failed to create session description: ', error);
}

/* EVENTS */

_p2p.prototype.on = function(sEvent,cbFunc){
    //console.log('*p2p*  on ',sEvent);
    if(!sEvent || !cbFunc) {
        console.log('error:  missing arguments for on event.');
        return false;
    }
    if(!this.evtListeners[sEvent]) this.evtListeners[sEvent] = [];
    this.evtListeners[sEvent].push(cbFunc);
}
_p2p.prototype.off = function(sEvent,cbFunc){
    console.log('off');
    this.evtListeners.push(cbFunc);
}

_p2p.prototype.emit = function(sEvent, data){
    var handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        var l = handlers.length;
        for(var i=0; i<l; i++){
            var item = handlers[i];
            item.apply(this,[{type:sEvent,data:data}]);
        }
    }
}

console.log('$xirsys.p2p Loaded Successfuly!!!');
_p2p = null;