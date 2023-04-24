'use strict';

exports.__esModule = true;
exports.HandlebarsEnvironment = HandlebarsEnvironment;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebarsParser = require('@handlebars/parser');

var _utils = require('./utils');

var _helpers = require('./helpers');

var _decorators = require('./decorators');

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _internalProtoAccess = require('./internal/proto-access');

var VERSION = '4.7.7';
exports.VERSION = VERSION;
var COMPILER_REVISION = 8;
exports.COMPILER_REVISION = COMPILER_REVISION;
var LAST_COMPATIBLE_COMPILER_REVISION = 7;

exports.LAST_COMPATIBLE_COMPILER_REVISION = LAST_COMPATIBLE_COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '== 1.x.x',
  5: '== 2.0.0-alpha.x',
  6: '>= 2.0.0-beta.1',
  7: '>= 4.0.0 <4.3.0',
  8: '>= 4.3.0'
};

exports.REVISION_CHANGES = REVISION_CHANGES;
var objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials, decorators) {
  this.helpers = helpers || {};
  this.partials = partials || {};
  this.decorators = decorators || {};

  _helpers.registerDefaultHelpers(this);
  _decorators.registerDefaultDecorators(this);
}

HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: _logger2['default'],
  log: _logger2['default'].log,

  registerHelper: function registerHelper(name, fn) {
    if (_utils.toString.call(name) === objectType) {
      if (fn) {
        throw new _handlebarsParser.Exception('Arg not supported with multiple helpers');
      }
      _utils.extend(this.helpers, name);
    } else {
      this.helpers[name] = fn;
    }
  },
  unregisterHelper: function unregisterHelper(name) {
    delete this.helpers[name];
  },

  registerPartial: function registerPartial(name, partial) {
    if (_utils.toString.call(name) === objectType) {
      _utils.extend(this.partials, name);
    } else {
      if (typeof partial === 'undefined') {
        throw new _handlebarsParser.Exception('Attempting to register a partial called "' + name + '" as undefined');
      }
      this.partials[name] = partial;
    }
  },
  unregisterPartial: function unregisterPartial(name) {
    delete this.partials[name];
  },

  registerDecorator: function registerDecorator(name, fn) {
    if (_utils.toString.call(name) === objectType) {
      if (fn) {
        throw new _handlebarsParser.Exception('Arg not supported with multiple decorators');
      }
      _utils.extend(this.decorators, name);
    } else {
      this.decorators[name] = fn;
    }
  },
  unregisterDecorator: function unregisterDecorator(name) {
    delete this.decorators[name];
  },
  /**
   * Reset the memory of illegal property accesses that have already been logged.
   * @deprecated should only be used in handlebars test-cases
   */
  resetLoggedPropertyAccesses: function resetLoggedPropertyAccesses() {
    _internalProtoAccess.resetLoggedProperties();
  }
};

var log = _logger2['default'].log;

exports.log = log;
exports.createFrame = _utils.createFrame;
exports.logger = _logger2['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2Jhc2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Z0NBQTBCLG9CQUFvQjs7cUJBQ0EsU0FBUzs7dUJBQ2hCLFdBQVc7OzBCQUNSLGNBQWM7O3NCQUNyQyxVQUFVOzs7O21DQUNTLHlCQUF5Qjs7QUFFeEQsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDOztBQUN4QixJQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQzs7QUFDNUIsSUFBTSxpQ0FBaUMsR0FBRyxDQUFDLENBQUM7OztBQUU1QyxJQUFNLGdCQUFnQixHQUFHO0FBQzlCLEdBQUMsRUFBRSxhQUFhO0FBQ2hCLEdBQUMsRUFBRSxlQUFlO0FBQ2xCLEdBQUMsRUFBRSxlQUFlO0FBQ2xCLEdBQUMsRUFBRSxVQUFVO0FBQ2IsR0FBQyxFQUFFLGtCQUFrQjtBQUNyQixHQUFDLEVBQUUsaUJBQWlCO0FBQ3BCLEdBQUMsRUFBRSxpQkFBaUI7QUFDcEIsR0FBQyxFQUFFLFVBQVU7Q0FDZCxDQUFDOzs7QUFFRixJQUFNLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQzs7QUFFOUIsU0FBUyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRTtBQUNuRSxNQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7QUFDN0IsTUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLElBQUksRUFBRSxDQUFDO0FBQy9CLE1BQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxJQUFJLEVBQUUsQ0FBQzs7QUFFbkMsa0NBQXVCLElBQUksQ0FBQyxDQUFDO0FBQzdCLHdDQUEwQixJQUFJLENBQUMsQ0FBQztDQUNqQzs7QUFFRCxxQkFBcUIsQ0FBQyxTQUFTLEdBQUc7QUFDaEMsYUFBVyxFQUFFLHFCQUFxQjs7QUFFbEMsUUFBTSxxQkFBUTtBQUNkLEtBQUcsRUFBRSxvQkFBTyxHQUFHOztBQUVmLGdCQUFjLEVBQUUsd0JBQVUsSUFBSSxFQUFFLEVBQUUsRUFBRTtBQUNsQyxRQUFJLGdCQUFTLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxVQUFVLEVBQUU7QUFDdEMsVUFBSSxFQUFFLEVBQUU7QUFDTixjQUFNLGdDQUFjLHlDQUF5QyxDQUFDLENBQUM7T0FDaEU7QUFDRCxvQkFBTyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQzVCLE1BQU07QUFDTCxVQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztLQUN6QjtHQUNGO0FBQ0Qsa0JBQWdCLEVBQUUsMEJBQVUsSUFBSSxFQUFFO0FBQ2hDLFdBQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUMzQjs7QUFFRCxpQkFBZSxFQUFFLHlCQUFVLElBQUksRUFBRSxPQUFPLEVBQUU7QUFDeEMsUUFBSSxnQkFBUyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssVUFBVSxFQUFFO0FBQ3RDLG9CQUFPLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDN0IsTUFBTTtBQUNMLFVBQUksT0FBTyxPQUFPLEtBQUssV0FBVyxFQUFFO0FBQ2xDLGNBQU0sOEVBQ3dDLElBQUksb0JBQ2pELENBQUM7T0FDSDtBQUNELFVBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDO0tBQy9CO0dBQ0Y7QUFDRCxtQkFBaUIsRUFBRSwyQkFBVSxJQUFJLEVBQUU7QUFDakMsV0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0dBQzVCOztBQUVELG1CQUFpQixFQUFFLDJCQUFVLElBQUksRUFBRSxFQUFFLEVBQUU7QUFDckMsUUFBSSxnQkFBUyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssVUFBVSxFQUFFO0FBQ3RDLFVBQUksRUFBRSxFQUFFO0FBQ04sY0FBTSxnQ0FBYyw0Q0FBNEMsQ0FBQyxDQUFDO09BQ25FO0FBQ0Qsb0JBQU8sSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUMvQixNQUFNO0FBQ0wsVUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7S0FDNUI7R0FDRjtBQUNELHFCQUFtQixFQUFFLDZCQUFVLElBQUksRUFBRTtBQUNuQyxXQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7R0FDOUI7Ozs7O0FBS0QsNkJBQTJCLEVBQUEsdUNBQUc7QUFDNUIsZ0RBQXVCLENBQUM7R0FDekI7Q0FDRixDQUFDOztBQUVLLElBQUksR0FBRyxHQUFHLG9CQUFPLEdBQUcsQ0FBQzs7O1FBRW5CLFdBQVc7UUFBRSxNQUFNIiwiZmlsZSI6ImJhc2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFeGNlcHRpb24gfSBmcm9tICdAaGFuZGxlYmFycy9wYXJzZXInO1xyXG5pbXBvcnQgeyBjcmVhdGVGcmFtZSwgZXh0ZW5kLCB0b1N0cmluZyB9IGZyb20gJy4vdXRpbHMnO1xyXG5pbXBvcnQgeyByZWdpc3RlckRlZmF1bHRIZWxwZXJzIH0gZnJvbSAnLi9oZWxwZXJzJztcclxuaW1wb3J0IHsgcmVnaXN0ZXJEZWZhdWx0RGVjb3JhdG9ycyB9IGZyb20gJy4vZGVjb3JhdG9ycyc7XHJcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi9sb2dnZXInO1xyXG5pbXBvcnQgeyByZXNldExvZ2dlZFByb3BlcnRpZXMgfSBmcm9tICcuL2ludGVybmFsL3Byb3RvLWFjY2Vzcyc7XHJcblxyXG5leHBvcnQgY29uc3QgVkVSU0lPTiA9ICc0LjcuNyc7XHJcbmV4cG9ydCBjb25zdCBDT01QSUxFUl9SRVZJU0lPTiA9IDg7XHJcbmV4cG9ydCBjb25zdCBMQVNUX0NPTVBBVElCTEVfQ09NUElMRVJfUkVWSVNJT04gPSA3O1xyXG5cclxuZXhwb3J0IGNvbnN0IFJFVklTSU9OX0NIQU5HRVMgPSB7XHJcbiAgMTogJzw9IDEuMC5yYy4yJywgLy8gMS4wLnJjLjIgaXMgYWN0dWFsbHkgcmV2MiBidXQgZG9lc24ndCByZXBvcnQgaXRcclxuICAyOiAnPT0gMS4wLjAtcmMuMycsXHJcbiAgMzogJz09IDEuMC4wLXJjLjQnLFxyXG4gIDQ6ICc9PSAxLngueCcsXHJcbiAgNTogJz09IDIuMC4wLWFscGhhLngnLFxyXG4gIDY6ICc+PSAyLjAuMC1iZXRhLjEnLFxyXG4gIDc6ICc+PSA0LjAuMCA8NC4zLjAnLFxyXG4gIDg6ICc+PSA0LjMuMCcsXHJcbn07XHJcblxyXG5jb25zdCBvYmplY3RUeXBlID0gJ1tvYmplY3QgT2JqZWN0XSc7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gSGFuZGxlYmFyc0Vudmlyb25tZW50KGhlbHBlcnMsIHBhcnRpYWxzLCBkZWNvcmF0b3JzKSB7XHJcbiAgdGhpcy5oZWxwZXJzID0gaGVscGVycyB8fCB7fTtcclxuICB0aGlzLnBhcnRpYWxzID0gcGFydGlhbHMgfHwge307XHJcbiAgdGhpcy5kZWNvcmF0b3JzID0gZGVjb3JhdG9ycyB8fCB7fTtcclxuXHJcbiAgcmVnaXN0ZXJEZWZhdWx0SGVscGVycyh0aGlzKTtcclxuICByZWdpc3RlckRlZmF1bHREZWNvcmF0b3JzKHRoaXMpO1xyXG59XHJcblxyXG5IYW5kbGViYXJzRW52aXJvbm1lbnQucHJvdG90eXBlID0ge1xyXG4gIGNvbnN0cnVjdG9yOiBIYW5kbGViYXJzRW52aXJvbm1lbnQsXHJcblxyXG4gIGxvZ2dlcjogbG9nZ2VyLFxyXG4gIGxvZzogbG9nZ2VyLmxvZyxcclxuXHJcbiAgcmVnaXN0ZXJIZWxwZXI6IGZ1bmN0aW9uIChuYW1lLCBmbikge1xyXG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcclxuICAgICAgaWYgKGZuKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignQXJnIG5vdCBzdXBwb3J0ZWQgd2l0aCBtdWx0aXBsZSBoZWxwZXJzJyk7XHJcbiAgICAgIH1cclxuICAgICAgZXh0ZW5kKHRoaXMuaGVscGVycywgbmFtZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmhlbHBlcnNbbmFtZV0gPSBmbjtcclxuICAgIH1cclxuICB9LFxyXG4gIHVucmVnaXN0ZXJIZWxwZXI6IGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICBkZWxldGUgdGhpcy5oZWxwZXJzW25hbWVdO1xyXG4gIH0sXHJcblxyXG4gIHJlZ2lzdGVyUGFydGlhbDogZnVuY3Rpb24gKG5hbWUsIHBhcnRpYWwpIHtcclxuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XHJcbiAgICAgIGV4dGVuZCh0aGlzLnBhcnRpYWxzLCBuYW1lKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICh0eXBlb2YgcGFydGlhbCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFxyXG4gICAgICAgICAgYEF0dGVtcHRpbmcgdG8gcmVnaXN0ZXIgYSBwYXJ0aWFsIGNhbGxlZCBcIiR7bmFtZX1cIiBhcyB1bmRlZmluZWRgXHJcbiAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnBhcnRpYWxzW25hbWVdID0gcGFydGlhbDtcclxuICAgIH1cclxuICB9LFxyXG4gIHVucmVnaXN0ZXJQYXJ0aWFsOiBmdW5jdGlvbiAobmFtZSkge1xyXG4gICAgZGVsZXRlIHRoaXMucGFydGlhbHNbbmFtZV07XHJcbiAgfSxcclxuXHJcbiAgcmVnaXN0ZXJEZWNvcmF0b3I6IGZ1bmN0aW9uIChuYW1lLCBmbikge1xyXG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcclxuICAgICAgaWYgKGZuKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignQXJnIG5vdCBzdXBwb3J0ZWQgd2l0aCBtdWx0aXBsZSBkZWNvcmF0b3JzJyk7XHJcbiAgICAgIH1cclxuICAgICAgZXh0ZW5kKHRoaXMuZGVjb3JhdG9ycywgbmFtZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmRlY29yYXRvcnNbbmFtZV0gPSBmbjtcclxuICAgIH1cclxuICB9LFxyXG4gIHVucmVnaXN0ZXJEZWNvcmF0b3I6IGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICBkZWxldGUgdGhpcy5kZWNvcmF0b3JzW25hbWVdO1xyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogUmVzZXQgdGhlIG1lbW9yeSBvZiBpbGxlZ2FsIHByb3BlcnR5IGFjY2Vzc2VzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gbG9nZ2VkLlxyXG4gICAqIEBkZXByZWNhdGVkIHNob3VsZCBvbmx5IGJlIHVzZWQgaW4gaGFuZGxlYmFycyB0ZXN0LWNhc2VzXHJcbiAgICovXHJcbiAgcmVzZXRMb2dnZWRQcm9wZXJ0eUFjY2Vzc2VzKCkge1xyXG4gICAgcmVzZXRMb2dnZWRQcm9wZXJ0aWVzKCk7XHJcbiAgfSxcclxufTtcclxuXHJcbmV4cG9ydCBsZXQgbG9nID0gbG9nZ2VyLmxvZztcclxuXHJcbmV4cG9ydCB7IGNyZWF0ZUZyYW1lLCBsb2dnZXIgfTtcclxuIl19
