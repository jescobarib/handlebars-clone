/* global define */
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

var SourceNode = undefined;

try {
  /* istanbul ignore next */
  if (typeof define !== 'function' || !define.amd) {
    // We don't support this in AMD environments. For these environments, we assume that
    // they are running on the browser and thus have no need for the source-map library.
    var SourceMap = require('source-map'); // eslint-disable-line no-undef
    SourceNode = SourceMap.SourceNode;
  }
} catch (err) {}
/* NOP */

/* istanbul ignore if: tested but not covered in istanbul due to dist build  */
if (!SourceNode) {
  SourceNode = function (line, column, srcFile, chunks) {
    this.src = '';
    if (chunks) {
      this.add(chunks);
    }
  };
  /* istanbul ignore next */
  SourceNode.prototype = {
    add: function add(chunks) {
      if (_utils.isArray(chunks)) {
        chunks = chunks.join('');
      }
      this.src += chunks;
    },
    prepend: function prepend(chunks) {
      if (_utils.isArray(chunks)) {
        chunks = chunks.join('');
      }
      this.src = chunks + this.src;
    },
    toStringWithSourceMap: function toStringWithSourceMap() {
      return { code: this.toString() };
    },
    toString: function toString() {
      return this.src;
    }
  };
}

function castChunk(chunk, codeGen, loc) {
  if (_utils.isArray(chunk)) {
    var ret = [];

    for (var i = 0, len = chunk.length; i < len; i++) {
      ret.push(codeGen.wrap(chunk[i], loc));
    }
    return ret;
  } else if (typeof chunk === 'boolean' || typeof chunk === 'number') {
    // Handle primitives that the SourceNode will throw up on
    return chunk + '';
  }
  return chunk;
}

function CodeGen(srcFile) {
  this.srcFile = srcFile;
  this.source = [];
}

CodeGen.prototype = {
  isEmpty: function isEmpty() {
    return !this.source.length;
  },
  prepend: function prepend(source, loc) {
    this.source.unshift(this.wrap(source, loc));
  },
  push: function push(source, loc) {
    this.source.push(this.wrap(source, loc));
  },

  merge: function merge() {
    var source = this.empty();
    this.each(function (line) {
      source.add(['  ', line, '\n']);
    });
    return source;
  },

  each: function each(iter) {
    for (var i = 0, len = this.source.length; i < len; i++) {
      iter(this.source[i]);
    }
  },

  empty: function empty() {
    var loc = this.currentLocation || { start: {} };
    return new SourceNode(loc.start.line, loc.start.column, this.srcFile);
  },
  wrap: function wrap(chunk) {
    var loc = arguments.length <= 1 || arguments[1] === undefined ? this.currentLocation || { start: {} } : arguments[1];

    if (chunk instanceof SourceNode) {
      return chunk;
    }

    chunk = castChunk(chunk, this, loc);

    return new SourceNode(loc.start.line, loc.start.column, this.srcFile, chunk);
  },

  functionCall: function functionCall(fn, type, params) {
    params = this.generateList(params);
    return this.wrap([fn, type ? '.' + type + '(' : '(', params, ')']);
  },

  quotedString: function quotedString(str) {
    return '"' + (str + '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028') // Per Ecma-262 7.3 + 7.8.4
    .replace(/\u2029/g, '\\u2029') + '"';
  },

  objectLiteral: function objectLiteral(obj) {
    // istanbul ignore next

    var _this = this;

    var pairs = [];

    Object.keys(obj).forEach(function (key) {
      var value = castChunk(obj[key], _this);
      if (value !== 'undefined') {
        pairs.push([_this.quotedString(key), ':', value]);
      }
    });

    var ret = this.generateList(pairs);
    ret.prepend('{');
    ret.add('}');
    return ret;
  },

  generateList: function generateList(entries) {
    var ret = this.empty();

    for (var i = 0, len = entries.length; i < len; i++) {
      if (i) {
        ret.add(',');
      }

      ret.add(castChunk(entries[i], this));
    }

    return ret;
  },

  generateArray: function generateArray(entries) {
    var ret = this.generateList(entries);
    ret.prepend('[');
    ret.add(']');

    return ret;
  }
};

exports['default'] = CodeGen;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvZGUtZ2VuLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O3FCQUN3QixVQUFVOztBQUVsQyxJQUFJLFVBQVUsWUFBQSxDQUFDOztBQUVmLElBQUk7O0FBRUYsTUFBSSxPQUFPLE1BQU0sS0FBSyxVQUFVLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFOzs7QUFHL0MsUUFBSSxTQUFTLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3RDLGNBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDO0dBQ25DO0NBQ0YsQ0FBQyxPQUFPLEdBQUcsRUFBRSxFQUViOzs7O0FBQUEsQUFHRCxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ2YsWUFBVSxHQUFHLFVBQVUsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQ3BELFFBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ2QsUUFBSSxNQUFNLEVBQUU7QUFDVixVQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2xCO0dBQ0YsQ0FBQzs7QUFFRixZQUFVLENBQUMsU0FBUyxHQUFHO0FBQ3JCLE9BQUcsRUFBRSxhQUFVLE1BQU0sRUFBRTtBQUNyQixVQUFJLGVBQVEsTUFBTSxDQUFDLEVBQUU7QUFDbkIsY0FBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7T0FDMUI7QUFDRCxVQUFJLENBQUMsR0FBRyxJQUFJLE1BQU0sQ0FBQztLQUNwQjtBQUNELFdBQU8sRUFBRSxpQkFBVSxNQUFNLEVBQUU7QUFDekIsVUFBSSxlQUFRLE1BQU0sQ0FBQyxFQUFFO0FBQ25CLGNBQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO09BQzFCO0FBQ0QsVUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztL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QUcsQ0FBQyxDQUFDO0FBQ2pCLE9BQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7O0FBRWIsV0FBTyxHQUFHLENBQUM7R0FDWjtDQUNGLENBQUM7O3FCQUVhLE9BQU8iLCJmaWxlIjoiY29kZS1nZW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWwgZGVmaW5lICovXHJcbmltcG9ydCB7IGlzQXJyYXkgfSBmcm9tICcuLi91dGlscyc7XHJcblxyXG5sZXQgU291cmNlTm9kZTtcclxuXHJcbnRyeSB7XHJcbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cclxuICBpZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJyB8fCAhZGVmaW5lLmFtZCkge1xyXG4gICAgLy8gV2UgZG9uJ3Qgc3VwcG9ydCB0aGlzIGluIEFNRCBlbnZpcm9ubWVudHMuIEZvciB0aGVzZSBlbnZpcm9ubWVudHMsIHdlIGFzc3VtZSB0aGF0XHJcbiAgICAvLyB0aGV5IGFyZSBydW5uaW5nIG9uIHRoZSBicm93c2VyIGFuZCB0aHVzIGhhdmUgbm8gbmVlZCBmb3IgdGhlIHNvdXJjZS1tYXAgbGlicmFyeS5cclxuICAgIGxldCBTb3VyY2VNYXAgPSByZXF1aXJlKCdzb3VyY2UtbWFwJyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcclxuICAgIFNvdXJjZU5vZGUgPSBTb3VyY2VNYXAuU291cmNlTm9kZTtcclxuICB9XHJcbn0gY2F0Y2ggKGVycikge1xyXG4gIC8qIE5PUCAqL1xyXG59XHJcblxyXG4vKiBpc3RhbmJ1bCBpZ25vcmUgaWY6IHRlc3RlZCBidXQgbm90IGNvdmVyZWQgaW4gaXN0YW5idWwgZHVlIHRvIGRpc3QgYnVpbGQgICovXHJcbmlmICghU291cmNlTm9kZSkge1xyXG4gIFNvdXJjZU5vZGUgPSBmdW5jdGlvbiAobGluZSwgY29sdW1uLCBzcmNGaWxlLCBjaHVua3MpIHtcclxuICAgIHRoaXMuc3JjID0gJyc7XHJcbiAgICBpZiAoY2h1bmtzKSB7XHJcbiAgICAgIHRoaXMuYWRkKGNodW5rcyk7XHJcbiAgICB9XHJcbiAgfTtcclxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlID0ge1xyXG4gICAgYWRkOiBmdW5jdGlvbiAoY2h1bmtzKSB7XHJcbiAgICAgIGlmIChpc0FycmF5KGNodW5rcykpIHtcclxuICAgICAgICBjaHVua3MgPSBjaHVua3Muam9pbignJyk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5zcmMgKz0gY2h1bmtzO1xyXG4gICAgfSxcclxuICAgIHByZXBlbmQ6IGZ1bmN0aW9uIChjaHVua3MpIHtcclxuICAgICAgaWYgKGlzQXJyYXkoY2h1bmtzKSkge1xyXG4gICAgICAgIGNodW5rcyA9IGNodW5rcy5qb2luKCcnKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnNyYyA9IGNodW5rcyArIHRoaXMuc3JjO1xyXG4gICAgfSxcclxuICAgIHRvU3RyaW5nV2l0aFNvdXJjZU1hcDogZnVuY3Rpb24gKCkge1xyXG4gICAgICByZXR1cm4geyBjb2RlOiB0aGlzLnRvU3RyaW5nKCkgfTtcclxuICAgIH0sXHJcbiAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5zcmM7XHJcbiAgICB9LFxyXG4gIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNhc3RDaHVuayhjaHVuaywgY29kZUdlbiwgbG9jKSB7XHJcbiAgaWYgKGlzQXJyYXkoY2h1bmspKSB7XHJcbiAgICBsZXQgcmV0ID0gW107XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGNodW5rLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgIHJldC5wdXNoKGNvZGVHZW4ud3JhcChjaHVua1tpXSwgbG9jKSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmV0O1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGNodW5rID09PSAnYm9vbGVhbicgfHwgdHlwZW9mIGNodW5rID09PSAnbnVtYmVyJykge1xyXG4gICAgLy8gSGFuZGxlIHByaW1pdGl2ZXMgdGhhdCB0aGUgU291cmNlTm9kZSB3aWxsIHRocm93IHVwIG9uXHJcbiAgICByZXR1cm4gY2h1bmsgKyAnJztcclxuICB9XHJcbiAgcmV0dXJuIGNodW5rO1xyXG59XHJcblxyXG5mdW5jdGlvbiBDb2RlR2VuKHNyY0ZpbGUpIHtcclxuICB0aGlzLnNyY0ZpbGUgPSBzcmNGaWxlO1xyXG4gIHRoaXMuc291cmNlID0gW107XHJcbn1cclxuXHJcbkNvZGVHZW4ucHJvdG90eXBlID0ge1xyXG4gIGlzRW1wdHkoKSB7XHJcbiAgICByZXR1cm4gIXRoaXMuc291cmNlLmxlbmd0aDtcclxuICB9LFxyXG4gIHByZXBlbmQ6IGZ1bmN0aW9uIChzb3VyY2UsIGxvYykge1xyXG4gICAgdGhpcy5zb3VyY2UudW5zaGlmdCh0aGlzLndyYXAoc291cmNlLCBsb2MpKTtcclxuICB9LFxyXG4gIHB1c2g6IGZ1bmN0aW9uIChzb3VyY2UsIGxvYykge1xyXG4gICAgdGhpcy5zb3VyY2UucHVzaCh0aGlzLndyYXAoc291cmNlLCBsb2MpKTtcclxuICB9LFxyXG5cclxuICBtZXJnZTogZnVuY3Rpb24gKCkge1xyXG4gICAgbGV0IHNvdXJjZSA9IHRoaXMuZW1wdHkoKTtcclxuICAgIHRoaXMuZWFjaChmdW5jdGlvbiAobGluZSkge1xyXG4gICAgICBzb3VyY2UuYWRkKFsnICAnLCBsaW5lLCAnXFxuJ10pO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gc291cmNlO1xyXG4gIH0sXHJcblxyXG4gIGVhY2g6IGZ1bmN0aW9uIChpdGVyKSB7XHJcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5zb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgaXRlcih0aGlzLnNvdXJjZVtpXSk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgZW1wdHk6IGZ1bmN0aW9uICgpIHtcclxuICAgIGxldCBsb2MgPSB0aGlzLmN1cnJlbnRMb2NhdGlvbiB8fCB7IHN0YXJ0OiB7fSB9O1xyXG4gICAgcmV0dXJuIG5ldyBTb3VyY2VOb2RlKGxvYy5zdGFydC5saW5lLCBsb2Muc3RhcnQuY29sdW1uLCB0aGlzLnNyY0ZpbGUpO1xyXG4gIH0sXHJcbiAgd3JhcDogZnVuY3Rpb24gKGNodW5rLCBsb2MgPSB0aGlzLmN1cnJlbnRMb2NhdGlvbiB8fCB7IHN0YXJ0OiB7fSB9KSB7XHJcbiAgICBpZiAoY2h1bmsgaW5zdGFuY2VvZiBTb3VyY2VOb2RlKSB7XHJcbiAgICAgIHJldHVybiBjaHVuaztcclxuICAgIH1cclxuXHJcbiAgICBjaHVuayA9IGNhc3RDaHVuayhjaHVuaywgdGhpcywgbG9jKTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFNvdXJjZU5vZGUoXHJcbiAgICAgIGxvYy5zdGFydC5saW5lLFxyXG4gICAgICBsb2Muc3RhcnQuY29sdW1uLFxyXG4gICAgICB0aGlzLnNyY0ZpbGUsXHJcbiAgICAgIGNodW5rXHJcbiAgICApO1xyXG4gIH0sXHJcblxyXG4gIGZ1bmN0aW9uQ2FsbDogZnVuY3Rpb24gKGZuLCB0eXBlLCBwYXJhbXMpIHtcclxuICAgIHBhcmFtcyA9IHRoaXMuZ2VuZXJhdGVMaXN0KHBhcmFtcyk7XHJcbiAgICByZXR1cm4gdGhpcy53cmFwKFtmbiwgdHlwZSA/ICcuJyArIHR5cGUgKyAnKCcgOiAnKCcsIHBhcmFtcywgJyknXSk7XHJcbiAgfSxcclxuXHJcbiAgcXVvdGVkU3RyaW5nOiBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICAnXCInICtcclxuICAgICAgKHN0ciArICcnKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpXHJcbiAgICAgICAgLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcclxuICAgICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXHJcbiAgICAgICAgLnJlcGxhY2UoL1xcdTIwMjgvZywgJ1xcXFx1MjAyOCcpIC8vIFBlciBFY21hLTI2MiA3LjMgKyA3LjguNFxyXG4gICAgICAgIC5yZXBsYWNlKC9cXHUyMDI5L2csICdcXFxcdTIwMjknKSArXHJcbiAgICAgICdcIidcclxuICAgICk7XHJcbiAgfSxcclxuXHJcbiAgb2JqZWN0TGl0ZXJhbDogZnVuY3Rpb24gKG9iaikge1xyXG4gICAgbGV0IHBhaXJzID0gW107XHJcblxyXG4gICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKChrZXkpID0+IHtcclxuICAgICAgbGV0IHZhbHVlID0gY2FzdENodW5rKG9ialtrZXldLCB0aGlzKTtcclxuICAgICAgaWYgKHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIHBhaXJzLnB1c2goW3RoaXMucXVvdGVkU3RyaW5nKGtleSksICc6JywgdmFsdWVdKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGV0IHJldCA9IHRoaXMuZ2VuZXJhdGVMaXN0KHBhaXJzKTtcclxuICAgIHJldC5wcmVwZW5kKCd7Jyk7XHJcbiAgICByZXQuYWRkKCd9Jyk7XHJcbiAgICByZXR1cm4gcmV0O1xyXG4gIH0sXHJcblxyXG4gIGdlbmVyYXRlTGlzdDogZnVuY3Rpb24gKGVudHJpZXMpIHtcclxuICAgIGxldCByZXQgPSB0aGlzLmVtcHR5KCk7XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGVudHJpZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgaWYgKGkpIHtcclxuICAgICAgICByZXQuYWRkKCcsJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldC5hZGQoY2FzdENodW5rKGVudHJpZXNbaV0sIHRoaXMpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmV0O1xyXG4gIH0sXHJcblxyXG4gIGdlbmVyYXRlQXJyYXk6IGZ1bmN0aW9uIChlbnRyaWVzKSB7XHJcbiAgICBsZXQgcmV0ID0gdGhpcy5nZW5lcmF0ZUxpc3QoZW50cmllcyk7XHJcbiAgICByZXQucHJlcGVuZCgnWycpO1xyXG4gICAgcmV0LmFkZCgnXScpO1xyXG5cclxuICAgIHJldHVybiByZXQ7XHJcbiAgfSxcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IENvZGVHZW47XHJcbiJdfQ==