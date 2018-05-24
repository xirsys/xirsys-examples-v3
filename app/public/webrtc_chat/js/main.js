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
//true - automatically answer call request from peers. false - confirm request before answer.
var automaticAnswer = false;
var mediaConstraints = {
  audio: true,
  video: {
    "min": {"width":"640","height":"480"},//320x240
    "max": {"width":"800","height":"600"}//1024x768
  }
};

var ice,//ice server query.
  sig,//sigaling
  peer,//peer connection.
  localStream,//local audio and video stream
  username = '',//local username created dynamically.
  remoteChatRequest = {},//user requesting to chat
  chatOn = true,// is chat window active? true/false
  peerChatLimit = 1,// the limited amount of peers the local user can be chatting with.
  msgBuffer = [],// holds public msg history while user is in private chat.
  msgBufferLimit = 20,//maximum amount of messages to hold in buffer.
  channelPath = '';//set this variable to specify a channel path

//custom: check URL for "ch" var, and set the channel accourdingly
var ch = decodeURI( (RegExp('ch' + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] );
if(ch != 'null' ) channelPath = ch;
console.log('channel path: ',channelPath);

// Getting references to page DOM for signalling.
var peersEl,loginEl,logOutEl,usernameEl,usernameLabelEl,messageEl,
  sendMessageEl,messagesEl,chatBtn,msgHistory,hideColumnBtn,showColumnBtn;

// Getting references to page DOM for video calling.
var callPeerEl,hangUpEl,localVideoEl,remoteVideoEl,remoteFullScreenEl,
  peerInfoView,videoMenu,mainEndCall,remotePeerName;

// Get Xirsys ICE (STUN/TURN)
function doICE(){
  console.log('doICE ');
  if(!ice){
    ice = new $xirsys.ice('/webrtc',{channel:channelPath});
    ice.on(ice.onICEList, onICE);
  } else {
    ice.doICE();
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
    .then(str => {setLocalStream(str);  doSignal();})
    .catch(err => { console.log('Could not get Media: ', err); alert('Could not get Media!! Please check your camera and mic.'); });
}

function setLocalStream(str){
  console.log('setLocal Video ');
  localStream = str;
  localVideoEl.srcObject = localStream;
}

//sets remote user media to video object.
function setRemoteStream(str){
  console.log('setRemote Video ',str);
  remoteChatRequest.stream = str;
  remoteVideoEl.srcObject = str;
}

//Get Xirsys Signaling service
function doSignal() {
  console.log('doSignal');
  //pass path to xirsys webrtc api, and local users name.
  sig = new $xirsys.signal( '/webrtc', username ,{channel:channelPath} );
  //listen to all messages coming in from signaling.
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
        var users = payload.users;
        var l = users.length;
        removeAllPeers();
        for (var i = 0; i < l; i++) {
          addUser(users[i]);
        }
        //we have what we need to start communication.
        setupRTC();
        //init the UI for the user.
        initUI();
        break;
      //peer gone.
      case "peer_removed":
        removeUser(fromPeer);
        break;
      //new peer connected
      case "peer_connected":
        addUser(fromPeer);
        break;
      //message received. Call to display.
      case 'message':
        var data = payload.msg;
        if(data.type == 'candidate' || data.type == 'offer' || data.type == 'answer' || data.type == 'custom' ){
          //can use this to view candidate offer and answer.
        } else {
          //addMessage(fromPeer, payload.msg);//, toPeer
          onMessage(fromPeer, payload.msg);
        }
        break;
    }
  })
}//msgBuffer

function bufferMessage(fromPeer, msgItem){
  console.log('*index*  bufferMessage(fromPeer',fromPeer,', msg',msgItem,')');
  if(msgBufferLimit > 0 ){
    var l = msgBuffer.push({from:fromPeer,msg:msgItem});
    if(l > msgBufferLimit){
      msgBuffer.shift();
    }
  }
  //console.log('*index*  bufferMsg',msgBuffer);
}

function onMessage( fromPeer, msg ){
  console.log("*index*  onMessage:",fromPeer,'msg:',msg);
  // if user is chatting with peer, only show peer messages otherwise post public message
  var peer = remoteChatRequest.peer;
  if(peer != undefined){
    if(fromPeer === peer) {
      addMessage(fromPeer, msg);
      let alert = $('#chat-alert-icon');
      if( !chatOn && alert.css('visibility') == 'hidden'){
        alert.css('visibility','visible');
      }
    } else {
      bufferMessage(fromPeer, msg);
    }
  } else {
    addMessage(fromPeer, msg);
  }
}

//Ready - We have our ICE servers, our Media and our Signaling.
function setupRTC(){
  console.log('*index*  setupRTC!');
  // setup peer connector, pass signal, our media and iceServers list.
  let isTURN = getURLParameter("isTURN") == 'true';//get force turn var.
  console.log('isTURN ',isTURN,', autoAnswer: ',automaticAnswer);
  peer = new $xirsys.p2p(sig,localStream,(!ice ? {} : {iceServers:ice.iceServers}), {forceTurn:isTURN,autoAnswer:automaticAnswer});
  //add listener when a call is requested.
  peer.on(peer.peerConnRequest, onCallRequest );
  //add listener when a call is started.
  peer.on(peer.peerConnSuccess, onStartCall);
  peer.on(peer.iceDisconnected, $evt => {callEnd($evt);});
}

//were connected! lets setup the UI for user.
function initUI(){

  // Send a message to one or all peers.
  sendMessageEl.onsubmit = function ($event) {
    $event.preventDefault();
    try { let test = peer.sig;
    } catch(e) { addMessage('INFO',{internal:true,type:'msg-alert',message:'You are not yet logged into the chat.'}); return; };
    let msg = messageEl.value;
    let pkt = sendMessage(msg, remoteChatRequest.peer);
    if(!pkt) return;
    addMessage(username, msg);

    messageEl.value = '';
  };

  // Log out and reset the interface.
  logOutEl.onclick = function ($event) {
    $event.preventDefault();
    username = '';
    while (usernameLabelEl.hasChildNodes()) {
      usernameLabelEl.removeChild(usernameLabelEl.lastChild);
    }
    usernameLabelEl.appendChild(document.createTextNode('Username'));
    login.parentNode.style.visibility = 'visible';

    if(logOutEl.classList.contains('sign-out-grn')) {
      logOutEl.classList.remove('sign-out-grn');
      logOutEl.classList.add('sign-out');
    }
    removeAllPeers();
    if( remoteChatRequest != undefined ) {
      if(remoteChatRequest.peer != undefined) {
        console.log('End Call, ',remoteChatRequest.peer);
        callEnd();
      }
    }
    //detachMediaStream(localVideoEl);
    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;
    peer.close();
    sig.close();
  };

  // Initiates a call, if a single peer has been selected.
  callPeerEl.onclick = function () {
    //if in chat. not allowed.
    if(!!remoteChatRequest.peer){
      //todo - check if peer exists, then check if chat is open if not open it and tell them error.
      addMessage('ERROR',{internal:true,type:'msg-alert',message:'Only a one-on-one peer conversation is currently allowed. Please end this call to chat with another user.'});
      if(!chatOn) showChat(true);
      return;
    }

    var peerName = getSelectedPeer();
    if(!!peerName) {
      //p.call(peerName);
      peer.callPeer(peerName);
      callStart(peerName);
      addMessage('INFO',{internal:true,type:'msg-info',message:'Sending chat request to '+peerName});
    } else {
      addMessage('ERROR',{internal:true,type:'msg-alert',message:'You must select a single peer before initiating a call.'});
    }
  };

  // Ends current call, if any.
  mainEndCall.onclick = hangUpEl.onclick = function () {
    callEnd();
  };

  remoteFullScreenEl.onclick = function ($evt) {
    var majBox = document.getElementsByClassName('major-box')[0];
    fullScreenVideo(majBox);//remoteVideoEl);
  };

  hideColumnBtn.onclick = function($evt) {
    var col = document.getElementsByClassName('vertical-bar')[0];
    col.style.display = 'none';
    showColumnBtn.style.display = 'unset';
  };

  showColumnBtn.onclick = function($evt) {
    this.style.display = 'none';
    var col = document.getElementsByClassName('vertical-bar')[0];
    col.style.display = 'unset';
  };

  //peer select handling
  peersEl.onclick = function ($evt) {
    var tar = $evt.target;
    if( tar.classList.contains('peer') ) setSelectedPeer(tar);
  };

  //show/hide chat
  chatBtn.onclick = function($evt){
    showChat( !chatOn );
    let alert = $('#chat-alert-icon');
    if( !!chatOn && alert.css('visibility') != 'hidden'){
      alert.css('visibility','hidden');
    }
  }
}

// Get the name of the peer the user has selected.
//@ returnObject - if true, returns entire object not just name value.
function getSelectedPeer(returnObject) {
  var peerEl = document.getElementsByClassName('peer');
  for (var i=0, l=peerEl.length; i<l; i++) {
    var peer = peerEl[i];
    //console.log( 'peer: ',peer,'  is sel: '+ (peer.classList.contains('selected')) );
    if (peer.classList.contains('selected')) {
      if(peer.id == '__all__') return undefined;
      //console.log('value: ',peer.id);
      return !!returnObject ? peer : (peer.id).substr(5);
    }
  }
};

var setSelectedPeer = function($peer, $setting) {
  //if setting is there use, otherwise set true by default.
  if($setting == undefined) $setting = true;
  var sel = getSelectedPeer(true);//get peer object.
  //if a peer element is selected, remove the selected state before setting the new peer.
  if(!!sel) {
    //console.log('selc: ',sel,', img: ',sel.getElementsByClassName('peer-icon')[0]);
    sel.classList.remove('selected');
    //if the peer is the same as the selected one, do not reselect.
    if(sel.id === $peer.id) {
      if(callPeerEl.classList.contains('start-call-grn')) {
        callPeerEl.classList.remove('start-call-grn');
        callPeerEl.classList.add('start-call');
      }
      return;
    }
  }
  if(callPeerEl.classList.contains('start-call')) {
    callPeerEl.classList.remove('start-call');
    callPeerEl.classList.add('start-call-grn');
  }
  $peer.classList.add('selected');
};




/* XIRSYS API HANDLERS */


// When a peer connects check to see if it is the user. If it is 
// update the user's label element. If it is not check if the peer
// is already listed and add an element if not.s
function addUser($peerName) {
  console.log('addUser:',$peerName);
  //if local user add to Username Label not list.
  if ($peerName == username) {
    while (usernameLabelEl.hasChildNodes()) {
      usernameLabelEl.removeChild(usernameLabelEl.lastChild);
    }
    usernameLabelEl.appendChild(document.createTextNode($peerName));
  } //Remote user, add to list.
  else {
    if (!document.getElementById('peer-' + $peerName)) {
      //create icon
      var imgEl = document.createElement('div');
      imgEl.setAttribute('class', 'peer-icon user-icon-img');
      //create label
      var txtEl = document.createElement('span');
      txtEl.setAttribute('class','sr-only');
      txtEl.setAttribute('class', 'peer-label');
      txtEl.textContent = $peerName;
      //add to div container
      var nodeEl = document.createElement('div');
      nodeEl.appendChild(imgEl);
      nodeEl.appendChild(txtEl);
      nodeEl.id = 'peer-' + $peerName;
      nodeEl.className = 'peer';
      //add To peers list
      peersEl.appendChild(nodeEl);
    }
  }
};

// Removes peer elements from the page when a peer leaves.
function removeUser($peerName) {
  console.log('removeUser ',$peerName);
  var nodeEl = document.getElementById('peer-' + $peerName);
  var curSel = getSelectedPeer(true);
  if( !!curSel && curSel.id == nodeEl.id) {
    setSelectedPeer(curSel, false);
  }
  if( !!nodeEl ) peersEl.removeChild(nodeEl);
};

// For resetting the peers list, leaving the __all__ selector only.
function removeAllPeers() {
  //$(peersEl).empty();
  var selectors = peersEl.getElementsByTagName('div');
  var i, len = selectors.length;
  for(i=0; i<len; i++){
    var peerSel = selectors[i];
    if( !!peerSel && peerSel.classList.contains('peer') ) peersEl.removeChild(peerSel);
  }
};

//when the call has succesfully started, setup the remote video here.
function onStartCall(evt){
  console.log('*index*  onStartCall ',evt);
  var $peerName = evt.data;
  //add stream to remote video element.
  setRemoteStream(peer.getLiveStream($peerName));
};

//visually setup call views.
function callStart($peerName) {
  console.log('*index*  callStart ',$peerName);
  remotePeerName.innerHTML = $peerName;
  remoteChatRequest = {peer:$peerName};

  if(hangUpEl.classList.contains('end-call')) {
    hangUpEl.classList.remove('end-call');
    hangUpEl.classList.add('end-call-grn');
  }

  //udpate indicator in userlist item
  var sel = document.getElementById('peer-'+remoteChatRequest.peer);
  if(!!sel) {
    var pIcon = sel.getElementsByClassName('peer-icon')[0];
    if(pIcon.classList.contains('user-icon-img')) {
      pIcon.classList.remove('user-icon-img');
      pIcon.classList.add('user-icon-img-grn');
    }
  }
  //hide chat by default
  showChat(false);
  addBreakMsg('Private Chat with '+$peerName);
  //show remote video elements.
  var majBox = document.getElementsByClassName('major-box')[0];
  if(majBox.classList.contains('hide-vid')) majBox.classList.remove('hide-vid');
  var minBox = document.getElementsByClassName('minor-box')[0];
  if(minBox.classList.contains('box-standby')) minBox.classList.remove('box-standby');
  remoteVideoEl.style.visibility = 'visible';

  //show buttons
  peerInfoView.style.visibility = 'visible';
  videoMenu.style.visibility = 'visible';
  console.log('callStart: ',remoteChatRequest);
};

function callEnd($event, $denied) {
  var peerId = remoteChatRequest.peer;
  console.log('*index*  callEnd, peer:  ',peerId);
  remotePeerName.innerHTML = 'No Caller';

  if(hangUpEl.classList.contains('end-call-grn')) {
    hangUpEl.classList.remove('end-call-grn');
    hangUpEl.classList.add('end-call');
  }

  peer.hangup(peerId);

  if( peerId === undefined ) return;

  var sel = document.getElementById('peer-'+peerId);
  if(!!sel) {
    var pIcon = sel.getElementsByClassName('peer-icon')[0];
    if(pIcon.classList.contains('user-icon-img-grn')) {
      pIcon.classList.remove('user-icon-img-grn');
      pIcon.classList.add('user-icon-img');
    }
  }
  //show chat if hidden
  showChat(true);
  //hide remote video elements.
  var majBox = document.getElementsByClassName('major-box')[0];
  if(!majBox.classList.contains('hide-vid')) majBox.classList.add('hide-vid');
  var minBox = document.getElementsByClassName('minor-box')[0];
  if(!minBox.classList.contains('box-standby')) minBox.classList.add('box-standby');
  remoteVideoEl.style.visibility = 'hidden';
  //hide btns
  peerInfoView.style.visibility = 'hidden';
  videoMenu.style.visibility = 'hidden';
  //if its a denial, do not send messages.
  if(!$denied){
    sendMessage({internal:true,type:'action',code:'rtc.p2p.close',peer:username}, peerId);
    addMessage('INFO',{internal:true,type:'msg-info',message:'Your chat with '+peerId+' has endeed.'});
  }
  addBreakMsg('Public Chat History');
  //add public msg history
  let l = msgBuffer.length;
  if(l > 0){
    for(let i=0; i<l; i++){
      let item = msgBuffer[i];
      addMessage(item.from,item.msg);
    }
    msgBuffer = [];
  }
  remoteChatRequest = {};
  //set back to muted.
  remoteVideoEl.muted = true;
  
  if( isFullScreen() ){
    fullScreenVideo();
  }
};

var callDenied = function( $event, $peer, $data ){
  console.log('callDenied! ',$event,', peer', $peer,', data', $data);
  if($data.code === 'user.insession'){
    let peerId = remoteChatRequest.peer;
    callEnd($event, true);
    addMessage('ERROR',{internal:true,type:'msg-alert',message:peerId+' is currently in a session, please try again later.'});
  }
};

// Deal with an incoming call.
// If you've turned off automatic responses then listen to call
// offers and allow the user to decide whether to respond or not.
// Else calls are automatically answered (see xirsys.p2p.js).
function onCallRequest(evt) {
  var $data = evt.data;
  var peerId = $data.f;
  //if local user in session, cannot chat with requestor, send notification.
  console.log('onCallRequest ',peerId,', data:',$data,'  -  insession: '+(!!remoteChatRequest.peer) );
  //if local user is already in a p2p chat, deny the request.
  if(remoteChatRequest.peer != undefined && remoteChatRequest.peer != peerId) {
    console.log('Denied Call: ', peerId);//action
    sendMessage({internal:true,type:'action',code:'rtc.p2p.deny',peer:username,message:username+' is currently in a session, please try again later.',from:'INFO'}, peerId);
  } else if (automaticAnswer === false) {
    if (confirm('Take a call from ' + peerId + '?')) {
      //if yes, pass the event back to the peer object, with true as the 2nd argument to signify confirmation.
      peer.acceptRequest(evt);
      callStart(peerId);
      addMessage('INFO',{internal:true,type:'msg-info',message:'Taking a call from ' + peerId});
    } else {
      addMessage('INFO',{internal:true,type:'msg-alert',message:'You rejected a call request from ' + peerId + '.'});
      console.log('Denied Call: ', peerId);//action
      sendMessage({internal:true,type:'action',code:'rtc.p2p.deny',peer:username,message:username+' denied your call request.',from:'INFO'}, peerId);
    }
  } else {
    //peer will auto connect you to client if you passed it autoAnswer true.
    addMessage('INFO',{internal:true,type:'msg-info',message:'Taking a call from ' + peerId});
    callStart(peerId);
  }
};

function sendMessage(msg, toPeer){
  if(msg == undefined || msg.length < 1) return;

  console.log('sendMessage msg: ',msg);
  var pkt = sig.sendMessage(msg, toPeer);
  return pkt;
}

// Add a message to the conversation.
var addMessage = function ($from, $msg) {
  console.log('*index*  addMessage(from',$from,', msg',$msg,')');
  //msg-user, msg-peer, msg-alert, msg-info
  var msgClass = 'chat-msg ' + ($from === username ? 'msg-user' : 'msg-peer');
  //for internal messages. (used obj in from to avoid spoofing.)
  if( typeof($msg) === 'object'){
    var type = $msg.type;
    //action message.
    if( type === 'action' ){
      console.log('action: ',$msg.code,', peer: ',$msg.peer,' cur: ', remoteChatRequest.peer);
      if($msg.code === 'rtc.p2p.close' && remoteChatRequest.peer == $msg.peer ) {
        callEnd();
        return;
      } else if($msg.code === 'rtc.p2p.deny' && remoteChatRequest.peer == $msg.peer ) {
        type = 'msg-alert';//convert action to alert.
        callEnd(null, true);
      } else {//PATCH: sends an extra call when end video chat.
        return;
      }
    }
    if(!!$msg.from) $from = $msg.from;
    //if not an action message its an info or alert.
    msgClass = 'chat-msg ' + type;
    //build common message format.
    $msg = $msg.message;
  }
  var msgContainer = createMsgBox($from, $msg, msgClass);
  //user message container
  messagesEl.appendChild(msgContainer);
  messagesEl.scrollTop = messagesEl.scrollHeight;
};

function addBreakMsg(msg){
  var html = (!!msg ? '<span class="chat-linebreak">'+msg+'</span>' : '') + '<hr/>';
  $(messagesEl).append(html);
}

/* UI methods */

//show and hide chat.
var showChat = function( $show ) {
  msgHistory.style.display = !$show ? 'none' : 'inherit';
  sendMessageEl.style.display = !$show ? 'none' : 'inherit';
  chatBtn.style.backgroundColor = !$show ? '#797979' : '#81b75c';
  console.log('showChat '+$show+', display: '+msgHistory.style.display);

  chatOn = $show;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if(chatOn && isFullScreen() ){
    fullScreenVideo();
  }
};


/* TOOLS */

//factory creates message box for chat display.
//@from - displays who message is from
//@msg - actual message to display
//@class - for styling different types of messages peers, alerts etc.
function createMsgBox($from, $msg, $class) {
  console.log('*index*  createMsgBox(from',$from,', msg',$msg,', class',$class,')');
  // date sent
  var d = new Date();
  var hr = d.getHours().toString(), min = d.getMinutes().toString();
  var msgTime = (hr.length == 1 ? 0+hr : hr)+":"+(min.length == 1 ? 0+min : min);
  //from name txt and message time text
  var sentLbl = document.createElement('span');
  sentLbl.innerHTML = $from.toUpperCase()+': ';
  var timeLbl = document.createElement('span');
  timeLbl.innerHTML = msgTime;
  //header container for name and time ele.
  var headerTxt = document.createElement('div');
  var nm = headerTxt.appendChild(sentLbl);
  nm.className = 'msg-from';
  var tm = headerTxt.appendChild(timeLbl);
  tm.className = 'msg-time';
  headerTxt.className = 'msg-header';
  //message text
  var msgEl = document.createElement('div');
  msgEl.innerHTML = $msg;

  var msgContainer = document.createElement('div');
  msgContainer.appendChild(headerTxt);
  msgContainer.appendChild(msgEl);
  //msg-user, msg-alert, msg-info
  if(!!$class) msgContainer.className = $class;

  return msgContainer;
};

//gets URL parameters
function getURLParameter(name) {
  var ret = decodeURI( (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] )
  return  ret == 'null' ? null : ret;
};

// Full-screens any HTML5 video on the page.
function fullScreenVideo($video) {
  // are we full-screen?
  if(isFullScreen()){
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    //remoteFullScreenEl.style.backgroundColor = '#797979';
  } //else go to fullscreen
  else {
    if ($video.requestFullscreen) {
      $video.requestFullscreen();
    } else if ($video.webkitRequestFullscreen) {
      $video.webkitRequestFullscreen();
    } else if ($video.mozRequestFullScreen) {
      $video.mozRequestFullScreen();
    } else if ($video.msRequestFullscreen) {
      $video.msRequestFullscreen();
    }
    //remoteFullScreenEl.style.backgroundColor = '#81b75c';
  }
};

function FShandler(){
  //if screen is in fullscreen video
  if(isFullScreen()){
    if(remoteFullScreenEl.classList.contains('remote-fs-unselected')) {
      remoteFullScreenEl.classList.remove('remote-fs-unselected');
      remoteFullScreenEl.classList.add('remote-fs-selected');
    }
    if(showColumnBtn.style.display != 'none'){
      showColumnBtn.style.visibility = 'hidden';
    }
  } //if screen is not in fullscreen
  else {
    if(remoteFullScreenEl.classList.contains('remote-fs-selected')) {
      remoteFullScreenEl.classList.remove('remote-fs-selected');
      remoteFullScreenEl.classList.add('remote-fs-unselected');
    }
    if(showColumnBtn.style.display != 'none'){
      showColumnBtn.style.visibility = 'visible';
    }
  }
};

function isFullScreen(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}

window.onload = () => {
  console.log('pretty loaded!!');
  // Getting references to page DOM for signalling.
  peersEl = document.getElementById('peers');
  loginEl = document.getElementById('login');
  logOutEl = document.getElementById('log-out');
  usernameEl = document.getElementById('username');
  usernameLabelEl = document.getElementById('username-label');
  messageEl = document.getElementById('message');
  sendMessageEl = document.getElementById('sendMessage');
  messagesEl = document.getElementById('messages');
  chatBtn = document.getElementById('chat-btn');
  msgHistory = document.getElementById('chatHistory');
  hideColumnBtn = document.getElementById('hideColumn');
  showColumnBtn = document.getElementById('showColumn');

  // Getting references to page DOM for video calling.
  callPeerEl = document.getElementById('call-peer');
  hangUpEl = document.getElementById('hang-up');
  localVideoEl = document.getElementById('local-video');
  remoteVideoEl = document.getElementById('remote-video');
  remoteFullScreenEl = document.getElementById('remote-full-screen');
  peerInfoView = document.getElementById('remote-username');
  videoMenu = document.getElementById('video-menu');
  mainEndCall = peerInfoView.querySelectorAll('#hang-up')[0];
  remotePeerName = document.querySelectorAll('#remote-username .title-text')[0];

  //SETUP fullscreen listeners
  document.addEventListener("fullscreenchange", FShandler);
  document.addEventListener("webkitfullscreenchange", FShandler);
  document.addEventListener("mozfullscreenchange", FShandler);
  document.addEventListener("MSFullscreenChange", FShandler);

  /* User interface handler functions */

  // When the connect button is clicked hide log-in, check the user-
  // name is valid, cancel automatic answers (see xirsys.p2p.js
  // onSignalMessage method) and open a connexion to the server.
  loginEl.onsubmit = function ($event) {
    $event.preventDefault();
    username = usernameEl.value.replace(/\W+/g, '');

    if (!username || username === '') {
      return;
    }

    loginEl.parentNode.style.visibility = 'hidden';
    logOutEl.style.visibility = 'visible';

    if(logOutEl.classList.contains('sign-out')) {
      logOutEl.classList.remove('sign-out');
      logOutEl.classList.add('sign-out-grn');
    }

    remoteVideoEl.addEventListener("play", () => {
      //unmute - (safari restriction)
      remoteVideoEl.muted = false;
    });

    doICE();
  };
};
