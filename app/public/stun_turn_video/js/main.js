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

'use strict';

// Getting references to page DOM for video calling.
const localVideoEl = document.getElementById('local-video'),
    remoteVideoEl = document.getElementById('remote-video'),
    callIdEl = document.getElementById('callID'),
    turnCB = document.getElementById('isTURNcb'),
    turnViewEL = document.getElementById('isTURN'),
    shareViewEl = document.getElementById('share-view'),
    shareTitleEl = document.getElementById('share-title');
    
var mediaConstraints = {
    audio: true,
    video: {
        "min":{"width":"720","height":"360"},
        "max":{"width":"1280","height":"640"}
    }
};

var localStream,//local audio and video stream
    remoteStream,//remote audio and video stream
    ice,//ice server query.
    sig,//sigaling
    peer,//peer connection.
    media;//cam and mic class

/*if url has callid wait for other user in list with id to call
    else if no id in url create a sharable url with this username.*/
var username,//local username created dynamically.
    remoteCallID,//id of remote user
    inCall = false,//flag true if user in a call, or false if not.
    channelPath = '';//set this variable to specify a channel path

//custom: check URL for "ch" var, and set the channel accourdingly
var ch = decodeURI( (RegExp('ch' + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] );
if(ch != 'null' ) channelPath = ch;
console.log('channel path: ',channelPath);

//if there is no remoteCallID show sharable link to call user.

function callRemotePeer(){
    if (!!remoteCallID) {
        console.log('Calling ' + remoteCallID);
        peer.callPeer(remoteCallID);
    } else {
        console.log('Error', 'A remote peer was not found!');
    }
}

// Get Xirsys ICE (STUN/TURN)
function doICE(){
    console.log('doICE ');
    if(!ice){
        ice = new $xirsys.ice('/webrtc',{channel:channelPath});
        ice.on(ice.onICEList, onICE);
    }
}

function onICE(evt){
    console.log('onICE ',evt);
    if(evt.type == ice.onICEList){
        getMyMedia();
    }
}

//Get local user media
function getMyMedia(){
    console.log('getMyMedia()');
    //setup media
    if(!media){
        media = new $xirsys.media();
        media.on(media.DEVICES_UPDATED, onMediaDevices);//returns list of media devices on local user machine.
        media.on(media.ON_LOCAL_STREAM, onMediaDevices);//returns a/v stream of local user.
        //listen for camera changes.
        $('#ctrlMenu #camList').on('click', e => {
            let $targ = $(e.target);
            //if local stream exists, check if we are selecting the same device we currently are using. otherwise this is false.
            let isDup = !!localStream ? hasMedia($targ.text(),localStream.getVideoTracks()) : false;//false;
            //console.log('dup ',isDup);
            if(isDup) return;

            if(typeof(mediaConstraints.video) != 'object') mediaConstraints.video = {};
            //update mediaConstraints object with new device.
            mediaConstraints.video.deviceId = {
                exact: $targ.attr('id')
            }
            console.log('*main*  cam selected - mediaConstraints: ',mediaConstraints);
            getMyMedia();
        })
        $('#ctrlMenu #micList').on('click', e => {
            let $targ = $(e.target);
            //if local stream exists, check if we are selecting the same device we currently are using. otherwise this is false.
            let isDup = !!localStream ? hasMedia($targ.text(),localStream.getAudioTracks()) : false;//false;
            //console.log('dup ',isDup);
            if(isDup) return;

            if(typeof(mediaConstraints.audio) != 'object') mediaConstraints.audio = {};
            //update mediaConstraints object with new device.
            mediaConstraints.audio.deviceId = {
                exact: $(e.target).attr('id')
            }
            console.log('*main*  mic selected - mediaConstraints: ',mediaConstraints);
            getMyMedia();
        });
    }
    //gets stream object of local users a/v
    media.getUserMedia(mediaConstraints)
        .then(
            str => {
                console.log('*main*  getUser Media stream: ',str);
                setLocalStream(str);
                //create signal if null
                if(!sig) doSignal();
                //if the peer is created, update our media
                if(!!peer) peer.updateMediaStream(localStream);
            }
        ).catch(
            err => {
                console.log('Could not get Media: ', err);
                alert('Could not get Media!! Please check your camera and mic.');
            }
        );
}

//Get Xirsys Signaling service
function doSignal(){
    sig = new $xirsys.signal( '/webrtc', username,{channel:channelPath} );
    sig.on('message', msg => {
        let pkt = JSON.parse(msg.data);
        //console.log('*main*  signal message! ',pkt);
        let payload = pkt.p;//the actual message data sent 
        let meta = pkt.m;//meta object
        let msgEvent = meta.o;//event label of message
        let toPeer = meta.t;//msg to user (if private msg)
        let fromPeer = meta.f;//msg from user
        //remove the peer path to display just the name not path.
        if(!!fromPeer) {
            let p = fromPeer.split("/");
            fromPeer = p[p.length - 1];
        }
        switch (msgEvent) {
            //first Connect Success!, list of all peers connected.
            case "peers":
                //this is first call when you connect, 
                onReady();
                // if we are connecting to a remote user and remote 
                // user id is found in the list then initiate call
                if(!!remoteCallID) {
                    let users = payload.users;
                    if(users.indexOf(remoteCallID) > -1){
                        callRemotePeer();
                    }
                }
                break;
            //peer gone.
            case "peer_removed":
                if(fromPeer == remoteCallID) onStopCall();
                break;
            
            // new peer connected
            //case "peer_connected":
            // 	addUser(fromPeer);
            // 	break;
            // message received. Call to display.
            //case 'message':
            // 	onUserMsg(payload.msg, fromPeer, toPeer);
            // 	break;
        }
    })
}

//Ready - We have our ICE servers, our Media and our Signaling.
function onReady(){
    console.log('* onReady!');
    // setup peer connector, pass signal, our media and iceServers list.
    let isTURN = getURLParameter("isTURN") == 'true';//get force turn var.
    console.log('isTURN ',isTURN);
    peer = new $xirsys.p2p(sig,localStream,(!ice ? {} : {iceServers:ice.iceServers}), {forceTurn:isTURN});
    //add listener when a call is started.
    peer.on(peer.peerConnSuccess, onStartCall);
}
// A peer call started udpate the UI to show remote video.
function onStartCall(evt){
    console.log('*main*  onStartCall ',evt);
    let remoteId = evt.data;
    setRemoteStream(peer.getLiveStream(remoteId));
    if(localVideoEl.classList.contains('major-box')){
        localVideoEl.classList.remove('major-box');
        localVideoEl.classList.add('minor-box');
    }
    if(remoteVideoEl.classList.contains('hidden')){
        remoteVideoEl.classList.remove('hidden');
    }
    shareTitleEl.innerHTML = 'In call with user:';
    remoteCallID = remoteId;
    inCall = true;
}

function onStopCall() {
    console.log('*main*  onStopCall ');
    if( inCall ){
        peer.hangup(remoteCallID);
    }
    if(localVideoEl.classList.contains('minor-box')){
        localVideoEl.classList.remove('minor-box');
        localVideoEl.classList.add('major-box');
    }
    if(!remoteVideoEl.classList.contains('hidden')){
        remoteVideoEl.classList.add('hidden');
    }
    inCall = false;
    remoteCallID = null;
}

/* UI METHODS */

//sets local user media to video object.
function setLocalStream(str){
    console.log('*main*  setLocalStream & Video obj ',str);
    localStream = str;
    localVideoEl.srcObject = localStream;
}
//sets remote user media to video object.
function setRemoteStream(str){
    console.log('*main*  setRemoteStream & Video obj ',str);
    remoteStream = str;
    remoteVideoEl.srcObject = remoteStream;
}
//update the list of media sources on UI
function onMediaDevices( e ){
    console.log('*main*  onMediaDevices: ',e,' data: ',e.data);
    switch(e.type){
        case media.DEVICES_UPDATED:
            updateDevices(e.data);
            break;
        case media.ON_LOCAL_STREAM:
            //update list with selected.
            setSelectedDevices(e.data.getTracks());
            break;
    }
}

function updateDevices(devices){
    const mics = devices.audioin,
          cams = devices.videoin;
    console.log('*main*  updateDevices - mics:',mics,', cams:',cams);
    const camList = $('#ctrlMenu #camList'),
          micList = $('#ctrlMenu #micList');
          //camToggle = $('#ctrlMenu #camToggle'),
          //micToggle = $('#ctrlMenu #micToggle');

    micList.empty();
    mics.forEach(device => {
        micList.append('<li><a id="'+device.deviceId+'" data-group-id="'+device.groupId+'" class="btn" role="button">'+device.label+'</a></li>')
    });

    camList.empty();
    cams.forEach(device => {
        camList.append('<li><a id="'+device.deviceId+'" data-group-id="'+device.groupId+'" class="btn" role="button">'+device.label+'</a></li>')
    });
}

function setSelectedDevices(devices){
    console.log('*main*  setSelectedDevices: ',devices);
    //console.log('- video: ',devices.getVideoTracks() );
    devices.forEach(device => {
        switch(device.kind){
            case 'audio':
                console.log('- audio toggel: ',device);
                $('#ctrlMenu #micToggle').html(device.label.substr(0,20) + '<span class="caret"></span>');
                break;
            case 'video':
            console.log('- video toggel: ',device);
                $('#ctrlMenu #camToggle').html(device.label.substr(0,20) + '<span class="caret"></span>');
                break;
        }
    })
}

/* TOOLS */

function hasMedia(label,tracks){
    console.log('tracks: ',tracks,', label: ',label );
    let l=tracks.length, i, hasIt = false;
    for(i=0; i<l; i++){
        let track = tracks[i];
        if(track.label.indexOf(label) > -1){
            hasIt = true;
            break;
        }
    }
    return hasIt;
}

//gets URL parameters
function getURLParameter(name) {
    let ret = decodeURI( (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] ) 
    return  ret == 'null' ? null : ret;
};
//makes unique userid
function guid(s='user') {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s + s4() + s4();
}

window.onload = () => {
    console.log('pretty loaded!!');
    username = guid();//create random local username
    let urlName = getURLParameter("callid");//get call id if exists from url
    if(!!urlName) {
        remoteCallID = urlName;
        shareTitleEl.innerHTML = 'Calling User...';
        callIdEl.value = remoteCallID;
        console.log('turnview: ',turnViewEL);
        turnViewEL.style.display = 'none';
    } // if call id does not exist this is the callee
    else {
        //callIdEl.innerHTML = location.origin + location.pathname + '?callid='+username;
        callIdEl.value = location.origin + location.pathname + '?callid='+username;

        $(turnCB).on('click', evt => {
            //console.log('TURN: ',evt);
            let checked = evt.target.checked;
            if(checked == true){
                callIdEl.value = location.origin + location.pathname + '?callid='+username+'&isTURN=true';
            } else {
                callIdEl.value = location.origin + location.pathname + '?callid='+username;
            }
            peer.forceTurn = checked;
        })
    }
    //get Xirsys service
    doICE();
};
