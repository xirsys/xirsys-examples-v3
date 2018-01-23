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
//create simple random user id
var userName;// Username can come from URL add /index.html?name=User1
var sig;//signal instance.
var privateId;//holds the id/username of the private chat user.
var channelPath;//set this variable to specify a channel path

//custom: check URL for "ch" var, and set the channel accourdingly
var ch = decodeURI( (RegExp('ch' + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] );
if(ch != 'null' ) channelPath = ch;
console.log('channel path: ',channelPath);

//setup socket to signaling server.
function doSignal(){
    console.log('doSignal()');
    sig = new $xirsys.signal( '/webrtc', userName, {channel:channelPath} );
    sig.on('message', msg => {
        var pkt = JSON.parse(msg.data);
        console.log('signal message! ',pkt);
        var payload = pkt.p;//the actual message data sent 
        var meta = pkt.m;//meta object
        var msgEvent = meta.o;//event label of message
        var toPeer = meta.t;//msg to user (if private msg)
        var fromPeer = meta.f;//msg from user
        if(!!fromPeer) {//remove the peer path to display just the name not path.
            var p = fromPeer.split("/");
            fromPeer = p[p.length - 1];
        }

        switch (msgEvent) {
            //first connect, list of all peers connected.
            case "peers":
                //this is first call when you connect, 
                //  so we can check for channelPath here dynamically.
                var sysNum = meta.f.lastIndexOf('__sys__');
                if(sysNum > -1 && !channelPath){
                    channelPath = meta.f.substring(0,sysNum);//save message path for sending.
                }
                setUsers(payload.users);
                initUI();
                break;
            //new peer connected
            case "peer_connected":
                addUser(fromPeer);
                break;
            //peer left.
            case "peer_removed":
                removeUser(fromPeer);
                break;
            //message received. Call to display.
            case 'message':
                onUserMsg(payload, fromPeer, toPeer);
                break;
        }
    });
}

//were connected! lets setup the UI for user.
function initUI() {
    $('#chatTitle').text('Your Name: ' + userName);
    // handle enter key.
    $('#sendInput').keypress( evt => {
        if (evt.keyCode == 13 || evt.which == 13) {
            evt.stopImmediatePropagation();
            $('#sendBtn').trigger('click');
        }
    });
    $('#sendBtn').click( evt => {
        evt.stopImmediatePropagation();
        var sndInput = $('#sendInput');
        var s = sndInput.val();
        //do send message, if private send id as well.
        var pkt = sendMessage(s, privateId);
        //dislay message
        onUserMsg(pkt.p, userName, privateId);
        //clear last message.
        sndInput.val('');
        //set field to focus
        sndInput.focus();
    });
    //users check box group routine.
    $("#usersList").on('click', 'input:checkbox', function() {
        var $box = $(this);//box clicked.
        //if the box has been checked
        if ($box.is(":checked")) {
            // get name group
            var group = "input:checkbox[name='" + $box.attr("name") + "']";
            // set all checkboxes in group to false.
            $(group).prop("checked", false);
            //re-set this box to true.
            $box.prop("checked", true);
            privateId = $box.parent().text();
            $('#privateTo').text('Private To: '+privateId);
        }//if box has been unchecked.
        else {
            $box.prop("checked", false);
            privateId = null;
            $('#privateTo').text('Public Message');
        }
    });
}

//Setting Complete List of Users
function setUsers(aList){
    $('#usersList').empty();
    var l = aList.length, i;
    for(i=0; i < l; i++){
        addUser(aList[i]);
    }
}

//Set single user in list
function addUser(peer){
    console.log('addUser ',peer);
    var omitPath = peer.lastIndexOf('/');//remove user connetion path.
    if(omitPath > -1){
        peer = peer.substr(omitPath);
    }
    var item;
    //if user is local user, no need for a check box otherwise add one.
    if(peer == userName){
        item  = '<li id='+peer+' class="list-group-item"><i>'+peer+'</i></li>';
    } else {
        item  = '<li id='+peer+' class="list-group-item">'+
                    '<span class="userLabel"><input type="checkbox" name="peers" aria-label="...">' +peer+'</span>'+
                '</li>';
    }
    $('#usersList').append(item);
}

//Remove single user in list
function removeUser(peer){
    console.log('removeUser ',peer);
    //each item in the userlist has their username as the id. (id must be unique)
    $('#usersList #'+peer).remove();
    if(peer == privateId){
        privateId = null;
        $('#privateTo').text('Public Message');

    }
}

//Remove single user in list
function onUserMsg(payload, frmPeer, toPeer){
    var msg = payload.msg;
    console.log('onUserMsg ' + frmPeer + (!!toPeer ? ' to ' + toPeer : '') + ': ' + msg);
    var $hist = $('#msgHist');
    if( !!toPeer ){
        $hist.append('<li class="list-group-item private-msg"><p>' + frmPeer + ' to ' + toPeer + ': </p><p>'+msg + '</p></li>');
    } else {
        $hist.append('<li class="list-group-item"><p>' + frmPeer + ': </p><p>'+msg + '</p></li>');
    }
    var view = $('#msgView')[0];
    view.scrollTop = view.scrollHeight;
}

function sendMessage(msg, toPeer){
    if(msg == undefined || msg.length < 1) return;
    
    console.log('sendMessage msg: ',msg);
    var pkt = sig.sendMessage(msg, toPeer);
    return pkt;
}

function getURLParameter(name) {
    var ret = decodeURI( (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] ) 
    return  ret == 'null' ? null : ret;
};

function guid(s='user') {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s + s4() + s4();// + s4() + s4() + s4() + s4() + s4() + s4();
}


//Begin
$( document ).ready( () => {
    console.log('pretty loaded!!');
    var urlName = getURLParameter("name");
    if(!!urlName){
        userName = urlName;
    } else {
        userName = guid();
    }
    console.log('userName: ',userName);
    //doToken();
    doSignal();
});