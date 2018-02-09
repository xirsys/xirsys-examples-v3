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
var localVideoEl,//set onload
    callIdEl = document.getElementById('callID'),
    turnCB = document.getElementById('isTURNcb'),
    turnViewEL = document.getElementById('isTURN'),
    shareViewEl = document.getElementById('share-view'),
    shareTitleEl = document.getElementById('share-title');
    
var mediaConstraints = {
    audio: true,
    video: {
        "min": {"width":"640","height":"480"},//320x240
        "max": {"width":"800","height":"600"}//1024x768
    }
};

var localStream,//local audio and video stream
    remoteStream,//remote audio and video stream
    ice,//ice server query.
    sig,//sigaling
    peer;//peer connection.

/*if url has callid wait for other user in list with id to call
    else if no id in url create a sharable url with this username.*/
var username,//local username created dynamically.
    remoteCallID,//id of remote user
    inCall = false,//flag true if user in a call, or false if not.
    channelPath = '',//set this variable to specify a channel path
    vidsList = {length:0};//list of live streams.

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
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(str => {setLocalStream(str); doSignal();})//onSuccess
        .catch(err => { console.log('Could not get Media: ', err); alert('Could not get Media!! Please check your camera and mic.'); });
}

//Get Xirsys Signaling service
function doSignal(){
    sig = new $xirsys.signal( '/webrtc', username,{channel:channelPath} );
    sig.on('message', msg => {
        var pkt = JSON.parse(msg.data);
        //console.log('*index*  signal message! ',pkt);
        var payload = pkt.p;//the actual message data sent 
        var meta = pkt.m;//meta object
        var msgEvent = meta.o;//event label of message
        var toPeer = meta.t;//msg to user (if private msg)
        var fromPeer = meta.f;//msg from user
        //remove the peer path to display just the name not path.
        if(!!fromPeer) {
            var p = fromPeer.split("/");
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
                    var users = payload.users;
                    var l = users.length;
                    for (var i = 0; i < l; i++) {
                        var user = users[i];
                        //if this is the user, call them.
                        if (user === remoteCallID) {
                            callRemotePeer();
                        }
                    }
                }
                break;
            //peer gone.
            case "peer_removed":
                //if(fromPeer == remoteCallID) onStopCall();
                //todo - ceck if peer is one that is connected to us and stop that call.
                var p = peer.getLivePeer(fromPeer);
                console.log('has peer: ',p);
                if(!!p){
                    onStopCall(p.id);
                }
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
    peer = new $xirsys.p2group(sig,localStream,(!ice ? {} : {iceServers:ice.iceServers}), {forceTurn:isTURN});
    //add listener when a call is started.
    peer.on(peer.peerConnSuccess, onStartCall);
}

//CALL EVENT METHODS

// A peer call started udpate the UI to show remote video.
function onStartCall(evt){
    console.log('*index*  onStartCall ',evt);
    var remoteId = evt.data;
    setRemoteStream(peer.getLiveStream(remoteId),remoteId);
    shareTitleEl.innerHTML = 'In call with user:';
    remoteCallID = remoteId;
    inCall = true;
}

function onStopCall(uid) {
    console.log('*index*  onStopCall',uid);
    if( inCall ){
        peer.hangup(uid);
        delRemoteStream(uid);
    } else {
        console.log('could not find call for: ',uid);
    }
    if(peer.length == 0) {
        inCall = false;
        remoteCallID = null;
    }
}

/* UI METHODS */

//sets local user media to video object.
function setLocalStream(str){
    console.log('setLocal Video ',str);
    localStream = str;
    localVideoEl.srcObject = localStream;
}
//sets remote user media to video object.
function setRemoteStream(str,uid){
    console.log('setRemote Video ',str);
    //remoteStream = str;
    //remoteVideoEl.srcObject = remoteStream;
    var item = {stream:str,id:uid};
    //vidsList.push(item);//push into array
    vidsList[uid] = item;//map name on obj
    vidsList.length++;
    console.log('vidsList add',vidsList);
    updateVidView();
}

//removes remote user media to video object.
function delRemoteStream(uid){
    //if there is no items return false
    var l = vidsList.length;
    if(l == 0 )return false;
    //if that item does not exist return false
    var r = vidsList[uid];
    console.log('remove len',l,'Video',r);
    if(!r) return false;
    //delete the item and return true
    delete vidsList[uid];
    vidsList.length--;
    if(vidsList.length<0) vidsList.length = 0;
    console.log('vidsList del',vidsList);
    updateVidView();
    return true;
}

function clearVids(){
    var camBox = $('#camBox');
    var items = camBox.find('.vid-view:not(#local-video)');
    console.log('clear items: ', items);
    if(items.length == 0 ) return;
    for(var i=0; i<items.length; i++){
        var item = items[i];
        item.remove();
    }
}

function updateVidView(){
    clearVids();
    console.log('vidsList:',vidsList);
    var camBox = $('#camBox');
    camBox.css('visibility','hidden');
    //for(var i=0; i<vidsList.length; i++){
    for (var i in vidsList){
        let item = vidsList[i];
        console.log('item: ',item,'typeof',(typeof(item)));
        if( typeof(item) != 'object') continue;
        var winId = "v_"+item.id;
        let hasv = camBox.find('#'+winId);//$('#camBox #vid'+i);
        console.log('#'+winId+' - ',hasv);
        if(hasv.length == 0){
            camBox.append(
                '<div id="'+winId+'" class="vid-view">' +
                    '<video class="vid-obj"  autoplay muted playsinline></video>' +
                '</div>'
            );
        }
        let vid = camBox.find('#'+winId+' video')[0];
            vid.srcObject = item.stream;
        console.log('new v',vid);
    }
    arrangeVids();
    camBox.css('visibility','visible');
}

function arrangeVids(){
    var camBox = $('#camBox');
    var items = camBox.find('.vid-view:not(#local-video)');
    var l = items.length;
    console.log(l,'vid items:',items);
    if(l == 0 ){
        $('#camBox #local-video').attr('class','vid-view col-xs-12');
        return;
    }
    var colSize = l == 1 ? 6 : l == 2 ? 4 : l == 3 ? 6 : l == 4 ? 3 : 4;
    console.log('vid size: ',colSize);
    $('#camBox #local-video').attr('class','vid-view col-sm-'+colSize);
    for(var i=0; i<l; i++){
        var item = $(items[i]);
        item.attr( 'class','vid-view col-sm-'+colSize );
    }
}


/* TOOLS */

//gets URL parameters
function getURLParameter(name) {
    var ret = decodeURI( (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] ) 
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

/* LOADING */

window.onload = () => {
    console.log('pretty loaded!!');
    localVideoEl = $('#camBox #local-video video')[0];
    username = guid();//create random local username
    var urlName = getURLParameter("callid");//get call id if exists from url
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
        