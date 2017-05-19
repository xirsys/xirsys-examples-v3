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
    namespace : 'databind',
    inherits : $xirsys.events,
    constructor : function ($id, $cb) {
      this.init($id, $cb);
    },
    methods : {
      init : function($id, $cb) {
        this.id = $id;
        this.cb = $cb;
        this.attr = "data-bind-" + $id;
        this.msg = $id + ":change";
        if (document.addEventListener)
          document.addEventListener("change", this.change_handler.bind(this), false);
        else
          document.attachEvent("onChange", this.change_handler.bind(this));
        $xirsys.events.getInstance().on(this.msg, this.msg_handler.bind(this));
      },
      change_handler : function($evt) {
        var trgt = $evt.target || $evt.srcElement,
            prop_name = trgt.getAttribute(this.attr);
        if (!!prop_name && prop_name !== "")
          $xirsys.events.getInstance().emit(this.msg, prop_name, trgt.value);
      },
      msg_handler : function($evt, $prop, $val) {
        var elems = document.querySelectorAll("[" + this.attr + "='" + $prop + "']"),
            tag_name;

        if (this.cb)
          this.cb.call(this, $val);

        for (var i = 0, len = elems.length; i < len; i++) {
          tag_name = elems[i].tagName.toLowerCase();

          if (tag_name === "input" || tag_name === "textarea" || tag_name === "select")
            elems[i].value = $val;
          else
            elems[i].innerHTML = $val;
        }
      }
    }
  })

})();