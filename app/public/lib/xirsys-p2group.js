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
var _p2group = $xirsys.p2group = function (signal, mediaStream, servers, info) {
    if(!info) info = {};
    //info can have TURN only filter.
    console.log('*p2group*  constructor - servers:',servers,'mediaStream:',mediaStream,'sig:',signal,'info:',info);
    this.evtListeners = {};
    //this.pc;//peer connection

    var own = this;
    this.sig = signal;
    if(!!this.sig) {
        this.sig.on('candidate', evt => { own.receiveCandidate(evt); });
        this.sig.on('offer', evt => { own.receiveOffer(evt); });
        this.sig.on('answer', evt => { own.receiveAnswer(evt); });
        this.sig.on('custom', evt => { own.onCustomMSG(evt); });
    }
    this.servers = !!servers ? servers : {};
    this.forceTurn = !!info.forceTurn ? info.forceTurn : false;
    this.stream = mediaStream;
    //this.remotePeerID;
    this.remoteStreams = {};//current live streams
    this.firstConnect = true;
    this.isCaller = false;//true / false
    this.pcList = {};
}

_p2group.prototype.peerConnSuccess = 'peer.connect.success';

//this user initates a remote peer call
_p2group.prototype.callPeer = function(peerID){
    console.log('*p2group*  callPeer ',peerID);
    var pc = this.createPeerConnection(peerID);
    if(!!pc){
        this.isCaller = true;
        var own = this;
        //this.remotePeerID = peerID;
        this.pcList[peerID] = {id:peerID,pc:pc,stream:null};
        pc.addStream(this.stream);
        pc.createOffer()
            .then(desc => {own.setLocalAndSendMessage(desc,peerID);}) // success
            .catch(err => {own.onCreateSessionDescriptionError(err);}); // error
        if(this.firstConnect){
            pc.requestGroup = true;//call peer to request its group members.
        }
    }
}
//webrtc: this client received a peer candidate from remote peer.
_p2group.prototype.receiveCandidate = function(evt){
    var iceCandidate = evt.data;
    var peerInfo = this.getLivePeer(iceCandidate.f);
    //console.log('*p2group*  receiveCandidate  peer: ',peerInfo,', ',iceCandidate);
    try {
        var rtcIceCandidate = new RTCIceCandidate(iceCandidate);
        peerInfo.pc.addIceCandidate(rtcIceCandidate);
    } catch(e) {
        console.log('Error: Could not set remote candidate for: ',iceCandidate.f,'. Peer info is: ',peerInfo);
    }
}

//webrtc: this client received offer from a remote peer to do a call.
_p2group.prototype.receiveOffer = function(evt) {
    var desc = evt.data;
    var peerID = desc.f;
    console.log('*p2group*  receiveOffer',desc,'peerID =',peerID);
    //if(!this.remotePeerID && !!desc.f) this.remotePeerID = desc.f;
    var peerInfo = this.getLivePeer(peerID);
    var pc = !!peerInfo ? peerInfo.pc : null;
    console.log('*p2group*  !pc ',pc,', !iscaller: ',this.isCaller);
    if(!pc && !this.isCaller) {
        var pc = this.createPeerConnection(peerID);
        if(!!pc){
            pc.addStream(this.stream);
            this.pcList[peerID] = {id:peerID,pc:pc,stream:null};
        }
    }
    var own = this;
    pc.setRemoteDescription(new RTCSessionDescription(desc));
    pc.createAnswer()
        .then(desc => {own.setLocalAndSendMessage(desc,peerID);}) // success
        .catch(err => {own.onCreateSessionDescriptionError(err);}); // error
    //this.isCaller = false;
}

//webrtc: the local client receiced an answer from the remote peer this client called.
_p2group.prototype.receiveAnswer = function(evt){
    var desc = evt.data;
    console.log('*p2group*  receiveAnswer ',desc);
    var peerInfo = this.getLivePeer(desc.f);
    if(peerInfo == null) return;//not the peer were looking for.
    peerInfo.pc.setRemoteDescription(new RTCSessionDescription(desc));
}

_p2group.prototype.onCustomMSG = function(evt){
    console.log('*p2group*  onCustomMSG ',evt);
    var desc = evt.data,
        list = [];
    //try{
        switch(desc.code){
            case 'request_peergroup':
                list = this.getPeersList();
                console.log('Peers List:',list);
                this.sig.sendMessage({type:'custom',code:'receive_peergroup',data:list}, desc.f);
                break;
            case 'receive_peergroup':
                console.log('Got List to connect ',desc.data);
                //todo remove oursleves from the list. create connections.
                list = desc.data;
                for(var i=0; i<list.length; i++){
                    var item = list[i];
                    console.log('username ',this.sig.userName);
                    if(item != this.sig.userName){
                        this.callPeer(item);
                    }
                }
                break;
        }
    //} catch(e) {
        //console.log('Could not apply custom msg ',evt);
    //}
    var peerInfo = this.getLivePeer(desc.f);
}

_p2group.prototype.createPeerConnection = function(peerID){
    console.log('*p2group*  createPeerConnection ',peerID);
    //if(!!this.pc) return true;
    try {
        var own = this;
        console.log('RTCPeerConnection servers:  ',this.servers);
        var pc = new RTCPeerConnection(this.servers);
        pc._id = peerID;
        pc.onicecandidate = function(evt) {
            //send to peer 
            var cand = evt.candidate;
            if(!cand) return;
            //if we are forcing turn and this is NOT a relay type, ignore candidate.
            if(own.forceTurn && cand.candidate.indexOf('typ relay') == -1) {
                cand = null;
            } else {
                own.sig.sendMessage({
                    type:'candidate',
                    candidate: cand.candidate,
                    sdpMid: cand.sdpMid,
                    sdpMLineIndex: cand.sdpMLineIndex
                }, peerID);//own.remotePeerID);
            }
        }
        pc.onaddstream = evt => {
            console.log('*p2group* '+peerID+' onaddstream evt:',evt);
            own.addStream(evt.stream,peerID);//remoteStreams
        }
        pc.onremovestream = evt => console.log('*p2group* '+peerID+' onremovestream ',evt);
        pc.onconnectionstatechange = evt => console.log("*p2group* "+peerID+" onconnectionstatechange: " + pc.connectionState);
        pc.oniceconnectionstatechange = evt => {
            var peerID = pc._id;
            console.log("*p2group* "+peerID+" oniceconnectionstatechange: " + pc.iceConnectionState);
            switch(pc.iceConnectionState){
                case 'checking':
                    break;
                case 'connected':
                    //todo - do call to connect to rest of group.
                    console.log('call group?',pc.requestGroup,', firstConnect?',own.firstConnect);
                    if(!!pc.requestGroup && !!own.firstConnect) {
                        own.firstConnect = false;
                        pc.requestGroup = false;
                        own.doRequestGroup(pc._id);
                    }
                    break;
                case 'disconnected':
                    console.log('*p2group* '+peerID+' disconnected ',evt);
                    break;
                case 'closed':
                    var peerInfo = own.getLivePeer(peerID);
                    try {
                        delete peerInfo.pc;
                        delete own.pcList[peerID];
                    } catch(e) {
                        console.log('Error: Could not close call with:',peerID,'. Peer info is:',peerInfo);
                    }
                    console.log('id:',peerID,'pcList:',own.pcList,', item:',own.pcList[peerID]);
                    break;
            }
        }
        return pc;
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        return;
    }
}

_p2group.prototype.hangup = function(peerID) {
    var peerInfo = this.getLivePeer(peerID);
    try{
        peerInfo.pc.close();
        var stream = this.remoteStreams[peerID];
        this.remoteStreams[peerID] = null;
        //this.remotePeerID = null;
    } catch(e){
        console.log('Error: Could not hangup call with: ',peerID,'. Peer info is: ',peerInfo);
    }
    //if no streams close and nulify pc.
    //this.pc = null;
}

_p2group.prototype.addStream = function(remoteStream,peerID) {
    var peerInfo = this.getLivePeer(peerID);
    try {
        peerInfo.stream = remoteStream;
    } catch (e){
        console.log('Error: Could not update stream for: ',peerID,'. Peer info is: ',peerInfo);
    }
    this.isCaller = false;
    this.emit(this.peerConnSuccess, peerID);
}

_p2group.prototype.getLiveStream = function(peerID) {
    var peerInfo = this.getLivePeer(peerID);
    try {
        return peerInfo.stream;
    } catch (e){
        console.log('Error: Could not update stream for: ',peerID,'. Peer info is: ',peerInfo);
    }
}

_p2group.prototype.getLivePeer = function(peerID) {
    return this.pcList[peerID];
}

_p2group.prototype.getPeersList = function() {
    var list = [];
    for(var i in this.pcList) list.push(i);
    return list;
}

_p2group.prototype.length = function(peerID) {
    var l=0;
    for(var i in pcList) l++;
    return l;
}
_p2group.prototype.doRequestGroup = function(peerID) {
    this.sig.sendMessage({type:'custom',code:'request_peergroup'}, peerID);
}

_p2group.prototype.setLocalAndSendMessage = function(sessionDescription, peerID) {
    console.log('*p2group*  setLocalAndSendMessage sending message', sessionDescription,', id:',peerID);
    var peerInfo = this.getLivePeer(peerID);
    try {
        peerInfo.pc.setLocalDescription(sessionDescription);
        console.log('sendMessage for: ',peerID);
        this.sig.sendMessage(sessionDescription, peerID);
    } catch(e){
        console.log('Error: Could not set local session description for: ',peerID,'connection. Peer info is: ',peerInfo);
    }
}

_p2group.prototype.onCreateSessionDescriptionError = function(error) {
  console.log('Failed to create session description: ', error);
}

/* EVENTS */

_p2group.prototype.on = function(sEvent,cbFunc){
    //console.log('*p2group*  on ',sEvent,', func: '+cbFunc);
    if(!sEvent || !cbFunc) {
        console.log('error:  missing arguments for on event.');
        return false;
    }
    if(!this.evtListeners[sEvent]) this.evtListeners[sEvent] = [];
    this.evtListeners[sEvent].push(cbFunc);
}
_p2group.prototype.off = function(sEvent,cbFunc){
    console.log('off');
    this.evtListeners.push(cbFunc);
}

_p2group.prototype.emit = function(sEvent, data){
    var handlers = this.evtListeners[sEvent];
    if(!!handlers) {
        var l = handlers.length;
        for(var i=0; i<l; i++){
            var item = handlers[i];
            item.apply(this,[{type:sEvent,data:data}]);
        }
    }
}

console.log('$xirsys.p2group Loaded Successfuly!!!');
_p2group = null;