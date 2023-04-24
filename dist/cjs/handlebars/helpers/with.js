'use strict';

exports.__esModule = true;

var _handlebarsParser = require('@handlebars/parser');

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('with', function (context, options) {
    if (arguments.length != 2) {
      throw new _handlebarsParser.Exception('#with requires exactly one argument');
    }
    if (_utils.isFunction(context)) {
      context = context.call(this);
    }

    var fn = options.fn;

    if (!_utils.isEmpty(context)) {
      var data = options.data;

      return fn(context, {
        data: data,
        blockParams: [context]
      });
    } else {
      return options.inverse(this);
    }
  });
};

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMvd2l0aC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O2dDQUEwQixvQkFBb0I7O3FCQUNWLFVBQVU7O3FCQUUvQixVQUFVLFFBQVEsRUFBRTtBQUNqQyxVQUFRLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxVQUFVLE9BQU8sRUFBRSxPQUFPLEVBQUU7QUFDMUQsUUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtBQUN6QixZQUFNLGdDQUFjLHFDQUFxQyxDQUFDLENBQUM7S0FDNUQ7QUFDRCxRQUFJLGtCQUFXLE9BQU8sQ0FBQyxFQUFFO0FBQ3ZCLGFBQU8sR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzlCOztBQUVELFFBQUksRUFBRSxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUM7O0FBRXBCLFFBQUksQ0FBQyxlQUFRLE9BQU8sQ0FBQyxFQUFFO0FBQ3JCLFVBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7O0FBRXhCLGFBQU8sRUFBRSxDQUFDLE9BQU8sRUFBRTtBQUNqQixZQUFJLEVBQUUsSUFBSTtBQUNWLG1CQUFXLEVBQUUsQ0FBQyxPQUFPLENBQUM7T0FDdkIsQ0FBQyxDQUFDO0tBQ0osTUFBTTtBQUNMLGFBQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUM5QjtHQUNGLENBQUMsQ0FBQztDQUNKIiwiZmlsZSI6IndpdGguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFeGNlcHRpb24gfSBmcm9tICdAaGFuZGxlYmFycy9wYXJzZXInO1xyXG5pbXBvcnQgeyBpc0VtcHR5LCBpc0Z1bmN0aW9uIH0gZnJvbSAnLi4vdXRpbHMnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGluc3RhbmNlKSB7XHJcbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3dpdGgnLCBmdW5jdGlvbiAoY29udGV4dCwgb3B0aW9ucykge1xyXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggIT0gMikge1xyXG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCcjd2l0aCByZXF1aXJlcyBleGFjdGx5IG9uZSBhcmd1bWVudCcpO1xyXG4gICAgfVxyXG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHtcclxuICAgICAgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgZm4gPSBvcHRpb25zLmZuO1xyXG5cclxuICAgIGlmICghaXNFbXB0eShjb250ZXh0KSkge1xyXG4gICAgICBsZXQgZGF0YSA9IG9wdGlvbnMuZGF0YTtcclxuXHJcbiAgICAgIHJldHVybiBmbihjb250ZXh0LCB7XHJcbiAgICAgICAgZGF0YTogZGF0YSxcclxuICAgICAgICBibG9ja1BhcmFtczogW2NvbnRleHRdLFxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBvcHRpb25zLmludmVyc2UodGhpcyk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn1cclxuIl19
