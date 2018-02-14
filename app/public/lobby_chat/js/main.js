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

'use strict';
//create simple random user id
var userName,// Username can come from URL add /index.html?name=User1
    sig,//signal instance.
    privateId,//holds the id/username of the private chat user.
    channelPath,//set this variable to specify a channel path
    apiURL='/webrtc',//path to the serverside.
    chManager,//script to create rooms/sub-rooms on your account with the API.
    kvData,//data layer manager.
    allowedChar = new RegExp('[^a-zA-Z0-9]'),//filter room name entries.
    state = 'setup',//state flag for setting things up.
    rooms = [];//list of rooms.

// if variable exists then allow its value, otherwise set a default
//  true - will allow user to create/delete rooms, false to disallow.  See index.html
if(!!createRoomAllowed) var createRoomAllowed = true;

//default list items.
var manageRmLabel = 'Manage Rooms',
    lobbyLabel = 'Lobby',
    currentRoom = lobbyLabel;//Room user is curretly in. lobbyLabel is default.


//custom: check URL for "ch" var, and set the channel accourdingly
var ch = decodeURI( (RegExp('ch' + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] );
if(ch != 'null' ) channelPath = ch;

//setup socket to signaling server.
function doSignal(){
    console.log('doSignal()');
    sig = new $xirsys.signal( apiURL, userName, {channel:channelPath +'/'+ currentRoom} );
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
                var sysNum = meta.f.lastIndexOf('__sys__');//system message
                if(sysNum > -1 && !channelPath){
                    channelPath = meta.f.substring(0,sysNum);//save message path for sending.
                }
                setUsers(payload.users);
                onUserMsg({msg:'You just joined <b>'+currentRoom+'</b>'}, {sys:true});
                $('#roomView #ddMenu #labelText').html(currentRoom + '<span class="caret"></span>');
                if( state == 'setup') initUI();
                break;
            //new peer connected
            case "peer_connected":
                addUser(fromPeer);
                onUserMsg({msg:'User <b>'+fromPeer+'</b> joined room!'}, {sys:true});
                break;
            //peer left.
            case "peer_removed":
                removeUser(fromPeer);
                onUserMsg({msg:'User <b>'+fromPeer+'</b> left room!'}, {sys:true});
                break;
            //message received. Call to display.
            case 'message':
                onUserMsg(payload, fromPeer, toPeer);
                break;
            //if a room is created, update rooms list.
            case "room_updated":
                kvData.getKeys();
                onUserMsg(payload, fromPeer);
                break;
        }
    });
}

function dataEvents(e){
    console.log('dataEvents ',e);
    var dt = e.data;
    switch(e.type){
        case kvData.NEW_KEYS:
            //if length is 0, add a new lobby.
            var l = dt.length, html = '';
            rooms = dt;
            if(l == 0) {
                //create lobby in data layer
                rooms.push(lobbyLabel);
                kvData.addItem(lobbyLabel,{u:0});
                html += '<li class="list-group-item list-item-select">'+lobbyLabel+'</li>';//<span class="badge">1</span>
            } else {
                for(let i=0; i<l; i++){
                    var item = dt[i];
                    //if room is lobby, add that to the begining, else add to last.
                    if(item == lobbyLabel){
                        html = '<li class="list-group-item list-item-select">'+item+'</li>' + html;
                    } else {
                        html += '<li class="list-group-item list-item-select">'+item+'</li>';
                    }
                }
                //Lobby subchannel should not delete but if no lobby on list, add one.
                if(dt.indexOf(lobbyLabel) == -1) {
                    kvData.addItem(lobbyLabel, {u:0});
                    html = '<li class="list-group-item list-item-select">'+lobbyLabel+'</li>' + html;
                }
            }
            //if this user is allowed to make rooms, add room manger to begining of list with custom styles.
            if(createRoomAllowed){
                //add list to modal
                $('#mdlRooms .modal-body #roomsList').empty().append(html);
                //add to top of main list
                html = '<li class="list-group-item list-item-select mng-room-item-top">'+manageRmLabel+'</li>' + html;
                //OR add to bottom of main list
                //html = html + '<li class="list-group-item list-item-select mng-room-item-btm">'+manageRmLabel.toUpperCase()+'</li>';
            }
            //todo show rooms on list. check for admin and show manage room.
            $('#roomView .room-list').empty().append(html);
            break;
        case kvData.NEW_ITEM:
            //created a new item.  notify lobby
            console.log('NEW_ITEM notify! ',dt.k);
            var pkt = sendMessage('I just created room <b>'+dt.k+'</b>.', null, {m_event:'room_updated'});
            onUserMsg(pkt.p, userName);//send with custom event.
            kvData.getKeys();
            break;
        case kvData.REMOVED_ITEM:
            console.log('REMOVED_ITEM notify! ',dt.k);
            var pkt = sendMessage('I just removed room "<b>'+dt.k+'</b>".', null, {m_event:'room_updated'});
            onUserMsg(pkt.p, userName);//send with custom event.
            kvData.getKeys();
            break;
    }
}

function channelEvents(e){
    console.log('channelEvents ',e);
    var dt = e.data;
    var k;
    switch(e.type){
        case chManager.NEW_CHANNEL:
            k = dt.channel.substr(dt.channel.lastIndexOf('/')+1);
            console.log('Add Channel ',k,':',dt.v);
            if(kvData) kvData.addItem(k,dt.v);//save room reference on data channel.
            $('#mdlRooms .modal-body').append('<div class="alert alert-success alert-dismissible" role="alert">Room Added Successfully!<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>');
            break;
        case chManager.REMOVE_CHANNEL:
            k = dt.channel.substr(dt.channel.lastIndexOf('/')+1);
            console.log('REMOVE Channel ',k);
            kvData.removeItem(k);//save room reference on data channel.
            $('#mdlRooms .modal-body').append('<div class="alert alert-success alert-dismissible" role="alert">Room Deleted Successfully!<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>');
            break;
    }
}

//were connected! lets setup the UI for user.
function initUI() {
    chManager.on(chManager.NEW_CHANNEL, channelEvents);//listen to new channels being created.
    chManager.on(chManager.REMOVE_CHANNEL, channelEvents);//listen to channels being deleted.
    chManager.on(chManager.ON_CHANNELS, channelEvents);//listen to channels request to check for lobby.
    
    kvData = new $xirsys.dataLayer(apiURL,{channel:channelPath});//channel sets a default path
    kvData.on(kvData.NEW_KEYS, dataEvents);//listen to rooms list.
    kvData.on(kvData.NEW_ITEM, dataEvents);//listen to new rooms created by local user.
    kvData.on(kvData.REMOVED_ITEM, dataEvents);//listen to rooms deleted by local user.
    kvData.getKeys();//gets rooms in Xirsys Data store layer.

    $('#chatTitle').text(userName);
    
    // ROOMS
    $('#roomView #ddMenuList').click( evt => {
        let tar = $(evt.target);
        var s = $(evt.target).text();
        console.log('#roomView click ',s);
        switch(s){
            case manageRmLabel:
                $('#mdlRooms').modal('toggle');
                break;
            default:
                //todo - switch to a room. (s), then highlight on list.
                currentRoom = s;
                console.log('enter room! '+channelPath +'/'+ currentRoom);
                let b = sig.connectTo( channelPath +'/'+ currentRoom );
                if(b){
                    //clear views.
                    setUsers([]);
                    var $hist = $('#msgHist');
                    $hist.empty();
                }
                break;
        }
    });

    $('#mdlRooms .modal-body #roomsList').click(evt => {
        //console.log('roomlist ',evt);
        //get currently selected, de-select it and select new.
        let $list = $(evt.currentTarget);
        //remove last selected.
        let $last = $list.find('.active');
        //console.log('selected: ',$last);
        if($last.length > 0){
            $last.removeClass('active');
        }
        let $item = $(evt.target);
        $item.addClass('active');
        $('#mdlRooms .modal-body #deleteRoomBtn').removeClass('disabled');
    });

    $('#mdlRooms .modal-body #deleteRoomBtn').click( evt => {
        let $list = $('#mdlRooms .modal-body #roomsList');
        let $item = $list.find('.active');
        //console.log('found: ',$item);
        if(!$item || $item.length == 0) return;
        let s = $item.text();
        if(s == lobbyLabel) {
            alert('Whoops! You cannot delete the '+lobbyLabel+'.');
            return;
        }
        console.log('delete item: ',channelPath+'/'+s);
        chManager.removeChannel(channelPath+'/'+s);
    });
    
    $('#mdlRooms .modal-body #addRoomText').keypress( e => {
        if(e.which == 13) {
            console.log('enter!');
            $('#mdlRooms .modal-body #addRoomBtn').trigger( 'click' );
        }
    })

    $('#mdlRooms .modal-body #addRoomBtn').click( evt => {
        let $parent = $(evt.currentTarget.parentElement);
        //let $input = $parent.find('#addRoomText');
        let s = $parent.find('#addRoomText').val();
        if(s && s.length > 1){
            //check if dup
            console.log('rooms',rooms);
            if(rooms.indexOf(s) > -1){
                alert(s+' is a duplicate of an existing room! Please try another name.')
                return;
            }
            if(validateRoomName(s)){
                console.log('adding new item: ',channelPath+'/'+s);
                chManager.addChannel( channelPath+'/'+s);
                $('#mdlRooms .modal-body #addRoomText').val('');
            } else {
                alert('Channel names must begin with a letter and can only contain alpha and numeric characters and NO spaces');
            }
        }
    });

    $('#mdlRooms').on('hidden.bs.modal', function (e) {
        $('#mdlRooms .modal-body #addRoomText').val('');
        let $list = $('#mdlRooms .modal-body #roomsList');
        let $item = $list.find('.active');
        //console.log('selected: ',$last);
        if($item.length > 0){
            $item.removeClass('active');
        }
        let $alert =  $('#mdlRooms .modal-body').find('.alert');
        if($alert.length > 0) $alert.remove();
    })

    // handle enter key.
    $('#sendInput').keypress(evt => {
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

    state = 'done';
}

//Setting Complete List of Users
function setUsers(aList){
    $('#usersList').empty();
    console.log('setUsers ',aList);
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
    } else if(typeof(frmPeer) == 'object'){
        $hist.append('<li class="list-group-item"><p style="margin-bottom: 0; "><span class="glyphicon glyphicon-bullhorn" aria-hidden="true"></span>&nbsp;&nbsp;&nbsp;'+ msg + '</p></li>');
    } else {
        $hist.append('<li class="list-group-item"><p>' + frmPeer + ': </p><p>'+msg + '</p></li>');
    }
    let $view = $('#msgView')[0];
    $view.scrollTop = $view.scrollHeight;
}

function sendMessage(msg, toPeer, info){
    if(msg == undefined || msg.length < 1) return;
    
    console.log('sendMessage msg: ',msg);
    var pkt = sig.sendMessage(msg, toPeer, info);
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

function getRootPath(){
    $.ajax({
        url: apiURL+'/_path',
        type: 'GET',
        dataType: 'json',
        error: function(data) { console.log('*signal*  error: ', data);},
        success: function(data) {
            console.log('Root Path: ',data);
            if(data.s == 'ok') {
                let path = data.v;
                channelPath = path == '' ? null : path;
                //doSignal();
                //check for lobby
                getLobby();
            }
        }
    });
}

function onLobby(e){
    console.log('onLobby ',e);
    var dt = e.data;
    switch(e.type){
        case chManager.NEW_CHANNEL:
            if(dt.channel.indexOf(lobbyLabel)){
                console.log('Lobby Ready! start setup: ',channelPath+'/'+lobbyLabel);
                chManager.off(chManager.NEW_CHANNEL, onLobby);
                chManager.off(chManager.ON_CHANNELS, onLobby);
                doSignal();
            }
            break;
        case chManager.ON_CHANNELS:
            //check to see if there is a lobby
            if(dt.list.indexOf(lobbyLabel) > -1){
                //we have a lobby! Create connection to /channelPath (root channel)/lobbyLabel (lobby room)
                console.log('we have '+lobbyLabel+' subroom already!');
                chManager.off(chManager.NEW_CHANNEL, onLobby);
                chManager.off(chManager.ON_CHANNELS, onLobby);
                doSignal();
            } else {
                //create lobby, then connect to it.
                console.log('Creating subroom: '+channelPath+'/'+lobbyLabel);
                chManager.addChannel(channelPath+'/'+lobbyLabel);
            }
            break;
    }
}

function getLobby(){
    console.log('getLobby ',apiURL+'/'+channelPath);
    chManager = new $xirsys.channel(apiURL,{channel:channelPath});//channel manager to create sub-rooms
    chManager.on(chManager.NEW_CHANNEL, onLobby);//on lobby created, fires this.
    chManager.on(chManager.ON_CHANNELS, onLobby);//on list of all sub-channels, fires this.
    chManager.getChannels(channelPath,{depth:2});//send depth of 2 for sub-channels
}

// validate room names created by users.
function validateRoomName(s) {
    var valid = true;
    if (s.length == 0) {
        valid = false;
    } else if ($.isNumeric(s[0])) {
        valid = false;
    }
    if (allowedChar.test(s)) valid = false;

    console.log('validateRoomName: ', valid);
    return valid;
}

function start(){
    if(!channelPath) {
        //get our root channel path to create subrooms
        getRootPath();
    } else {
        //got the path, check for lobby subroom, if no lobby make one.
        getLobby();
    }
}

//Begin
$( document ).ready( () => {
    console.log('pretty loaded!!');
    var urlName = getURLParameter("name");
    if(!!urlName){
        userName = urlName;
        start();
    } else {
        //userName = guid();
        $('#mdlLogin').modal('show');
        $('#mdlLogin #nameText').keypress( e => {
            if(e.which == 13) {
                console.log('mdlLogin enter!');
                $('#mdlLogin #loginBtn').trigger( 'click' );
            }
        })
        $('#mdlLogin #loginBtn').click( evt => {
            let uname = $('#mdlLogin #nameText').val();
            if(uname.length > 1){
                console.log('click modal ',uname);
                userName = uname;
                $('#mdlLogin').modal('hide');
                start();
            }
        });
    }
    console.log('path: ',channelPath,' userName: ',userName);

});