'use strict';

exports.__esModule = true;
exports.extend = extend;
exports.isFunction = isFunction;
exports.indexOf = indexOf;
exports.escapeExpression = escapeExpression;
exports.isEmpty = isEmpty;
exports.createFrame = createFrame;
var escape = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

var badChars = /[&<>"'`=]/g,
    possible = /[&<>"'`=]/;

function escapeChar(chr) {
  return escape[chr];
}

function extend(obj /* , ...source */) {
  for (var i = 1; i < arguments.length; i++) {
    for (var key in arguments[i]) {
      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
        obj[key] = arguments[i][key];
      }
    }
  }

  return obj;
}

var toString = Object.prototype.toString;

exports.toString = toString;
// Sourced from lodash
// https://github.com/lodash/lodash/blob/4.17.21/LICENSE

function isFunction(value) {
  return typeof value === 'function';
}

/* istanbul ignore next */
var isArray = Array.isArray || function (value) {
  return value && typeof value === 'object' ? toString.call(value) === '[object Array]' : false;
};

exports.isArray = isArray;
// Older IE versions do not directly support indexOf so we must implement our own, sadly.

function indexOf(array, value) {
  for (var i = 0, len = array.length; i < len; i++) {
    if (array[i] === value) {
      return i;
    }
  }
  return -1;
}

function escapeExpression(string) {
  if (typeof string !== 'string') {
    // don't escape SafeStrings, since they're already safe
    if (string && string.toHTML) {
      return string.toHTML();
    } else if (string == null) {
      return '';
    } else if (!string) {
      return string + '';
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = '' + string;
  }

  if (!possible.test(string)) {
    return string;
  }
  return string.replace(badChars, escapeChar);
}

function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

function createFrame(object) {
  var frame = extend({}, object);
  frame._parent = object;
  return frame;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLElBQU0sTUFBTSxHQUFHO0FBQ2IsS0FBRyxFQUFFLE9BQU87QUFDWixLQUFHLEVBQUUsTUFBTTtBQUNYLEtBQUcsRUFBRSxNQUFNO0FBQ1gsS0FBRyxFQUFFLFFBQVE7QUFDYixLQUFHLEVBQUUsUUFBUTtBQUNiLEtBQUcsRUFBRSxRQUFRO0FBQ2IsS0FBRyxFQUFFLFFBQVE7Q0FDZCxDQUFDOztBQUVGLElBQU0sUUFBUSxHQUFHLFlBQVk7SUFDM0IsUUFBUSxHQUFHLFdBQVcsQ0FBQzs7QUFFekIsU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFO0FBQ3ZCLFNBQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ3BCOztBQUVNLFNBQVMsTUFBTSxDQUFDLEdBQUcsb0JBQW9CO0FBQzVDLE9BQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3pDLFNBQUssSUFBSSxHQUFHLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzVCLFVBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUMzRCxXQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO09BQzlCO0tBQ0Y7R0FDRjs7QUFFRCxTQUFPLEdBQUcsQ0FBQztDQUNaOztBQUVNLElBQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDOzs7Ozs7QUFJekMsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFO0FBQ2hDLFNBQU8sT0FBTyxLQUFLLEtBQUssVUFBVSxDQUFDO0NBQ3BDOzs7QUFHTSxJQUFNLE9BQU8sR0FDbEIsS0FBSyxDQUFDLE9BQU8sSUFDYixVQUFVLEtBQUssRUFBRTtBQUNmLFNBQU8sS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsR0FDckMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxnQkFBZ0IsR0FDekMsS0FBSyxDQUFDO0NBQ1gsQ0FBQzs7Ozs7QUFHRyxTQUFTLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFO0FBQ3BDLE9BQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDaEQsUUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFO0FBQ3RCLGFBQU8sQ0FBQyxDQUFDO0tBQ1Y7R0FDRjtBQUNELFNBQU8sQ0FBQyxDQUFDLENBQUM7Q0FDWDs7QUFFTSxTQUFTLGdCQUFnQixDQUFDLE1BQU0sRUFBRTtBQUN2QyxNQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTs7QUFFOUIsUUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtBQUMzQixhQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztLQUN4QixNQUFNLElBQUksTUFBTSxJQUFJLElBQUksRUFBRTtBQUN6QixhQUFPLEVBQUUsQ0FBQztLQUNYLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNsQixhQUFPLE1BQU0sR0FBRyxFQUFFLENBQUM7S0FDcEI7Ozs7O0FBS0QsVUFBTSxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUM7R0FDdEI7O0FBRUQsTUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDMUIsV0FBTyxNQUFNLENBQUM7R0FDZjtBQUNELFNBQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7Q0FDN0M7O0FBRU0sU0FBUyxPQUFPLENBQUMsS0FBSyxFQUFFO0FBQzdCLE1BQUksQ0FBQyxLQUFLLElBQUksS0FBSyxLQUFLLENBQUMsRUFBRTtBQUN6QixXQUFPLElBQUksQ0FBQztHQUNiLE1BQU0sSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDL0MsV0FBTyxJQUFJLENBQUM7R0FDYixNQUFNO0FBQ0wsV0FBTyxLQUFLLENBQUM7R0FDZDtDQUNGOztBQUVNLFNBQVMsV0FBVyxDQUFDLE1BQU0sRUFBRTtBQUNsQyxNQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQy9CLE9BQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQ3ZCLFNBQU8sS0FBSyxDQUFDO0NBQ2QiLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBlc2NhcGUgPSB7XHJcbiAgJyYnOiAnJmFtcDsnLFxyXG4gICc8JzogJyZsdDsnLFxyXG4gICc+JzogJyZndDsnLFxyXG4gICdcIic6ICcmcXVvdDsnLFxyXG4gIFwiJ1wiOiAnJiN4Mjc7JyxcclxuICAnYCc6ICcmI3g2MDsnLFxyXG4gICc9JzogJyYjeDNEOycsXHJcbn07XHJcblxyXG5jb25zdCBiYWRDaGFycyA9IC9bJjw+XCInYD1dL2csXHJcbiAgcG9zc2libGUgPSAvWyY8PlwiJ2A9XS87XHJcblxyXG5mdW5jdGlvbiBlc2NhcGVDaGFyKGNocikge1xyXG4gIHJldHVybiBlc2NhcGVbY2hyXTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZChvYmogLyogLCAuLi5zb3VyY2UgKi8pIHtcclxuICBmb3IgKGxldCBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgZm9yIChsZXQga2V5IGluIGFyZ3VtZW50c1tpXSkge1xyXG4gICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFyZ3VtZW50c1tpXSwga2V5KSkge1xyXG4gICAgICAgIG9ialtrZXldID0gYXJndW1lbnRzW2ldW2tleV07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBvYmo7XHJcbn1cclxuXHJcbmV4cG9ydCBsZXQgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xyXG5cclxuLy8gU291cmNlZCBmcm9tIGxvZGFzaFxyXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbG9kYXNoL2xvZGFzaC9ibG9iLzQuMTcuMjEvTElDRU5TRVxyXG5leHBvcnQgZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xyXG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XHJcbn1cclxuXHJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbmV4cG9ydCBjb25zdCBpc0FycmF5ID1cclxuICBBcnJheS5pc0FycmF5IHx8XHJcbiAgZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0J1xyXG4gICAgICA/IHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nXHJcbiAgICAgIDogZmFsc2U7XHJcbiAgfTtcclxuXHJcbi8vIE9sZGVyIElFIHZlcnNpb25zIGRvIG5vdCBkaXJlY3RseSBzdXBwb3J0IGluZGV4T2Ygc28gd2UgbXVzdCBpbXBsZW1lbnQgb3VyIG93biwgc2FkbHkuXHJcbmV4cG9ydCBmdW5jdGlvbiBpbmRleE9mKGFycmF5LCB2YWx1ZSkge1xyXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgaWYgKGFycmF5W2ldID09PSB2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gaTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIC0xO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlRXhwcmVzc2lvbihzdHJpbmcpIHtcclxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcclxuICAgIC8vIGRvbid0IGVzY2FwZSBTYWZlU3RyaW5ncywgc2luY2UgdGhleSdyZSBhbHJlYWR5IHNhZmVcclxuICAgIGlmIChzdHJpbmcgJiYgc3RyaW5nLnRvSFRNTCkge1xyXG4gICAgICByZXR1cm4gc3RyaW5nLnRvSFRNTCgpO1xyXG4gICAgfSBlbHNlIGlmIChzdHJpbmcgPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gJyc7XHJcbiAgICB9IGVsc2UgaWYgKCFzdHJpbmcpIHtcclxuICAgICAgcmV0dXJuIHN0cmluZyArICcnO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZvcmNlIGEgc3RyaW5nIGNvbnZlcnNpb24gYXMgdGhpcyB3aWxsIGJlIGRvbmUgYnkgdGhlIGFwcGVuZCByZWdhcmRsZXNzIGFuZFxyXG4gICAgLy8gdGhlIHJlZ2V4IHRlc3Qgd2lsbCBkbyB0aGlzIHRyYW5zcGFyZW50bHkgYmVoaW5kIHRoZSBzY2VuZXMsIGNhdXNpbmcgaXNzdWVzIGlmXHJcbiAgICAvLyBhbiBvYmplY3QncyB0byBzdHJpbmcgaGFzIGVzY2FwZWQgY2hhcmFjdGVycyBpbiBpdC5cclxuICAgIHN0cmluZyA9ICcnICsgc3RyaW5nO1xyXG4gIH1cclxuXHJcbiAgaWYgKCFwb3NzaWJsZS50ZXN0KHN0cmluZykpIHtcclxuICAgIHJldHVybiBzdHJpbmc7XHJcbiAgfVxyXG4gIHJldHVybiBzdHJpbmcucmVwbGFjZShiYWRDaGFycywgZXNjYXBlQ2hhcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KHZhbHVlKSB7XHJcbiAgaWYgKCF2YWx1ZSAmJiB2YWx1ZSAhPT0gMCkge1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRnJhbWUob2JqZWN0KSB7XHJcbiAgbGV0IGZyYW1lID0gZXh0ZW5kKHt9LCBvYmplY3QpO1xyXG4gIGZyYW1lLl9wYXJlbnQgPSBvYmplY3Q7XHJcbiAgcmV0dXJuIGZyYW1lO1xyXG59XHJcbiJdfQ==
