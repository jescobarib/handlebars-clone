'use strict';

exports.__esModule = true;
var AST = {
  // Public API used to evaluate derived attributes regarding AST nodes
  helpers: {
    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    helperExpression: function helperExpression(node) {
      return node.type === 'SubExpression' || (node.type === 'MustacheStatement' || node.type === 'BlockStatement') && !!(node.params && node.params.length || node.hash);
    },

    scopedId: function scopedId(path) {
      return (/^\.|this\b/.test(path.original)
      );
    },

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    simpleId: function simpleId(path) {
      return path.parts.length === 1 && !AST.helpers.scopedId(path) && !path.depth;
    }
  }
};

// Must be exported as an object rather than the root of the module as the jison lexer
// must modify the object to operate properly.
exports['default'] = AST;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2FzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxJQUFJLEdBQUcsR0FBRzs7QUFFUixTQUFPLEVBQUU7Ozs7QUFJUCxvQkFBZ0IsRUFBRSwwQkFBVSxJQUFJLEVBQUU7QUFDaEMsYUFDRSxJQUFJLENBQUMsSUFBSSxLQUFLLGVBQWUsSUFDNUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLG1CQUFtQixJQUNqQyxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQixDQUFBLElBQzlCLENBQUMsRUFBRSxBQUFDLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUssSUFBSSxDQUFDLElBQUksQ0FBQSxBQUFDLEFBQUMsQ0FDdkQ7S0FDSDs7QUFFRCxZQUFRLEVBQUUsa0JBQVUsSUFBSSxFQUFFO0FBQ3hCLGFBQU8sYUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQUM7S0FDekM7Ozs7QUFJRCxZQUFRLEVBQUUsa0JBQVUsSUFBSSxFQUFFO0FBQ3hCLGFBQ0UsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUNyRTtLQUNIO0dBQ0Y7Q0FDRixDQUFDOzs7O3FCQUlhLEdBQUciLCJmaWxlIjoiYXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IEFTVCA9IHtcclxuICAvLyBQdWJsaWMgQVBJIHVzZWQgdG8gZXZhbHVhdGUgZGVyaXZlZCBhdHRyaWJ1dGVzIHJlZ2FyZGluZyBBU1Qgbm9kZXNcclxuICBoZWxwZXJzOiB7XHJcbiAgICAvLyBhIG11c3RhY2hlIGlzIGRlZmluaXRlbHkgYSBoZWxwZXIgaWY6XHJcbiAgICAvLyAqIGl0IGlzIGFuIGVsaWdpYmxlIGhlbHBlciwgYW5kXHJcbiAgICAvLyAqIGl0IGhhcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyIG9yIGhhc2ggc2VnbWVudFxyXG4gICAgaGVscGVyRXhwcmVzc2lvbjogZnVuY3Rpb24gKG5vZGUpIHtcclxuICAgICAgcmV0dXJuIChcclxuICAgICAgICBub2RlLnR5cGUgPT09ICdTdWJFeHByZXNzaW9uJyB8fFxyXG4gICAgICAgICgobm9kZS50eXBlID09PSAnTXVzdGFjaGVTdGF0ZW1lbnQnIHx8XHJcbiAgICAgICAgICBub2RlLnR5cGUgPT09ICdCbG9ja1N0YXRlbWVudCcpICYmXHJcbiAgICAgICAgICAhISgobm9kZS5wYXJhbXMgJiYgbm9kZS5wYXJhbXMubGVuZ3RoKSB8fCBub2RlLmhhc2gpKVxyXG4gICAgICApO1xyXG4gICAgfSxcclxuXHJcbiAgICBzY29wZWRJZDogZnVuY3Rpb24gKHBhdGgpIHtcclxuICAgICAgcmV0dXJuIC9eXFwufHRoaXNcXGIvLnRlc3QocGF0aC5vcmlnaW5hbCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8vIGFuIElEIGlzIHNpbXBsZSBpZiBpdCBvbmx5IGhhcyBvbmUgcGFydCwgYW5kIHRoYXQgcGFydCBpcyBub3RcclxuICAgIC8vIGAuLmAgb3IgYHRoaXNgLlxyXG4gICAgc2ltcGxlSWQ6IGZ1bmN0aW9uIChwYXRoKSB7XHJcbiAgICAgIHJldHVybiAoXHJcbiAgICAgICAgcGF0aC5wYXJ0cy5sZW5ndGggPT09IDEgJiYgIUFTVC5oZWxwZXJzLnNjb3BlZElkKHBhdGgpICYmICFwYXRoLmRlcHRoXHJcbiAgICAgICk7XHJcbiAgICB9LFxyXG4gIH0sXHJcbn07XHJcblxyXG4vLyBNdXN0IGJlIGV4cG9ydGVkIGFzIGFuIG9iamVjdCByYXRoZXIgdGhhbiB0aGUgcm9vdCBvZiB0aGUgbW9kdWxlIGFzIHRoZSBqaXNvbiBsZXhlclxyXG4vLyBtdXN0IG1vZGlmeSB0aGUgb2JqZWN0IHRvIG9wZXJhdGUgcHJvcGVybHkuXHJcbmV4cG9ydCBkZWZhdWx0IEFTVDtcclxuIl19
