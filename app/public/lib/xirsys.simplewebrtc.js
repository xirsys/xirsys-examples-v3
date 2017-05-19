/*********************************************************************************
	The MIT License (MIT) 

	Copyright (c) 2014 XirSys

	@author: Lee Sylvester

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

(function () {

	$xirsys.class.create({
		namespace : 'simplewebrtc',
		// $url must include a trailing forward stroke
		constructor : function ($url) {
			var c = $xirsys.simplewebrtc;
			if (!!$url) {
				c.tokenUrl = $url + '?type=token';
				c.iceUrl = $url + '?type=ice';
				c.roomUrl = $url + '?type=room';
				c.wsUrl = $url + '?type=signal';
			}
		},
		fields : {
			connectionTypes: {
				default: 'default',
				direct: 'direct',
				server: 'server'
			},
			token : "",
			ice : [],
			xirsys_opts : null
		},
		methods : {
			connect : function ($opts, $rtcOpts, $resp) {
				this.xirsys_opts = $opts;
				$rtcOpts = $rtcOpts || {};
				var self = this;
				self.xirsysRequest($xirsys.simplewebrtc.wsUrl, function ($wdata) {
					self.ws = $wdata.v;
					$rtcOpts.url = "ws" + self.ws.substr(2, self.ws.length);
					$rtcOpts.connection = new $xirsys.connection(self, null, $opts);
					self.ref = new SimpleWebRTC($rtcOpts);
					$resp.apply(self, self.ref);
				});
			},
			on : function ($ev, $fun) {
				this.ref.on($ev, $fun);
			},
			getDomId : function ($peer) {
				return this.ref.getDomId($peer);
			},
			capabilities : function () {
				return this.ref.capabilities;
			},
			createRoom : function ($room, $fun) {
				var self = this;
				if (!!$room) {
					this.xirsys_opts.room = $room;
				}
				self.ref.createRoom($room, $fun);
			},
			prepareRoom : function ($room) {
				if (!!$room) {
					this.prepare_room = $room;
					this.ref.sessionReady = true;
				}
			},
			joinRoom : function ($room) {
				var self = this;
				if (!!$room) {
					this.xirsys_opts.channel = $room;
				}
				self.ref.joinRoom($room);
			},
			leaveRoom : function() {
				this.ref.leaveRoom();
			},
			xirsysRequest : function ($url, $cb, $data) {
				var self = this,
					opts = this.xirsys_opts;
				$xirsys.ajax.do({
					url: $url,
					method: 'PUT',
					headers: $xirsys.authHeader(opts),
					data: $data
				}) 
				.done($cb);
			},
			getLocalScreen : function () {
				return this.ref.getLocalScreen();
			},
			stopScreenShare : function () {
				this.ref.stopScreenShare();
			},
			shareScreen : function ($handle) {
				this.ref.shareScreen($handle);
			}
		},
		statics : {
			tokenUrl : function(channel, username) {
				return $xirsys.url("_token/"+channel, {k: username});
			},
			iceUrl : $xirsys.url("_turn"),
			wsUrl : $xirsys.url("_host", {type: "signal"}),
			roomUrl : function(channel) {
				return $xirsys.url("_ns/"+channel);
			}
		}
	});

})();
