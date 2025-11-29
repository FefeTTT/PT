//de no existir, crea la función includes
// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {

      if (this == null) {
        throw new TypeError('"this" es null o no está definido');
      }

      // 1. Dejar que O sea ? ToObject(this value).
      var o = Object(this);

      // 2. Dejar que len sea ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. Si len es 0, devuelve false.
      if (len === 0) {
        return false;
      }

      // 4. Dejar que n sea ? ToInteger(fromIndex).
      //    (Si fromIndex no está definido, este paso produce el valor 0.)
      var n = fromIndex | 0;

      // 5. Si n ≥ 0, entonces
      //  a. Dejar que k sea n.
      // 6. Else n < 0,
      //  a. Dejar que k sea len + n.
      //  b. Si k < 0, Dejar que k sea 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }

      // 7. Repite, mientras k < len
      while (k < len) {
        // a. Dejar que elementK sea el resultado de ? Get(O, ! ToString(k)).
        // b. Si SameValueZero(searchElement, elementK) es true, devuelve true.
        if (sameValueZero(o[k], searchElement)) {
          return true;
        }
        // c. Incrementa k por 1.
        k++;
      }

      // 8. Devuelve false
      return false;
    }
  });
}

// Production steps of ECMA-262, Edition 5, 15.4.4.18
// Reference: http://es5.github.com/#x15.4.4.18
if (!Array.prototype.forEach) {

  Array.prototype.forEach = function forEach(callback, thisArg) {
    'use strict';
    var T, k;

    if (this == null) {
      throw new TypeError("this is null or not defined");
    }

    var kValue,
        // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
        O = Object(this),

        // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        len = O.length >>> 0; // Hack to convert O.length to a UInt32

    // 4. If IsCallable(callback) is false, throw a TypeError exception.
    // See: http://es5.github.com/#x9.11
    if ({}.toString.call(callback) !== "[object Function]") {
      throw new TypeError(callback + " is not a function");
    }

    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
    if (arguments.length >= 2) {
      T = thisArg;
    }

    // 6. Let k be 0
    k = 0;

    // 7. Repeat, while k < len
    while (k < len) {

      // a. Let Pk be ToString(k).
      //   This is implicit for LHS operands of the in operator
      // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
      //   This step can be combined with c
      // c. If kPresent is true, then
      if (k in O) {

        // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
        kValue = O[k];

        // ii. Call the Call internal method of callback with T as the this value and
        // argument list containing kValue, k, and O.
        callback.call(T, kValue, k, O);
      }
      // d. Increase k by 1.
      k++;
    }
    // 8. return undefined
  };
}
