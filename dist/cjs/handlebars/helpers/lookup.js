'use strict';

exports.__esModule = true;

exports['default'] = function (instance) {
  instance.registerHelper('lookup', function (obj, field, options) {
    if (!obj) {
      // Note for 5.0: Change to "obj == null" in 5.0
      return obj;
    }
    return options.lookupProperty(obj, field);
  });
};

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMvbG9va3VwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7cUJBQWUsVUFBVSxRQUFRLEVBQUU7QUFDakMsVUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsVUFBVSxHQUFHLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRTtBQUMvRCxRQUFJLENBQUMsR0FBRyxFQUFFOztBQUVSLGFBQU8sR0FBRyxDQUFDO0tBQ1o7QUFDRCxXQUFPLE9BQU8sQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0dBQzNDLENBQUMsQ0FBQztDQUNKIiwiZmlsZSI6Imxvb2t1cC5qcyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChpbnN0YW5jZSkge1xyXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb29rdXAnLCBmdW5jdGlvbiAob2JqLCBmaWVsZCwgb3B0aW9ucykge1xyXG4gICAgaWYgKCFvYmopIHtcclxuICAgICAgLy8gTm90ZSBmb3IgNS4wOiBDaGFuZ2UgdG8gXCJvYmogPT0gbnVsbFwiIGluIDUuMFxyXG4gICAgICByZXR1cm4gb2JqO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG9wdGlvbnMubG9va3VwUHJvcGVydHkob2JqLCBmaWVsZCk7XHJcbiAgfSk7XHJcbn1cclxuIl19
