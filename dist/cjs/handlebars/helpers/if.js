'use strict';

exports.__esModule = true;

var _handlebarsParser = require('@handlebars/parser');

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('if', function (conditional, options) {
    if (arguments.length != 2) {
      throw new _handlebarsParser.Exception('#if requires exactly one argument');
    }
    if (_utils.isFunction(conditional)) {
      conditional = conditional.call(this);
    }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the conditional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if (!options.hash.includeZero && !conditional || _utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function (conditional, options) {
    if (arguments.length != 2) {
      throw new _handlebarsParser.Exception('#unless requires exactly one argument');
    }
    return instance.helpers['if'].call(this, conditional, {
      fn: options.inverse,
      inverse: options.fn,
      hash: options.hash
    });
  });
};

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMvaWYuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztnQ0FBMEIsb0JBQW9COztxQkFDVixVQUFVOztxQkFFL0IsVUFBVSxRQUFRLEVBQUU7QUFDakMsVUFBUSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxXQUFXLEVBQUUsT0FBTyxFQUFFO0FBQzVELFFBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7QUFDekIsWUFBTSxnQ0FBYyxtQ0FBbUMsQ0FBQyxDQUFDO0tBQzFEO0FBQ0QsUUFBSSxrQkFBVyxXQUFXLENBQUMsRUFBRTtBQUMzQixpQkFBVyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDdEM7Ozs7O0FBS0QsUUFBSSxBQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxXQUFXLElBQUssZUFBUSxXQUFXLENBQUMsRUFBRTtBQUN2RSxhQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDOUIsTUFBTTtBQUNMLGFBQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN6QjtHQUNGLENBQUMsQ0FBQzs7QUFFSCxVQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxVQUFVLFdBQVcsRUFBRSxPQUFPLEVBQUU7QUFDaEUsUUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtBQUN6QixZQUFNLGdDQUFjLHVDQUF1QyxDQUFDLENBQUM7S0FDOUQ7QUFDRCxXQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7QUFDcEQsUUFBRSxFQUFFLE9BQU8sQ0FBQyxPQUFPO0FBQ25CLGFBQU8sRUFBRSxPQUFPLENBQUMsRUFBRTtBQUNuQixVQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7S0FDbkIsQ0FBQyxDQUFDO0dBQ0osQ0FBQyxDQUFDO0NBQ0oiLCJmaWxlIjoiaWYuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFeGNlcHRpb24gfSBmcm9tICdAaGFuZGxlYmFycy9wYXJzZXInO1xyXG5pbXBvcnQgeyBpc0VtcHR5LCBpc0Z1bmN0aW9uIH0gZnJvbSAnLi4vdXRpbHMnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGluc3RhbmNlKSB7XHJcbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2lmJywgZnVuY3Rpb24gKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCAhPSAyKSB7XHJcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJyNpZiByZXF1aXJlcyBleGFjdGx5IG9uZSBhcmd1bWVudCcpO1xyXG4gICAgfVxyXG4gICAgaWYgKGlzRnVuY3Rpb24oY29uZGl0aW9uYWwpKSB7XHJcbiAgICAgIGNvbmRpdGlvbmFsID0gY29uZGl0aW9uYWwuY2FsbCh0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBEZWZhdWx0IGJlaGF2aW9yIGlzIHRvIHJlbmRlciB0aGUgcG9zaXRpdmUgcGF0aCBpZiB0aGUgdmFsdWUgaXMgdHJ1dGh5IGFuZCBub3QgZW1wdHkuXHJcbiAgICAvLyBUaGUgYGluY2x1ZGVaZXJvYCBvcHRpb24gbWF5IGJlIHNldCB0byB0cmVhdCB0aGUgY29uZGl0aW9uYWwgYXMgcHVyZWx5IG5vdCBlbXB0eSBiYXNlZCBvbiB0aGVcclxuICAgIC8vIGJlaGF2aW9yIG9mIGlzRW1wdHkuIEVmZmVjdGl2ZWx5IHRoaXMgZGV0ZXJtaW5lcyBpZiAwIGlzIGhhbmRsZWQgYnkgdGhlIHBvc2l0aXZlIHBhdGggb3IgbmVnYXRpdmUuXHJcbiAgICBpZiAoKCFvcHRpb25zLmhhc2guaW5jbHVkZVplcm8gJiYgIWNvbmRpdGlvbmFsKSB8fCBpc0VtcHR5KGNvbmRpdGlvbmFsKSkge1xyXG4gICAgICByZXR1cm4gb3B0aW9ucy5pbnZlcnNlKHRoaXMpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIG9wdGlvbnMuZm4odGhpcyk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCd1bmxlc3MnLCBmdW5jdGlvbiAoY29uZGl0aW9uYWwsIG9wdGlvbnMpIHtcclxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoICE9IDIpIHtcclxuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignI3VubGVzcyByZXF1aXJlcyBleGFjdGx5IG9uZSBhcmd1bWVudCcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnNbJ2lmJ10uY2FsbCh0aGlzLCBjb25kaXRpb25hbCwge1xyXG4gICAgICBmbjogb3B0aW9ucy5pbnZlcnNlLFxyXG4gICAgICBpbnZlcnNlOiBvcHRpb25zLmZuLFxyXG4gICAgICBoYXNoOiBvcHRpb25zLmhhc2gsXHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG4iXX0=