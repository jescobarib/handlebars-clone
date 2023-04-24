'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerDecorator('inline', function (fn, props, container, options) {
    var ret = fn;
    if (!props.partials) {
      props.partials = {};
      ret = function (context, options) {
        // Create a new partials stack frame prior to exec.
        var original = container.partials;
        container.partials = _utils.extend({}, original, props.partials);
        var ret = fn(context, options);
        container.partials = original;
        return ret;
      };
    }

    props.partials[options.args[0]] = options.fn;

    return ret;
  });
};

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2RlY29yYXRvcnMvaW5saW5lLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7cUJBQXVCLFVBQVU7O3FCQUVsQixVQUFVLFFBQVEsRUFBRTtBQUNqQyxVQUFRLENBQUMsaUJBQWlCLENBQ3hCLFFBQVEsRUFDUixVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRTtBQUN2QyxRQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFDYixRQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRTtBQUNuQixXQUFLLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztBQUNwQixTQUFHLEdBQUcsVUFBVSxPQUFPLEVBQUUsT0FBTyxFQUFFOztBQUVoQyxZQUFJLFFBQVEsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDO0FBQ2xDLGlCQUFTLENBQUMsUUFBUSxHQUFHLGNBQU8sRUFBRSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDMUQsWUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMvQixpQkFBUyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFDOUIsZUFBTyxHQUFHLENBQUM7T0FDWixDQUFDO0tBQ0g7O0FBRUQsU0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQzs7QUFFN0MsV0FBTyxHQUFHLENBQUM7R0FDWixDQUNGLENBQUM7Q0FDSCIsImZpbGUiOiJpbmxpbmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuLi91dGlscyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcclxuICBpbnN0YW5jZS5yZWdpc3RlckRlY29yYXRvcihcclxuICAgICdpbmxpbmUnLFxyXG4gICAgZnVuY3Rpb24gKGZuLCBwcm9wcywgY29udGFpbmVyLCBvcHRpb25zKSB7XHJcbiAgICAgIGxldCByZXQgPSBmbjtcclxuICAgICAgaWYgKCFwcm9wcy5wYXJ0aWFscykge1xyXG4gICAgICAgIHByb3BzLnBhcnRpYWxzID0ge307XHJcbiAgICAgICAgcmV0ID0gZnVuY3Rpb24gKGNvbnRleHQsIG9wdGlvbnMpIHtcclxuICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBwYXJ0aWFscyBzdGFjayBmcmFtZSBwcmlvciB0byBleGVjLlxyXG4gICAgICAgICAgbGV0IG9yaWdpbmFsID0gY29udGFpbmVyLnBhcnRpYWxzO1xyXG4gICAgICAgICAgY29udGFpbmVyLnBhcnRpYWxzID0gZXh0ZW5kKHt9LCBvcmlnaW5hbCwgcHJvcHMucGFydGlhbHMpO1xyXG4gICAgICAgICAgbGV0IHJldCA9IGZuKGNvbnRleHQsIG9wdGlvbnMpO1xyXG4gICAgICAgICAgY29udGFpbmVyLnBhcnRpYWxzID0gb3JpZ2luYWw7XHJcbiAgICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHByb3BzLnBhcnRpYWxzW29wdGlvbnMuYXJnc1swXV0gPSBvcHRpb25zLmZuO1xyXG5cclxuICAgICAgcmV0dXJuIHJldDtcclxuICAgIH1cclxuICApO1xyXG59XHJcbiJdfQ==
