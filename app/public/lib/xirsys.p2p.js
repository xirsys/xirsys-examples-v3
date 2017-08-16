/*********************************************************************************
	The MIT License (MIT) 

	Copyright (c) 2014 XirSys

	@author: Lee Sylvester
	@contributor: Jerry Chabolla

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

	********************************************************************************

	This script provides functionality for connecting using Peer-to-Peer 
	via the XirSys WebRTC services [STUN/TURN].

	No external libraries are required. However, if supporting an
	older browser (earlier than Internet Explorer 8, Firefox 3.1, 
	Safari 4, and Chrome 3), then you may want to use the open
	source JSON library by Douglas Crockford :
	 (https://github.com/douglascrockford/JSON-js) 

*********************************************************************************/

'use strict';

(function () {

	/*********************************************************************************
	 * For full use of this class, see the information at the top of this script.
	 *********************************************************************************/

	$xirsys.class.create({
		namespace : 'p2p',
		constructor : function ($url, $config, $localVideo, $remoteVideo) {
			this.status = $xirsys.p2p.DISCONNECTED;
			if($config.video !== undefined) this.rtc.useVideo = (!!$config.video);
			if($config.audio !== undefined) this.rtc.useAudio = (!!$config.audio);
			this.rtc.useDataChannel = (!!$config.dataChannels);
			if (this.rtc.useDataChannel) {
				this.rtc.dataChannelList = $config.dataChannels;
			}
			this.rtc.forceTurn = (!!$config.forceTurn);
			this.rtc.screenshare = (!!$config.screenshare);
			this.rtc.connType = $config.connType;
			this.rtc.localVideo = $localVideo;
			this.rtc.remoteVideo = $remoteVideo;
			this.url = $url || null;
			//update ice path
			if (!!$url) {
				if($xirsys.api)$xirsys.api.iceUrl = $url + "_turn";
				$xirsys.baseUrl = $url;
				if($xirsys.signal)$xirsys.signal.wsList = $xirsys.url("_host", { type: "signal" });
			}
			console.log('url '+$url+' base: '+$xirsys.baseUrl);
		},
		inherits : $xirsys.api,
		fields : {
			status : null,
			signal : null,
			xirsys_opts : {
				username : null,
				password : null,
				domain : null,
				application : null,
				room : null,
				automaticAnswer : true
			},
			autoreply : null,
			rtc : {
				state : null,
				sdpConstraints : {'mandatory': {'OfferToReceiveAudio':true, 'OfferToReceiveVideo':true }},
				useVideo : true,
				useAudio : true,
				useDataChannel : true,
				dataChannelList : [],
				forceTurn : false,
				screenshare : false,
				connType : null,
				localStream : null,
				remoteStream : null,
				localVideo : null,
				remoteVideo : null,
				dataChannel : null,
				remoteDataChannel : null,
				peerConn : null,
				peer : null,
				ice : null,
				participant : null
			}
		},
		methods : {
			open : function ($opts, $autoreply) {
				if (!!this.signal && !this.signal.isClosed) {
					this.close();
				}
				if (!$opts) {
					this.error('connect', 'User credentials should be specified.');
					return;
				}
				this.xirsys_opts = $opts;
				this.autoreply = !!$autoreply;
				this.xirsys_opts.type = (this.rtc.connType == "pub") ? 
					"publish" : (this.rtc.connType == "sub") ? 
						"subscribe" : null;
				this.signal = new $xirsys.signal();
				this.signal.onOpen = (this.onSignalOpen).bind(this);
				this.signal.onClose = (this.onSignalClose).bind(this);
				this.signal.onMessage = (this.onSignalMessage).bind(this);
				this.signal.connect(this.xirsys_opts);
				return this.signal;
			},
			close : function () {
				this.signal.close();
			},
			call : function ($targetUser) {
				this.rtc.peer = $targetUser;
				this.rtc.participant = $xirsys.p2p.CLIENT;
				this.status = $xirsys.p2p.CALLING;
				this.setConstraints();
				this.doPeerConnection((function () {
					var _constraints = {"optional": [], "mandatory": {"MozDontOfferDataChannel": (!this.rtc.useDataChannel) }};
					if (webrtcDetectedBrowser === "chrome") {
						for (var prop in _constraints.mandatory) {
							if (prop.indexOf("Moz") != -1) {
								delete _constraints.mandatory[prop];
							}
						}
					}
					_constraints = this.mergeConstraints(_constraints, this.rtc.sdpConstraints);
					if (this.rtc.useDataChannel) {
						this.rtc.peerConn.ondatachannel = this.onRemoteDataChannel.bind(this);
						for (var i = 0; i < this.rtc.dataChannelList.length; i++) {
							this.doCreateDataChannel(this.rtc.dataChannelList[i]);
						}
					}
					this.rtc.peerConn.createOffer((this.setLocalAndSendMessage).bind(this), function(){}, _constraints); // Showing error on Firefox
					
				}).bind (this));
			},
			hangUp : function () {
				if (!!this.rtc.peerConn && this.rtc.peerConn.signalingState != 'closed') { // Should this function be watching and setting this.status?
					this.rtc.peerConn.close();
				}
			},
			answer : function ($peer) {
				this.rtc.participant = $xirsys.p2p.PEER;
				if (!this.status == $xirsys.p2p.CALLING) {
					this.status = $xirsys.p2p.ANSWERING;
				}
				this.rtc.peer = $peer;
				this.setConstraints();
				this.rtc.peerConn.createAnswer((this.setLocalAndSendMessage).bind(this), function(){});
			},
			doCreateDataChannel : function ($label) {
				$label = $label || "channelLabel";
				this.rtc.dataChannel = this.rtc.peerConn.createDataChannel($label, {}); // make channel label dynamic?
				this.rtc.dataChannel.onopen = function (event) {
					var readyState = this.rtc.dataChannel.onopen.readyState;
					if (readyState == "open") {
						this.onDataChannelOpen();
					}
				};
				this.rtc.dataChannel.onerror = this.onDataChannelError.bind(this);
				this.rtc.dataChannel.onmessage = this.onDataChannelMessage.bind(this);
				this.rtc.dataChannel.onopen = this.onDataChannelOpen.bind(this);
				this.rtc.dataChannel.onclose = this.onDataChannelClose.bind(this);
			},
			onRemoteDataChannel : function ($event) {
				this.rtc.remoteDataChannel = $event.channel;
				this.rtc.remoteDataChannel.onmessage = this.onRemoteDataChannelMessage.bind(this);
			},
			onRemoteDataChannelMessage : function ($event) {
				$xirsys.events.getInstance().emit($xirsys.p2p.dataChannelMessage, $event.data);
			},
			onDataChannel : function ($channelData) {
				var newDataChannel = new xrtc.DataChannel(channelData.channel, remoteUser);
				dataChannels.push(newDataChannel);
			},
			onDataChannelError : function ($error) {
				$xirsys.events.getInstance().emit($xirsys.p2p.dataChannelError, $error);
			},
			onDataChannelMessage : function ($event) {
				$xirsys.events.getInstance().emit($xirsys.p2p.dataChannelMessage, $event.data);
			},
			onDataChannelOpen : function () {
				$xirsys.events.getInstance().emit($xirsys.p2p.dataChannelOpen);
			},
			onDataChannelClose : function () {
				$xirsys.events.getInstance().emit($xirsys.p2p.dataChannelClose);
			},
			dataChannelSend : function ($data) {
				this.rtc.dataChannel.send($data);
			},
			dataChannelClose : function () {
				this.rtc.dataChannel.close();
			},
			onSignalOpen : function () {
				this.doGetUserMedia();
			},
			onSignalClose : function () {
				// TODO
			},
			onSignalMessage : function ($msg) {
				switch ($msg.data.type) {
					case "ice":
						if(this.status == $xirsys.p2p.CONNECTED){
							this.signal.send('session', {
								type: 'denial',
								code: 'user.insession'
							}, $msg.peer);
						} else {
							this.onIceServers($msg.data.ice);
						}
						break;
					case "offer":
						if(this.status == $xirsys.p2p.CONNECTED){
							//is in session
						} else {
							// setRemoteDescription is intended to be in the answer
							// method, but then candidate messages crash the app.
							this.rtc.peerConn.setRemoteDescription(new RTCSessionDescription($msg.data), function(){}, function(){});
							if (this.xirsys_opts.automaticAnswer === true) {
								this.answer($msg.peer, $msg.data);
							}
							$xirsys.events.getInstance().emit($xirsys.p2p.offer, $msg.peer, $msg.data);
						}
						break;
					case "answer":
						this.rtc.peerConn.setRemoteDescription(new RTCSessionDescription($msg.data), function(){}, function(){});
						$xirsys.events.getInstance().emit($xirsys.p2p.answer);
						break;
					case "candidate":
						this.rtc.peerConn.addIceCandidate(
							new RTCIceCandidate({
								sdpMLineIndex:$msg.data.label, 
								candidate:$msg.data.candidate
							})
						);
						break;
					case "denial":
							$xirsys.events.getInstance().emit($xirsys.p2p.requestDenied, $msg.peer, {code: 'user.insession'});
						break;
					default:
						$xirsys.events.getInstance().emit($xirsys.signal.message, $msg);
						break;
				}
			},
			onIceCandidate : function ($evt) {
				if ($evt.candidate) {
					var components = $evt.candidate.candidate.split(" ");
					if (!(this.rtc.forceTurn && components[7] != "relay")) {
						this.signal.send('session', {
							type: 'candidate',
							label: $evt.candidate.sdpMLineIndex,
							id: $evt.candidate.sdpMid,
							candidate: $evt.candidate.candidate
						}, this.rtc.peer, this.rtc.connType);
					}
				}
			},
			onIceServers : function ($ice) {
				this.rtc.ice = $ice;
				var peer_constraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};
				if (this.rtc.useDataChannel) {
					peer_constraints.optional.push({"RtpDataChannels": true});
				}
				try {
					this.rtc.peerConn = new RTCPeerConnection(this.rtc.ice, peer_constraints);
					if (this.rtc.useDataChannel) {
						this.rtc.peerConn.ondatachannel = this.onRemoteDataChannel.bind(this);
					}
					this.rtc.peerConn.onicecandidate = this.onIceCandidate.bind(this);
					if (!!this.rtc.localStream) {
						this.rtc.peerConn.addStream(this.rtc.localStream);
					}
					this.rtc.peerConn.onaddstream = this.onRemoteStreamAdded.bind(this);
					this.rtc.peerConn.oniceconnectionstatechange = this.onICEConnectionState.bind(this);
				} catch (e) {
					this.rtc.onPeerConnectionError();
				}
			},
			onRemoteStreamAdded : function ($evt) {
				if (!!this.rtc.remoteVideo) {
					attachMediaStream(this.rtc.remoteVideo, $evt.stream);
					this.rtc.remoteStream = $evt.stream;
				}
			},
			onICEConnectionState : function ($evt) {
				if ($evt.target.iceGatheringState == "connected" || $evt.target.iceGatheringState == "complete") {
					this.status = $xirsys.p2p.CONNECTED;
					$xirsys.events.getInstance().emit($xirsys.p2p.iceConnected);
				}
				if( $evt.target.iceConnectionState == "disconnected" || $evt.target.iceConnectionState == "closed" || $evt.target.iceConnectionState == "failed") {
					this.status = $xirsys.p2p.DISCONNECTED;
					$xirsys.events.getInstance().emit($xirsys.p2p.iceDisconnected);
			    }
			},
			onUserMediaSuccess : function ($stream) {
				if (!!this.rtc.localVideo && this.rtc.useVideo) {
					attachMediaStream(this.rtc.localVideo, $stream);
					this.rtc.localStream = $stream;
				}
			},
			onUserMediaError : function () {
				this.error("doGetUserMedia", "Could not get user media");
			},
			doPeerConnection : function ($cb) {
				this.getIceServers((function ($ice) {
					this.signal.send('session', {type: 'ice', ice: $ice}, this.rtc.peer, this.rtc.connType);
					this.onIceServers($ice);
					$cb();
				}).bind(this));
			},
			onPeerConnectionError : function () {
				this.error ("doPeerConnection", "Could not create peer connection");
			},
			doGetUserMedia : function () {
				var _constraint = {"audio": this.rtc.useAudio, "video": {"mandatory": {}, "optional": []}};
				if (this.rtc.screenshare) {
					_constraint.video.mandatory = {
						maxWidth : window.screen.width,
						maxHeight : window.screen.height,
						maxFrameRate : 3
					}
					if (webrtcDetectedBrowser === "chrome") {
						_constraint.video.mandatory.chromeMediaSource = 'screen';
					} else {
						_constraint.video.mandatory.mediaSource = 'screen';
					}
					_constraint.audio = false;
				}
				try {
					if( !this.rtc.useAudio && !this.rtc.useVideo ) return;
					getUserMedia(_constraint,(this.onUserMediaSuccess).bind(this),(this.onUserMediaError).bind(this));
				} catch (e) {
					this.onUserMediaError();
				}
			},
			setLocalAndSendMessage : function ($sessionDescription) {
				this.rtc.peerConn.setLocalDescription($sessionDescription);
				this.signal.send('session', $sessionDescription, this.rtc.peer, this.rtc.connType);
			},
			mergeConstraints : function ($c1, $c2) {
				var m = $c1;
				for (var n in $c2.mandatory) {
					m.mandatory[n] = $c2.mandatory[n];
				}
				m.optional.concat($c2.optional);
				return m;
			},
			setConstraints : function () {
				this.rtc.sdpConstraints = "{'mandatory': {'OfferToReceiveAudio':" + (!!this.rtc.useAudio).toString() + ", 'OfferToReceiveVideo':" + (!!this.rtc.useVideo).toString() + " }}"
			},
			error : function ($func, $msg) {
				$xirsys.events.getInstance().emit($xirsys.p2p.error, $func, $msg);
			}
		},
		statics : {
			/* status */
			PEER : "peer",
			CLIENT : "client",
			DISCONNECTED : "disconnected",
			CONNECTED : "connected",
			CALLING : "calling",
			ANSWERING : "answering",
			/* events */
			offer : "p2p.offer",
			answer : "p2p.answer",
			error : "p2p.error",
			iceConnected : "p2p.iceConnected",
			iceDisconnected : "p2p.iceDisconnected",
			dataChannelError : "p2p.dataChannelError",
			dataChannelMessage : "p2p.dataChannelMessage",
			dataChannelOpen : "p2p.dataChannelOpen",
			dataChannelClose : "p2p.dataChannelClose",
			requestDenied : "p2p.requestDenied",
			/* connection type */
			publish : "pub",
			subscribe : "sub",
			direct : null // force null value for standard calls
		}
	});

})();
