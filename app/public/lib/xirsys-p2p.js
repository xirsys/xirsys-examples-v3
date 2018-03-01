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
var _p2p = $xirsys.p2p = function (signal, mediaStream, servers, info) {
    if(!info) info = {};
    //info can have TURN only filter.
    console.log('*p2p*  servers: ',servers,', mediaStream: ',mediaStream,', sig: ',signal,', info: ',info);
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
    this.forceTurn = info.forceTurn != null ? info.forceTurn : false;
    this.stream = mediaStream;
    this.remotePeerID;
    this.remoteStreams = {};

    this.isCaller;//true / false
    this.autoAnswer = info.autoAnswer != null ? info.autoAnswer : true;
}

_p2p.prototype.peerConnSuccess = 'peer.connect.success';
_p2p.prototype.peerConnRequest = 'peer.connect.request';
_p2p.prototype.iceDisconnected = 'peer.connect.disconnected';

_p2p.prototype.close = function(){
    if(this.pc) {
        this.pc.close();
    }
    this.remoteStreams = {};
    this.remotePeerID = null;
    this.isCaller = null;
}
//used to update the media and renegociate p2p connection.
_p2p.prototype.updateMediaStream = function(mediaStream){
    console.log('*p2p*  updateMediaStream ',mediaStream);
    
    this.stream = mediaStream;
    if(!!this.pc){
        this.isCaller = true;
        const own = this;
        this.pc.addStream(this.stream);
        this.pc.createOffer()
            .then(desc => {own.setLocalAndSendMessage(desc);}) // success
            .catch(err => {own.onCreateSessionDescriptionError(err);}); // error
    }
    return true;
}
//calls peer @custID and estblishes a p2p connection.
_p2p.prototype.callPeer = function(custID){
    console.log('*p2p*  callPeer ',custID);
    if(this.createPeerConnection()){
        //this flag tells our code we are doing the calling.
        this.isCaller = true;
        const own = this;
        this.remotePeerID = custID;
        this.pc.addStream(this.stream);
        this.pc.createOffer()
            .then(desc => {own.setLocalAndSendMessage(desc);}) // success
            .catch(err => {own.onCreateSessionDescriptionError(err);}); // error
    }
}

_p2p.prototype.receiveCandidate = function(evt){
    if(!this.pc) return false;
    var iceCandidate = evt.data;
    //console.log('*p2p*  receiveCandidate ',iceCandidate);
    var rtcIceCandidate = new RTCIceCandidate(iceCandidate);
    this.pc.addIceCandidate(rtcIceCandidate);
}

//user calles to accept offer when this has autoAnswer false
_p2p.prototype.acceptRequest = function(offer){
    //Pass offer to method with true which tells method offer was accepted.
    this.receiveOffer(offer,true);
}

_p2p.prototype.receiveOffer = function(evt,isVerfied){
    var verified = isVerfied == true;
    var desc = evt.data;
    console.log('*p2p*  receiveOffer ',desc,' remotePeerID = ',this.remotePeerID,'autoAnswer',this.autoAnswer);
    //if autoAnser is false, and this has not been verified, stop and emit request event.
    if(!this.autoAnswer && !verified){
        console.log('needs verification!');
        this.emit(this.peerConnRequest, evt.data);
        return;
    }
    //if autoAnser is false and has been verfied, OR autoAnswer is true then connect us.
    if(!this.remotePeerID && !!desc.f) this.remotePeerID = desc.f;
    console.log('*p2p*  !pc ',this.pc,', !iscaller: ',this.isCaller);
    if(!this.pc && !this.isCaller) {
        if(this.createPeerConnection()){
            this.pc.addStream(this.stream);
        }
    }
    var own = this;
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
    
    this.pc.createAnswer()
        .then(desc => {own.setLocalAndSendMessage(desc);}) // success
        .catch(err => {own.onCreateSessionDescriptionError(err);}); // error
}

_p2p.prototype.receiveAnswer = function(evt){
    var desc = evt.data;
    console.log('*p2p*  receiveAnswer ',desc);
    if(this.remotePeerID != desc.f) return;//not the droid were looking for.
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
}

_p2p.prototype.createPeerConnection = function(){
    console.log('*p2p*  createPeerConnection ');
    //if(!!this.pc) return true;
    try {
        var own = this;
        console.log('RTCPeerConnection servers:  ',this.servers);
        this.pc = new RTCPeerConnection(this.servers);
        this.pc.onicecandidate = function(evt) {
            //send to peer 
            var cand = evt.candidate;
            if(!cand) return;
            if(own.forceTurn && cand.candidate.indexOf('typ relay') == -1) {
                cand = null;
            } else {
                //console.log('Is Turn: ',own.forceTurn,' Candidate: ',cand);
                own.sig.sendMessage({
                    type:'candidate',
                    candidate: cand.candidate,
                    sdpMid: cand.sdpMid,
                    sdpMLineIndex: cand.sdpMLineIndex
                }, own.remotePeerID);
            }
        }
        this.pc.onaddstream = evt => {
            console.log('*p2p*  onaddstream ',evt);
            own.addRemoteStream(evt.stream);//remoteStreams
        }
        this.pc.onremovestream = evt => console.log('*p2p*  onremovestream ',evt);
        this.pc.onconnectionstatechange = evt => console.log("*p2p*  onconnectionstatechange: " + own.pc.connectionState);
        this.pc.oniceconnectionstatechange = evt => {
            console.log("*p2p*  oniceconnectionstatechange: " + own.pc.iceConnectionState);

            switch(own.pc.iceConnectionState){
                case 'checking':
                    break;
                case 'connected':
                    break;
                case 'disconnected':
                    own.emit(own.iceDisconnected, own.remotePeerID);
                    break;
                case 'failed':
                    break;
                case 'closed':
                    own.pc = null;
                    console.log('pc: ',own.pc);
                    break;
            }
        }
        return true;
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        return false;
    }
}

_p2p.prototype.hangup = function(callId) {
    console.log('*p2p*  hangup',callId);
    //var stream = this.remoteStreams[callId];
    this.pc.close();
    this.remoteStreams[callId] = null;
    this.remotePeerID = null;
    this.isCaller = false;
    //if no streams close and nulify pc.
    //this.pc = null;
}

_p2p.prototype.addRemoteStream = function(remoteStream) {
    this.remoteStreams[this.remotePeerID] = remoteStream;
    this.emit(this.peerConnSuccess, this.remotePeerID);
    this.isCaller = false;
}

_p2p.prototype.getLiveStream = function(remotePeerID) {
    return this.remoteStreams[remotePeerID];
}

_p2p.prototype.setLocalAndSendMessage = function(sessionDescription) {
    console.log('*p2p*  setLocalAndSendMessage sending message', sessionDescription);
    this.pc.setLocalDescription(sessionDescription);
    //sendMessage(sessionDescription);
    console.log('sendMessage for: ',this.remotePeerID);
    this.sig.sendMessage(sessionDescription, this.remotePeerID);
}

_p2p.prototype.onCreateSessionDescriptionError = function(error) {
    console.log('Failed to create session description: ', error);
}

/* EVENTS */

_p2p.prototype.on = function(sEvent,cbFunc){
    //console.log('*p2p*  on ',sEvent,', func: '+cbFunc);
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