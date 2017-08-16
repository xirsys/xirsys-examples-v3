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

	********************************************************************************

	This script provides functionality for connecting to the 
	XirSys API endpoints.

	No external libraries are required. However, if supporting an
	older browser (earlier than Internet Explorer 8, Firefox 3.1, 
	Safari 4, and Chrome 3), then you may want to use the open
	source JSON library by Douglas Crockford :
	 (https://github.com/douglascrockford/JSON-js) 

*********************************************************************************/

'use strict';

(function() {

    /*********************************************************************************
     * For full use of this class, see the information at the top of this script.
     *********************************************************************************/

    $xirsys.class.create({
        namespace: 'api',
        constructor: function($opts, $url) {
            console.log("api.js ",$url);
            if (!!$url) {
                this.url = $url + "?type=ice";
            }
            this.data = $opts;
        },
        fields: {
            ice: null
        },
        methods: {
            getIceServers: function($cb) {
                var self = this,
                    opts = self.xirsys_opts;
                console.log("TURN OPTS ARE", opts);
                $xirsys.ajax.do({
                        url: (!!this.url ? this.url+"/_turn" : $xirsys.api.iceUrl+ "/" + opts.channel), //(this.url+"/_turn" || $xirsys.api.iceUrl+ "/" + opts.channel) ,
                        headers: $xirsys.authHeader(opts),
                        method: 'PUT',
                        data: JSON.stringify({})
                    })
                    .done(function($data) {
                        self.ice = $data.v;
                        $cb.apply(this, [self.ice]);
                    });
            }
        },
        statics: {
            iceUrl: $xirsys.url("_turn")
        }
    });

})();
