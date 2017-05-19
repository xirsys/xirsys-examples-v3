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

  This script provides functionality for creating UI elements from objects.

*********************************************************************************/

'use strict';

(function () {

  /*********************************************************************************
   * For full use of this class, see the information at the top of this script.
   *********************************************************************************/

  var clz = $xirsys.class.create({
    namespace : 'ui',
    statics : {
      parse : function($node, $data) {
        var node = clz.buildNode($node, $data);
        if (!!node && !!$data.children && $data.children.constructor == Array) {
          $data.children.forEach(function($child) {
            clz.parse(node, $child);
          });
        }
      },
      buildNode : function($parent, $data) {
        if (typeof $data == "string") {
          $parent.append(document.createTextNode($data));
          return null;
        } else {
          var elem = document.createElement($data.node || "div")
          Object.keys($data).filter(function(e) {
            return e != "node" && e != "children" && $data.hasOwnProperty(e);
          }).map(function(key) {
            elem.setAttribute(key, $data[key]);
          });
          $parent.append(elem);
          return elem
        }
      }
    }
  });

})();
