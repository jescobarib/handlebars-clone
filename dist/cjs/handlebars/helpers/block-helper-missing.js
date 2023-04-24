'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('blockHelperMissing', function (context, options) {
    var inverse = options.inverse,
        fn = options.fn;

    if (context === true) {
      return fn(this);
    } else if (context === false || context == null) {
      return inverse(this);
    } else if (_utils.isArray(context)) {
      if (context.length > 0) {
        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      return fn(context, options);
    }
  });
};

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2hlbHBlcnMvYmxvY2staGVscGVyLW1pc3NpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztxQkFBd0IsVUFBVTs7cUJBRW5CLFVBQVUsUUFBUSxFQUFFO0FBQ2pDLFVBQVEsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLEVBQUUsVUFBVSxPQUFPLEVBQUUsT0FBTyxFQUFFO0FBQ3hFLFFBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPO1FBQzNCLEVBQUUsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDOztBQUVsQixRQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7QUFDcEIsYUFBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDakIsTUFBTSxJQUFJLE9BQU8sS0FBSyxLQUFLLElBQUksT0FBTyxJQUFJLElBQUksRUFBRTtBQUMvQyxhQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN0QixNQUFNLElBQUksZUFBUSxPQUFPLENBQUMsRUFBRTtBQUMzQixVQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ3RCLGVBQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO09BQ2hELE1BQU07QUFDTCxlQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztPQUN0QjtLQUNGLE1BQU07QUFDTCxhQUFPLEVBQUUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7S0FDN0I7R0FDRixDQUFDLENBQUM7Q0FDSiIsImZpbGUiOiJibG9jay1oZWxwZXItbWlzc2luZy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQXJyYXkgfSBmcm9tICcuLi91dGlscyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcclxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignYmxvY2tIZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24gKGNvbnRleHQsIG9wdGlvbnMpIHtcclxuICAgIGxldCBpbnZlcnNlID0gb3B0aW9ucy5pbnZlcnNlLFxyXG4gICAgICBmbiA9IG9wdGlvbnMuZm47XHJcblxyXG4gICAgaWYgKGNvbnRleHQgPT09IHRydWUpIHtcclxuICAgICAgcmV0dXJuIGZuKHRoaXMpO1xyXG4gICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSBmYWxzZSB8fCBjb250ZXh0ID09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XHJcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkoY29udGV4dCkpIHtcclxuICAgICAgaWYgKGNvbnRleHQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHJldHVybiBpbnN0YW5jZS5oZWxwZXJzLmVhY2goY29udGV4dCwgb3B0aW9ucyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBmbihjb250ZXh0LCBvcHRpb25zKTtcclxuICAgIH1cclxuICB9KTtcclxufVxyXG4iXX0=
