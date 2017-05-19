/*********************************************************************************
	Copyright (c) 2011, The WebRTC project authors. All rights reserved.

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are
	met:

		* Redistributions of source code must retain the above copyright
			notice, this list of conditions and the following disclaimer.

		* Redistributions in binary form must reproduce the above copyright
			notice, this list of conditions and the following disclaimer in
			the documentation and/or other materials provided with the
			distribution.

		* Neither the name of Google nor the names of its contributors may
			be used to endorse or promote products derived from this software
			without specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
	"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
	LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
	A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
	HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
	SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
	LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
	DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
	THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
	OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*********************************************************************************/

'use strict';

var RTCPeerConnection = RTCPeerConnection || null,
	RTCIceCandidate = RTCIceCandidate || null,
	RTCSessionDescription = RTCSessionDescription || null,
	getUserMedia = getUserMedia || null,
	attachMediaStream = null,
	detachMediaStream = null,
	reattachMediaStream = null,
	webrtcDetectedBrowser = null;

if (navigator.mozGetUserMedia) {
	console.log("This appears to be Firefox");

	webrtcDetectedBrowser = "firefox";
	RTCPeerConnection = mozRTCPeerConnection;
	RTCSessionDescription = mozRTCSessionDescription;
	RTCIceCandidate = mozRTCIceCandidate;

	// Get UserMedia (only difference is the prefix).
	// Code from Adam Barth.
	getUserMedia = navigator.mozGetUserMedia.bind(navigator);

	attachMediaStream = function (element, stream) {
		console.log("Attaching media stream");
		element.mozSrcObject = stream;
		element.play();
	};
	
	detachMediaStream = function (element) {
		console.log("detaching media stream");
		element.pause();
		element.mozSrcObject = null;
	};

	reattachMediaStream = function (to, from) {
		console.log("Reattaching media stream");
		to.mozSrcObject = from.mozSrcObject;
		to.play();
	};

	// Fake get{Video,Audio}Tracks
	if (!MediaStream.prototype.getVideoTracks) {
		MediaStream.prototype.getVideoTracks = function () {
			return [];
		}
	}

	if (!MediaStream.prototype.getAudioTracks) {
		MediaStream.prototype.getAudioTracks = function () {
			return [];
		}
	}
} else if (navigator.webkitGetUserMedia) {
	console.log("This appears to be Chrome");

	webrtcDetectedBrowser = "chrome";

	RTCPeerConnection = webkitRTCPeerConnection;
	
	// Get UserMedia (only difference is the prefix).
	// Code from Adam Barth.
	getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

	// Attach a media stream to an element.
	attachMediaStream = function (element, stream) {
		if (typeof element.srcObject !== 'undefined') {
			element.srcObject = stream;
		} else if (typeof element.mozSrcObject !== 'undefined') {
			element.mozSrcObject = stream;
		} else if (typeof element.src !== 'undefined') {
			element.src = URL.createObjectURL(stream);
		} else {
			console.log('Error attaching stream to element.');
		}
	};
	
	detachMediaStream = function (element) {
		console.log("detaching media stream");
		element.pause();
		if (typeof element.srcObject !== 'undefined') {
			element.srcObject = null;
		} else if (typeof element.mozSrcObject !== 'undefined') {
			element.mozSrcObject = null;
		} else if (typeof element.src !== 'undefined') {
			element.src = null;
		}
	};

	reattachMediaStream = function (to, from) {
		to.src = from.src;
	};

	// The representation of tracks in a stream is changed in M26.
	// Unify them for earlier Chrome versions in the coexisting period.
	if (!webkitMediaStream.prototype.getVideoTracks) {
		webkitMediaStream.prototype.getVideoTracks = function () {
			return this.videoTracks;
		};
		webkitMediaStream.prototype.getAudioTracks = function () {
			return this.audioTracks;
		};
	}

	// New syntax of getXXXStreams method in M26.
	if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
		webkitRTCPeerConnection.prototype.getLocalStreams = function () {
			return this.localStreams;
		};
		webkitRTCPeerConnection.prototype.getRemoteStreams = function () {
			return this.remoteStreams;
		};
	}
} else {
	console.log("Browser does not appear to be WebRTC-capable");
}

