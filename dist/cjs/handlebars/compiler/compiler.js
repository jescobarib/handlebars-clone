/* eslint-disable new-cap */

'use strict';

exports.__esModule = true;
exports.Compiler = Compiler;
exports.precompile = precompile;
exports.compile = compile;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebarsParser = require('@handlebars/parser');

var _utils = require('../utils');

var _ast = require('./ast');

var _ast2 = _interopRequireDefault(_ast);

var slice = [].slice;

function Compiler() {}

// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  equals: function equals(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || !argEquals(opcode.args, otherOpcode.args)) {
        return false;
      }
    }

    // We know that length is the same between the two arrays because they are directly tied
    // to the opcode behavior above.
    len = this.children.length;
    for (var i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function compile(program, options) {
    this.sourceNode = [];
    this.opcodes = [];
    this.children = [];
    this.options = options;

    options.blockParams = options.blockParams || [];

    options.knownHelpers = _utils.extend(Object.create(null), {
      helperMissing: true,
      blockHelperMissing: true,
      each: true,
      'if': true,
      unless: true,
      'with': true,
      log: true,
      lookup: true
    }, options.knownHelpers);

    return this.accept(program);
  },

  compileProgram: function compileProgram(program) {
    var childCompiler = new this.compiler(),
        // eslint-disable-line new-cap
    result = childCompiler.compile(program, this.options),
        guid = this.guid++;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;
    this.useDepths = this.useDepths || result.useDepths;

    return guid;
  },

  accept: function accept(node) {
    /* istanbul ignore next: Sanity code */
    if (!this[node.type]) {
      throw new _handlebarsParser.Exception('Unknown type: ' + node.type, node);
    }

    this.sourceNode.unshift(node);
    var ret = this[node.type](node);
    this.sourceNode.shift();
    return ret;
  },

  Program: function Program(program) {
    this.options.blockParams.unshift(program.blockParams);

    var body = program.body,
        bodyLength = body.length;
    for (var i = 0; i < bodyLength; i++) {
      this.accept(body[i]);
    }

    this.options.blockParams.shift();

    this.isSimple = bodyLength === 1;
    this.blockParams = program.blockParams ? program.blockParams.length : 0;

    return this;
  },

  BlockStatement: function BlockStatement(block) {
    transformLiteralToPath(block);

    var program = block.program,
        inverse = block.inverse;

    program = program && this.compileProgram(program);
    inverse = inverse && this.compileProgram(inverse);

    var type = this.classifySexpr(block);

    if (type === 'helper') {
      this.helperSexpr(block, program, inverse);
    } else if (type === 'simple') {
      this.simpleSexpr(block);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue', block.path.original);
    } else {
      this.ambiguousSexpr(block, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  DecoratorBlock: function DecoratorBlock(decorator) {
    var program = decorator.program && this.compileProgram(decorator.program);
    var params = this.setupFullMustacheParams(decorator, program, undefined),
        path = decorator.path;

    this.useDecorators = true;
    this.opcode('registerDecorator', params.length, path.original);
  },

  PartialStatement: function PartialStatement(partial) {
    this.usePartial = true;

    var program = partial.program;
    if (program) {
      program = this.compileProgram(partial.program);
    }

    var params = partial.params;
    if (params.length > 1) {
      throw new _handlebarsParser.Exception('Unsupported number of partial arguments: ' + params.length, partial);
    } else if (!params.length) {
      if (this.options.explicitPartialContext) {
        this.opcode('pushLiteral', 'undefined');
      } else {
        params.push({ type: 'PathExpression', parts: [], depth: 0 });
      }
    }

    var partialName = partial.name.original,
        isDynamic = partial.name.type === 'SubExpression';
    if (isDynamic) {
      this.accept(partial.name);
    }

    this.setupFullMustacheParams(partial, program, undefined, true);

    var indent = partial.indent || '';
    if (this.options.preventIndent && indent) {
      this.opcode('appendContent', indent);
      indent = '';
    }

    this.opcode('invokePartial', isDynamic, partialName, indent);
    this.opcode('append');
  },
  PartialBlockStatement: function PartialBlockStatement(partialBlock) {
    this.PartialStatement(partialBlock);
  },

  MustacheStatement: function MustacheStatement(mustache) {
    this.SubExpression(mustache);

    if (mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },
  Decorator: function Decorator(decorator) {
    this.DecoratorBlock(decorator);
  },

  ContentStatement: function ContentStatement(content) {
    if (content.value) {
      this.opcode('appendContent', content.value);
    }
  },

  CommentStatement: function CommentStatement() {},

  SubExpression: function SubExpression(sexpr) {
    transformLiteralToPath(sexpr);
    var type = this.classifySexpr(sexpr);

    if (type === 'simple') {
      this.simpleSexpr(sexpr);
    } else if (type === 'helper') {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },
  ambiguousSexpr: function ambiguousSexpr(sexpr, program, inverse) {
    var path = sexpr.path,
        name = path.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', path.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    path.strict = true;
    this.accept(path);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function simpleSexpr(sexpr) {
    var path = sexpr.path;
    path.strict = true;
    this.accept(path);
    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function helperSexpr(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        path = sexpr.path,
        name = path.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new _handlebarsParser.Exception('You specified knownHelpersOnly, but used the unknown helper ' + name, sexpr);
    } else {
      path.strict = true;
      path.falsy = true;

      this.accept(path);
      this.opcode('invokeHelper', params.length, path.original, _ast2['default'].helpers.simpleId(path));
    }
  },

  PathExpression: function PathExpression(path) {
    this.addDepth(path.depth);
    this.opcode('getContext', path.depth);

    var name = path.parts[0],
        scoped = _ast2['default'].helpers.scopedId(path),
        blockParamId = !path.depth && !scoped && this.blockParamIndex(name);

    if (blockParamId) {
      this.opcode('lookupBlockParam', blockParamId, path.parts);
    } else if (!name) {
      // Context reference, i.e. `{{foo .}}` or `{{foo ..}}`
      this.opcode('pushContext');
    } else if (path.data) {
      this.options.data = true;
      this.opcode('lookupData', path.depth, path.parts, path.strict);
    } else {
      this.opcode('lookupOnContext', path.parts, path.falsy, path.strict, scoped);
    }
  },

  StringLiteral: function StringLiteral(string) {
    this.opcode('pushString', string.value);
  },

  NumberLiteral: function NumberLiteral(number) {
    this.opcode('pushLiteral', number.value);
  },

  BooleanLiteral: function BooleanLiteral(bool) {
    this.opcode('pushLiteral', bool.value);
  },

  UndefinedLiteral: function UndefinedLiteral() {
    this.opcode('pushLiteral', 'undefined');
  },

  NullLiteral: function NullLiteral() {
    this.opcode('pushLiteral', 'null');
  },

  Hash: function Hash(hash) {
    var pairs = hash.pairs,
        i = 0,
        l = pairs.length;

    this.opcode('pushHash');

    for (; i < l; i++) {
      this.pushParam(pairs[i].value);
    }
    while (i--) {
      this.opcode('assignToHash', pairs[i].key);
    }
    this.opcode('popHash');
  },

  // HELPERS
  opcode: function opcode(name) {
    this.opcodes.push({
      opcode: name,
      args: slice.call(arguments, 1),
      loc: this.sourceNode[0].loc
    });
  },

  addDepth: function addDepth(depth) {
    if (!depth) {
      return;
    }

    this.useDepths = true;
  },

  classifySexpr: function classifySexpr(sexpr) {
    var isSimple = _ast2['default'].helpers.simpleId(sexpr.path);

    var isBlockParam = isSimple && !!this.blockParamIndex(sexpr.path.parts[0]);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    var isHelper = !isBlockParam && _ast2['default'].helpers.helperExpression(sexpr);

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
    var isEligible = !isBlockParam && (isHelper || isSimple);

    // if ambiguous, we can possibly resolve the ambiguity now
    // An eligible helper is one that does not have a complex path, i.e. `this.foo`, `../foo` etc.
    if (isEligible && !isHelper) {
      var _name = sexpr.path.parts[0],
          options = this.options;
      if (options.knownHelpers[_name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) {
      return 'helper';
    } else if (isEligible) {
      return 'ambiguous';
    } else {
      return 'simple';
    }
  },

  pushParams: function pushParams(params) {
    for (var i = 0, l = params.length; i < l; i++) {
      this.pushParam(params[i]);
    }
  },

  pushParam: function pushParam(val) {
    this.accept(val);
  },

  setupFullMustacheParams: function setupFullMustacheParams(sexpr, program, inverse, omitEmpty) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.accept(sexpr.hash);
    } else {
      this.opcode('emptyHash', omitEmpty);
    }

    return params;
  },

  blockParamIndex: function blockParamIndex(name) {
    for (var depth = 0, len = this.options.blockParams.length; depth < len; depth++) {
      var blockParams = this.options.blockParams[depth],
          param = blockParams && _utils.indexOf(blockParams, name);
      if (blockParams && param >= 0) {
        return [depth, param];
      }
    }
  }
};

function precompile(input, options, env) {
  if (options === undefined) options = {};

  validateInput(input, options);

  var environment = compileEnvironment(input, options, env);
  return new env.JavaScriptCompiler().compile(environment, options);
}

function compile(input, options, env) {
  if (options === undefined) options = {};

  options = _utils.extend({}, options);

  validateInput(input, options);

  var compiled = undefined;

  function compileInput() {
    var environment = compileEnvironment(input, options, env),
        templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  return function (context, execOptions) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, execOptions);
  };
}

function validateInput(input, options) {
  if (input == null || typeof input !== 'string' && input.type !== 'Program') {
    throw new _handlebarsParser.Exception('You must pass a string or Handlebars AST to Handlebars.compile. You passed ' + input);
  }

  if (options.trackIds || options.stringParams) {
    throw new _handlebarsParser.Exception('TrackIds and stringParams are no longer supported. See Github #1145');
  }

  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }
}
function compileEnvironment(input, options, env) {
  var ast = env.parse(input, options);
  return new env.Compiler().compile(ast, options);
}

function argEquals(a, b) {
  if (a === b) {
    return true;
  }

  if (_utils.isArray(a) && _utils.isArray(b) && a.length === b.length) {
    for (var i = 0; i < a.length; i++) {
      if (!argEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
}

function transformLiteralToPath(sexpr) {
  if (!sexpr.path.parts) {
    var literal = sexpr.path;
    // Casting to string here to make false and 0 literal values play nicely with the rest
    // of the system.
    sexpr.path = {
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts: [literal.original + ''],
      original: literal.original + '',
      loc: literal.loc
    };
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztnQ0FFMEIsb0JBQW9COztxQkFDTCxVQUFVOzttQkFDbkMsT0FBTzs7OztBQUV2QixJQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDOztBQUVoQixTQUFTLFFBQVEsR0FBRyxFQUFFOzs7Ozs7O0FBTzdCLFFBQVEsQ0FBQyxTQUFTLEdBQUc7QUFDbkIsVUFBUSxFQUFFLFFBQVE7O0FBRWxCLFFBQU0sRUFBRSxnQkFBVSxLQUFLLEVBQUU7QUFDdkIsUUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7QUFDOUIsUUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7QUFDaEMsYUFBTyxLQUFLLENBQUM7S0FDZDs7QUFFRCxTQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzVCLFVBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1VBQzFCLFdBQVcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLFVBQ0UsTUFBTSxDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsTUFBTSxJQUNwQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFDekM7QUFDQSxlQUFPLEtBQUssQ0FBQztPQUNkO0tBQ0Y7Ozs7QUFJRCxPQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7QUFDM0IsU0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM1QixVQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEs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RUFBRTtBQUMxQixlQUFPLEtBQUssQ0FBQztPQUNkO0tBQ0Y7QUFDRCxXQUFPLElBQUksQ0FBQztHQUNiO0NBQ0Y7O0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUU7QUFDckMsTUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ3JCLFFBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7OztBQUd6QixTQUFLLENBQUMsSUFBSSxHQUFHO0FBQ1gsVUFBSSxFQUFFLGdCQUFnQjtBQUN0QixVQUFJLEVBQUUsS0FBSztBQUNYLFdBQUssRUFBRSxDQUFDO0FBQ1IsV0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDOUIsY0FBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsRUFBRTtBQUMvQixTQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUc7S0FDakIsQ0FBQztHQUNIO0NBQ0YiLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBuZXctY2FwICovXHJcblxyXG5pbXBvcnQgeyBFeGNlcHRpb24gfSBmcm9tICdAaGFuZGxlYmFycy9wYXJzZXInO1xyXG5pbXBvcnQgeyBpc0FycmF5LCBpbmRleE9mLCBleHRlbmQgfSBmcm9tICcuLi91dGlscyc7XHJcbmltcG9ydCBBU1QgZnJvbSAnLi9hc3QnO1xyXG5cclxuY29uc3Qgc2xpY2UgPSBbXS5zbGljZTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBDb21waWxlcigpIHt9XHJcblxyXG4vLyB0aGUgZm91bmRIZWxwZXIgcmVnaXN0ZXIgd2lsbCBkaXNhbWJpZ3VhdGUgaGVscGVyIGxvb2t1cCBmcm9tIGZpbmRpbmcgYVxyXG4vLyBmdW5jdGlvbiBpbiBhIGNvbnRleHQuIFRoaXMgaXMgbmVjZXNzYXJ5IGZvciBtdXN0YWNoZSBjb21wYXRpYmlsaXR5LCB3aGljaFxyXG4vLyByZXF1aXJlcyB0aGF0IGNvbnRleHQgZnVuY3Rpb25zIGluIGJsb2NrcyBhcmUgZXZhbHVhdGVkIGJ5IGJsb2NrSGVscGVyTWlzc2luZyxcclxuLy8gYW5kIHRoZW4gcHJvY2VlZCBhcyBpZiB0aGUgcmVzdWx0aW5nIHZhbHVlIHdhcyBwcm92aWRlZCB0byBibG9ja0hlbHBlck1pc3NpbmcuXHJcblxyXG5Db21waWxlci5wcm90b3R5cGUgPSB7XHJcbiAgY29tcGlsZXI6IENvbXBpbGVyLFxyXG5cclxuICBlcXVhbHM6IGZ1bmN0aW9uIChvdGhlcikge1xyXG4gICAgbGV0IGxlbiA9IHRoaXMub3Bjb2Rlcy5sZW5ndGg7XHJcbiAgICBpZiAob3RoZXIub3Bjb2Rlcy5sZW5ndGggIT09IGxlbikge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICBsZXQgb3Bjb2RlID0gdGhpcy5vcGNvZGVzW2ldLFxyXG4gICAgICAgIG90aGVyT3Bjb2RlID0gb3RoZXIub3Bjb2Rlc1tpXTtcclxuICAgICAgaWYgKFxyXG4gICAgICAgIG9wY29kZS5vcGNvZGUgIT09IG90aGVyT3Bjb2RlLm9wY29kZSB8fFxyXG4gICAgICAgICFhcmdFcXVhbHMob3Bjb2RlLmFyZ3MsIG90aGVyT3Bjb2RlLmFyZ3MpXHJcbiAgICAgICkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFdlIGtub3cgdGhhdCBsZW5ndGggaXMgdGhlIHNhbWUgYmV0d2VlbiB0aGUgdHdvIGFycmF5cyBiZWNhdXNlIHRoZXkgYXJlIGRpcmVjdGx5IHRpZWRcclxuICAgIC8vIHRvIHRoZSBvcGNvZGUgYmVoYXZpb3IgYWJvdmUuXHJcbiAgICBsZW4gPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgaWYgKCF0aGlzLmNoaWxkcmVuW2ldLmVxdWFscyhvdGhlci5jaGlsZHJlbltpXSkpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9LFxyXG5cclxuICBndWlkOiAwLFxyXG5cclxuICBjb21waWxlOiBmdW5jdGlvbiAocHJvZ3JhbSwgb3B0aW9ucykge1xyXG4gICAgdGhpcy5zb3VyY2VOb2RlID0gW107XHJcbiAgICB0aGlzLm9wY29kZXMgPSBbXTtcclxuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcclxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcblxyXG4gICAgb3B0aW9ucy5ibG9ja1BhcmFtcyA9IG9wdGlvbnMuYmxvY2tQYXJhbXMgfHwgW107XHJcblxyXG4gICAgb3B0aW9ucy5rbm93bkhlbHBlcnMgPSBleHRlbmQoXHJcbiAgICAgIE9iamVjdC5jcmVhdGUobnVsbCksXHJcbiAgICAgIHtcclxuICAgICAgICBoZWxwZXJNaXNzaW5nOiB0cnVlLFxyXG4gICAgICAgIGJsb2NrSGVscGVyTWlzc2luZzogdHJ1ZSxcclxuICAgICAgICBlYWNoOiB0cnVlLFxyXG4gICAgICAgIGlmOiB0cnVlLFxyXG4gICAgICAgIHVubGVzczogdHJ1ZSxcclxuICAgICAgICB3aXRoOiB0cnVlLFxyXG4gICAgICAgIGxvZzogdHJ1ZSxcclxuICAgICAgICBsb29rdXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIG9wdGlvbnMua25vd25IZWxwZXJzXHJcbiAgICApO1xyXG5cclxuICAgIHJldHVybiB0aGlzLmFjY2VwdChwcm9ncmFtKTtcclxuICB9LFxyXG5cclxuICBjb21waWxlUHJvZ3JhbTogZnVuY3Rpb24gKHByb2dyYW0pIHtcclxuICAgIGxldCBjaGlsZENvbXBpbGVyID0gbmV3IHRoaXMuY29tcGlsZXIoKSwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXHJcbiAgICAgIHJlc3VsdCA9IGNoaWxkQ29tcGlsZXIuY29tcGlsZShwcm9ncmFtLCB0aGlzLm9wdGlvbnMpLFxyXG4gICAgICBndWlkID0gdGhpcy5ndWlkKys7XHJcblxyXG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdGhpcy51c2VQYXJ0aWFsIHx8IHJlc3VsdC51c2VQYXJ0aWFsO1xyXG5cclxuICAgIHRoaXMuY2hpbGRyZW5bZ3VpZF0gPSByZXN1bHQ7XHJcbiAgICB0aGlzLnVzZURlcHRocyA9IHRoaXMudXNlRGVwdGhzIHx8IHJlc3VsdC51c2VEZXB0aHM7XHJcblxyXG4gICAgcmV0dXJuIGd1aWQ7XHJcbiAgfSxcclxuXHJcbiAgYWNjZXB0OiBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQ6IFNhbml0eSBjb2RlICovXHJcbiAgICBpZiAoIXRoaXNbbm9kZS50eXBlXSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdVbmtub3duIHR5cGU6ICcgKyBub2RlLnR5cGUsIG5vZGUpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc291cmNlTm9kZS51bnNoaWZ0KG5vZGUpO1xyXG4gICAgbGV0IHJldCA9IHRoaXNbbm9kZS50eXBlXShub2RlKTtcclxuICAgIHRoaXMuc291cmNlTm9kZS5zaGlmdCgpO1xyXG4gICAgcmV0dXJuIHJldDtcclxuICB9LFxyXG5cclxuICBQcm9ncmFtOiBmdW5jdGlvbiAocHJvZ3JhbSkge1xyXG4gICAgdGhpcy5vcHRpb25zLmJsb2NrUGFyYW1zLnVuc2hpZnQocHJvZ3JhbS5ibG9ja1BhcmFtcyk7XHJcblxyXG4gICAgbGV0IGJvZHkgPSBwcm9ncmFtLmJvZHksXHJcbiAgICAgIGJvZHlMZW5ndGggPSBib2R5Lmxlbmd0aDtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYm9keUxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHRoaXMuYWNjZXB0KGJvZHlbaV0pO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMub3B0aW9ucy5ibG9ja1BhcmFtcy5zaGlmdCgpO1xyXG5cclxuICAgIHRoaXMuaXNTaW1wbGUgPSBib2R5TGVuZ3RoID09PSAxO1xyXG4gICAgdGhpcy5ibG9ja1BhcmFtcyA9IHByb2dyYW0uYmxvY2tQYXJhbXMgPyBwcm9ncmFtLmJsb2NrUGFyYW1zLmxlbmd0aCA6IDA7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfSxcclxuXHJcbiAgQmxvY2tTdGF0ZW1lbnQ6IGZ1bmN0aW9uIChibG9jaykge1xyXG4gICAgdHJhbnNmb3JtTGl0ZXJhbFRvUGF0aChibG9jayk7XHJcblxyXG4gICAgbGV0IHByb2dyYW0gPSBibG9jay5wcm9ncmFtLFxyXG4gICAgICBpbnZlcnNlID0gYmxvY2suaW52ZXJzZTtcclxuXHJcbiAgICBwcm9ncmFtID0gcHJvZ3JhbSAmJiB0aGlzLmNvbXBpbGVQcm9ncmFtKHByb2dyYW0pO1xyXG4gICAgaW52ZXJzZSA9IGludmVyc2UgJiYgdGhpcy5jb21waWxlUHJvZ3JhbShpbnZlcnNlKTtcclxuXHJcbiAgICBsZXQgdHlwZSA9IHRoaXMuY2xhc3NpZnlTZXhwcihibG9jayk7XHJcblxyXG4gICAgaWYgKHR5cGUgPT09ICdoZWxwZXInKSB7XHJcbiAgICAgIHRoaXMuaGVscGVyU2V4cHIoYmxvY2ssIHByb2dyYW0sIGludmVyc2UpO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnc2ltcGxlJykge1xyXG4gICAgICB0aGlzLnNpbXBsZVNleHByKGJsb2NrKTtcclxuXHJcbiAgICAgIC8vIG5vdyB0aGF0IHRoZSBzaW1wbGUgbXVzdGFjaGUgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG9cclxuICAgICAgLy8gZXZhbHVhdGUgaXQgYnkgZXhlY3V0aW5nIGBibG9ja0hlbHBlck1pc3NpbmdgXHJcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xyXG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcclxuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcpO1xyXG4gICAgICB0aGlzLm9wY29kZSgnYmxvY2tWYWx1ZScsIGJsb2NrLnBhdGgub3JpZ2luYWwpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5hbWJpZ3VvdXNTZXhwcihibG9jaywgcHJvZ3JhbSwgaW52ZXJzZSk7XHJcblxyXG4gICAgICAvLyBub3cgdGhhdCB0aGUgc2ltcGxlIG11c3RhY2hlIGlzIHJlc29sdmVkLCB3ZSBuZWVkIHRvXHJcbiAgICAgIC8vIGV2YWx1YXRlIGl0IGJ5IGV4ZWN1dGluZyBgYmxvY2tIZWxwZXJNaXNzaW5nYFxyXG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcclxuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XHJcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcclxuICAgICAgdGhpcy5vcGNvZGUoJ2FtYmlndW91c0Jsb2NrVmFsdWUnKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XHJcbiAgfSxcclxuXHJcbiAgRGVjb3JhdG9yQmxvY2soZGVjb3JhdG9yKSB7XHJcbiAgICBsZXQgcHJvZ3JhbSA9IGRlY29yYXRvci5wcm9ncmFtICYmIHRoaXMuY29tcGlsZVByb2dyYW0oZGVjb3JhdG9yLnByb2dyYW0pO1xyXG4gICAgbGV0IHBhcmFtcyA9IHRoaXMuc2V0dXBGdWxsTXVzdGFjaGVQYXJhbXMoZGVjb3JhdG9yLCBwcm9ncmFtLCB1bmRlZmluZWQpLFxyXG4gICAgICBwYXRoID0gZGVjb3JhdG9yLnBhdGg7XHJcblxyXG4gICAgdGhpcy51c2VEZWNvcmF0b3JzID0gdHJ1ZTtcclxuICAgIHRoaXMub3Bjb2RlKCdyZWdpc3RlckRlY29yYXRvcicsIHBhcmFtcy5sZW5ndGgsIHBhdGgub3JpZ2luYWwpO1xyXG4gIH0sXHJcblxyXG4gIFBhcnRpYWxTdGF0ZW1lbnQ6IGZ1bmN0aW9uIChwYXJ0aWFsKSB7XHJcbiAgICB0aGlzLnVzZVBhcnRpYWwgPSB0cnVlO1xyXG5cclxuICAgIGxldCBwcm9ncmFtID0gcGFydGlhbC5wcm9ncmFtO1xyXG4gICAgaWYgKHByb2dyYW0pIHtcclxuICAgICAgcHJvZ3JhbSA9IHRoaXMuY29tcGlsZVByb2dyYW0ocGFydGlhbC5wcm9ncmFtKTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcGFyYW1zID0gcGFydGlhbC5wYXJhbXM7XHJcbiAgICBpZiAocGFyYW1zLmxlbmd0aCA+IDEpIHtcclxuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcclxuICAgICAgICAnVW5zdXBwb3J0ZWQgbnVtYmVyIG9mIHBhcnRpYWwgYXJndW1lbnRzOiAnICsgcGFyYW1zLmxlbmd0aCxcclxuICAgICAgICBwYXJ0aWFsXHJcbiAgICAgICk7XHJcbiAgICB9IGVsc2UgaWYgKCFwYXJhbXMubGVuZ3RoKSB7XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZXhwbGljaXRQYXJ0aWFsQ29udGV4dCkge1xyXG4gICAgICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsICd1bmRlZmluZWQnKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBwYXJhbXMucHVzaCh7IHR5cGU6ICdQYXRoRXhwcmVzc2lvbicsIHBhcnRzOiBbXSwgZGVwdGg6IDAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBsZXQgcGFydGlhbE5hbWUgPSBwYXJ0aWFsLm5hbWUub3JpZ2luYWwsXHJcbiAgICAgIGlzRHluYW1pYyA9IHBhcnRpYWwubmFtZS50eXBlID09PSAnU3ViRXhwcmVzc2lvbic7XHJcbiAgICBpZiAoaXNEeW5hbWljKSB7XHJcbiAgICAgIHRoaXMuYWNjZXB0KHBhcnRpYWwubmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zZXR1cEZ1bGxNdXN0YWNoZVBhcmFtcyhwYXJ0aWFsLCBwcm9ncmFtLCB1bmRlZmluZWQsIHRydWUpO1xyXG5cclxuICAgIGxldCBpbmRlbnQgPSBwYXJ0aWFsLmluZGVudCB8fCAnJztcclxuICAgIGlmICh0aGlzLm9wdGlvbnMucHJldmVudEluZGVudCAmJiBpbmRlbnQpIHtcclxuICAgICAgdGhpcy5vcGNvZGUoJ2FwcGVuZENvbnRlbnQnLCBpbmRlbnQpO1xyXG4gICAgICBpbmRlbnQgPSAnJztcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm9wY29kZSgnaW52b2tlUGFydGlhbCcsIGlzRHluYW1pYywgcGFydGlhbE5hbWUsIGluZGVudCk7XHJcbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XHJcbiAgfSxcclxuICBQYXJ0aWFsQmxvY2tTdGF0ZW1lbnQ6IGZ1bmN0aW9uIChwYXJ0aWFsQmxvY2spIHtcclxuICAgIHRoaXMuUGFydGlhbFN0YXRlbWVudChwYXJ0aWFsQmxvY2spO1xyXG4gIH0sXHJcblxyXG4gIE11c3RhY2hlU3RhdGVtZW50OiBmdW5jdGlvbiAobXVzdGFjaGUpIHtcclxuICAgIHRoaXMuU3ViRXhwcmVzc2lvbihtdXN0YWNoZSk7XHJcblxyXG4gICAgaWYgKG11c3RhY2hlLmVzY2FwZWQgJiYgIXRoaXMub3B0aW9ucy5ub0VzY2FwZSkge1xyXG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kRXNjYXBlZCcpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vcGNvZGUoJ2FwcGVuZCcpO1xyXG4gICAgfVxyXG4gIH0sXHJcbiAgRGVjb3JhdG9yKGRlY29yYXRvcikge1xyXG4gICAgdGhpcy5EZWNvcmF0b3JCbG9jayhkZWNvcmF0b3IpO1xyXG4gIH0sXHJcblxyXG4gIENvbnRlbnRTdGF0ZW1lbnQ6IGZ1bmN0aW9uIChjb250ZW50KSB7XHJcbiAgICBpZiAoY29udGVudC52YWx1ZSkge1xyXG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kQ29udGVudCcsIGNvbnRlbnQudmFsdWUpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIENvbW1lbnRTdGF0ZW1lbnQ6IGZ1bmN0aW9uICgpIHt9LFxyXG5cclxuICBTdWJFeHByZXNzaW9uOiBmdW5jdGlvbiAoc2V4cHIpIHtcclxuICAgIHRyYW5zZm9ybUxpdGVyYWxUb1BhdGgoc2V4cHIpO1xyXG4gICAgbGV0IHR5cGUgPSB0aGlzLmNsYXNzaWZ5U2V4cHIoc2V4cHIpO1xyXG5cclxuICAgIGlmICh0eXBlID09PSAnc2ltcGxlJykge1xyXG4gICAgICB0aGlzLnNpbXBsZVNleHByKHNleHByKTtcclxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2hlbHBlcicpIHtcclxuICAgICAgdGhpcy5oZWxwZXJTZXhwcihzZXhwcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmFtYmlndW91c1NleHByKHNleHByKTtcclxuICAgIH1cclxuICB9LFxyXG4gIGFtYmlndW91c1NleHByOiBmdW5jdGlvbiAoc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcclxuICAgIGxldCBwYXRoID0gc2V4cHIucGF0aCxcclxuICAgICAgbmFtZSA9IHBhdGgucGFydHNbMF0sXHJcbiAgICAgIGlzQmxvY2sgPSBwcm9ncmFtICE9IG51bGwgfHwgaW52ZXJzZSAhPSBudWxsO1xyXG5cclxuICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgcGF0aC5kZXB0aCk7XHJcblxyXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XHJcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcclxuXHJcbiAgICBwYXRoLnN0cmljdCA9IHRydWU7XHJcbiAgICB0aGlzLmFjY2VwdChwYXRoKTtcclxuXHJcbiAgICB0aGlzLm9wY29kZSgnaW52b2tlQW1iaWd1b3VzJywgbmFtZSwgaXNCbG9jayk7XHJcbiAgfSxcclxuXHJcbiAgc2ltcGxlU2V4cHI6IGZ1bmN0aW9uIChzZXhwcikge1xyXG4gICAgbGV0IHBhdGggPSBzZXhwci5wYXRoO1xyXG4gICAgcGF0aC5zdHJpY3QgPSB0cnVlO1xyXG4gICAgdGhpcy5hY2NlcHQocGF0aCk7XHJcbiAgICB0aGlzLm9wY29kZSgncmVzb2x2ZVBvc3NpYmxlTGFtYmRhJyk7XHJcbiAgfSxcclxuXHJcbiAgaGVscGVyU2V4cHI6IGZ1bmN0aW9uIChzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSkge1xyXG4gICAgbGV0IHBhcmFtcyA9IHRoaXMuc2V0dXBGdWxsTXVzdGFjaGVQYXJhbXMoc2V4cHIsIHByb2dyYW0sIGludmVyc2UpLFxyXG4gICAgICBwYXRoID0gc2V4cHIucGF0aCxcclxuICAgICAgbmFtZSA9IHBhdGgucGFydHNbMF07XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0pIHtcclxuICAgICAgdGhpcy5vcGNvZGUoJ2ludm9rZUtub3duSGVscGVyJywgcGFyYW1zLmxlbmd0aCwgbmFtZSk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNPbmx5KSB7XHJcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXHJcbiAgICAgICAgJ1lvdSBzcGVjaWZpZWQga25vd25IZWxwZXJzT25seSwgYnV0IHVzZWQgdGhlIHVua25vd24gaGVscGVyICcgKyBuYW1lLFxyXG4gICAgICAgIHNleHByXHJcbiAgICAgICk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBwYXRoLnN0cmljdCA9IHRydWU7XHJcbiAgICAgIHBhdGguZmFsc3kgPSB0cnVlO1xyXG5cclxuICAgICAgdGhpcy5hY2NlcHQocGF0aCk7XHJcbiAgICAgIHRoaXMub3Bjb2RlKFxyXG4gICAgICAgICdpbnZva2VIZWxwZXInLFxyXG4gICAgICAgIHBhcmFtcy5sZW5ndGgsXHJcbiAgICAgICAgcGF0aC5vcmlnaW5hbCxcclxuICAgICAgICBBU1QuaGVscGVycy5zaW1wbGVJZChwYXRoKVxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIFBhdGhFeHByZXNzaW9uOiBmdW5jdGlvbiAocGF0aCkge1xyXG4gICAgdGhpcy5hZGREZXB0aChwYXRoLmRlcHRoKTtcclxuICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgcGF0aC5kZXB0aCk7XHJcblxyXG4gICAgbGV0IG5hbWUgPSBwYXRoLnBhcnRzWzBdLFxyXG4gICAgICBzY29wZWQgPSBBU1QuaGVscGVycy5zY29wZWRJZChwYXRoKSxcclxuICAgICAgYmxvY2tQYXJhbUlkID0gIXBhdGguZGVwdGggJiYgIXNjb3BlZCAmJiB0aGlzLmJsb2NrUGFyYW1JbmRleChuYW1lKTtcclxuXHJcbiAgICBpZiAoYmxvY2tQYXJhbUlkKSB7XHJcbiAgICAgIHRoaXMub3Bjb2RlKCdsb29rdXBCbG9ja1BhcmFtJywgYmxvY2tQYXJhbUlkLCBwYXRoLnBhcnRzKTtcclxuICAgIH0gZWxzZSBpZiAoIW5hbWUpIHtcclxuICAgICAgLy8gQ29udGV4dCByZWZlcmVuY2UsIGkuZS4gYHt7Zm9vIC59fWAgb3IgYHt7Zm9vIC4ufX1gXHJcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoQ29udGV4dCcpO1xyXG4gICAgfSBlbHNlIGlmIChwYXRoLmRhdGEpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLmRhdGEgPSB0cnVlO1xyXG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwRGF0YScsIHBhdGguZGVwdGgsIHBhdGgucGFydHMsIHBhdGguc3RyaWN0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMub3Bjb2RlKFxyXG4gICAgICAgICdsb29rdXBPbkNvbnRleHQnLFxyXG4gICAgICAgIHBhdGgucGFydHMsXHJcbiAgICAgICAgcGF0aC5mYWxzeSxcclxuICAgICAgICBwYXRoLnN0cmljdCxcclxuICAgICAgICBzY29wZWRcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBTdHJpbmdMaXRlcmFsOiBmdW5jdGlvbiAoc3RyaW5nKSB7XHJcbiAgICB0aGlzLm9wY29kZSgncHVzaFN0cmluZycsIHN0cmluZy52YWx1ZSk7XHJcbiAgfSxcclxuXHJcbiAgTnVtYmVyTGl0ZXJhbDogZnVuY3Rpb24gKG51bWJlcikge1xyXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hMaXRlcmFsJywgbnVtYmVyLnZhbHVlKTtcclxuICB9LFxyXG5cclxuICBCb29sZWFuTGl0ZXJhbDogZnVuY3Rpb24gKGJvb2wpIHtcclxuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsIGJvb2wudmFsdWUpO1xyXG4gIH0sXHJcblxyXG4gIFVuZGVmaW5lZExpdGVyYWw6IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsICd1bmRlZmluZWQnKTtcclxuICB9LFxyXG5cclxuICBOdWxsTGl0ZXJhbDogZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hMaXRlcmFsJywgJ251bGwnKTtcclxuICB9LFxyXG5cclxuICBIYXNoOiBmdW5jdGlvbiAoaGFzaCkge1xyXG4gICAgbGV0IHBhaXJzID0gaGFzaC5wYWlycyxcclxuICAgICAgaSA9IDAsXHJcbiAgICAgIGwgPSBwYWlycy5sZW5ndGg7XHJcblxyXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hIYXNoJyk7XHJcblxyXG4gICAgZm9yICg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgdGhpcy5wdXNoUGFyYW0ocGFpcnNbaV0udmFsdWUpO1xyXG4gICAgfVxyXG4gICAgd2hpbGUgKGktLSkge1xyXG4gICAgICB0aGlzLm9wY29kZSgnYXNzaWduVG9IYXNoJywgcGFpcnNbaV0ua2V5KTtcclxuICAgIH1cclxuICAgIHRoaXMub3Bjb2RlKCdwb3BIYXNoJyk7XHJcbiAgfSxcclxuXHJcbiAgLy8gSEVMUEVSU1xyXG4gIG9wY29kZTogZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgIHRoaXMub3Bjb2Rlcy5wdXNoKHtcclxuICAgICAgb3Bjb2RlOiBuYW1lLFxyXG4gICAgICBhcmdzOiBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXHJcbiAgICAgIGxvYzogdGhpcy5zb3VyY2VOb2RlWzBdLmxvYyxcclxuICAgIH0pO1xyXG4gIH0sXHJcblxyXG4gIGFkZERlcHRoOiBmdW5jdGlvbiAoZGVwdGgpIHtcclxuICAgIGlmICghZGVwdGgpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudXNlRGVwdGhzID0gdHJ1ZTtcclxuICB9LFxyXG5cclxuICBjbGFzc2lmeVNleHByOiBmdW5jdGlvbiAoc2V4cHIpIHtcclxuICAgIGxldCBpc1NpbXBsZSA9IEFTVC5oZWxwZXJzLnNpbXBsZUlkKHNleHByLnBhdGgpO1xyXG5cclxuICAgIGxldCBpc0Jsb2NrUGFyYW0gPSBpc1NpbXBsZSAmJiAhIXRoaXMuYmxvY2tQYXJhbUluZGV4KHNleHByLnBhdGgucGFydHNbMF0pO1xyXG5cclxuICAgIC8vIGEgbXVzdGFjaGUgaXMgYW4gZWxpZ2libGUgaGVscGVyIGlmOlxyXG4gICAgLy8gKiBpdHMgaWQgaXMgc2ltcGxlIChhIHNpbmdsZSBwYXJ0LCBub3QgYHRoaXNgIG9yIGAuLmApXHJcbiAgICBsZXQgaXNIZWxwZXIgPSAhaXNCbG9ja1BhcmFtICYmIEFTVC5oZWxwZXJzLmhlbHBlckV4cHJlc3Npb24oc2V4cHIpO1xyXG5cclxuICAgIC8vIGlmIGEgbXVzdGFjaGUgaXMgYW4gZWxpZ2libGUgaGVscGVyIGJ1dCBub3QgYSBkZWZpbml0ZVxyXG4gICAgLy8gaGVscGVyLCBpdCBpcyBhbWJpZ3VvdXMsIGFuZCB3aWxsIGJlIHJlc29sdmVkIGluIGEgbGF0ZXJcclxuICAgIC8vIHBhc3Mgb3IgYXQgcnVudGltZS5cclxuICAgIGxldCBpc0VsaWdpYmxlID0gIWlzQmxvY2tQYXJhbSAmJiAoaXNIZWxwZXIgfHwgaXNTaW1wbGUpO1xyXG5cclxuICAgIC8vIGlmIGFtYmlndW91cywgd2UgY2FuIHBvc3NpYmx5IHJlc29sdmUgdGhlIGFtYmlndWl0eSBub3dcclxuICAgIC8vIEFuIGVsaWdpYmxlIGhlbHBlciBpcyBvbmUgdGhhdCBkb2VzIG5vdCBoYXZlIGEgY29tcGxleCBwYXRoLCBpLmUuIGB0aGlzLmZvb2AsIGAuLi9mb29gIGV0Yy5cclxuICAgIGlmIChpc0VsaWdpYmxlICYmICFpc0hlbHBlcikge1xyXG4gICAgICBsZXQgbmFtZSA9IHNleHByLnBhdGgucGFydHNbMF0sXHJcbiAgICAgICAgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcclxuICAgICAgaWYgKG9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdKSB7XHJcbiAgICAgICAgaXNIZWxwZXIgPSB0cnVlO1xyXG4gICAgICB9IGVsc2UgaWYgKG9wdGlvbnMua25vd25IZWxwZXJzT25seSkge1xyXG4gICAgICAgIGlzRWxpZ2libGUgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChpc0hlbHBlcikge1xyXG4gICAgICByZXR1cm4gJ2hlbHBlcic7XHJcbiAgICB9IGVsc2UgaWYgKGlzRWxpZ2libGUpIHtcclxuICAgICAgcmV0dXJuICdhbWJpZ3VvdXMnO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuICdzaW1wbGUnO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIHB1c2hQYXJhbXM6IGZ1bmN0aW9uIChwYXJhbXMpIHtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gcGFyYW1zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICB0aGlzLnB1c2hQYXJhbShwYXJhbXNbaV0pO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIHB1c2hQYXJhbTogZnVuY3Rpb24gKHZhbCkge1xyXG4gICAgdGhpcy5hY2NlcHQodmFsKTtcclxuICB9LFxyXG5cclxuICBzZXR1cEZ1bGxNdXN0YWNoZVBhcmFtczogZnVuY3Rpb24gKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlLCBvbWl0RW1wdHkpIHtcclxuICAgIGxldCBwYXJhbXMgPSBzZXhwci5wYXJhbXM7XHJcbiAgICB0aGlzLnB1c2hQYXJhbXMocGFyYW1zKTtcclxuXHJcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcclxuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xyXG5cclxuICAgIGlmIChzZXhwci5oYXNoKSB7XHJcbiAgICAgIHRoaXMuYWNjZXB0KHNleHByLmhhc2gpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcsIG9taXRFbXB0eSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHBhcmFtcztcclxuICB9LFxyXG5cclxuICBibG9ja1BhcmFtSW5kZXg6IGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICBmb3IgKFxyXG4gICAgICBsZXQgZGVwdGggPSAwLCBsZW4gPSB0aGlzLm9wdGlvbnMuYmxvY2tQYXJhbXMubGVuZ3RoO1xyXG4gICAgICBkZXB0aCA8IGxlbjtcclxuICAgICAgZGVwdGgrK1xyXG4gICAgKSB7XHJcbiAgICAgIGxldCBibG9ja1BhcmFtcyA9IHRoaXMub3B0aW9ucy5ibG9ja1BhcmFtc1tkZXB0aF0sXHJcbiAgICAgICAgcGFyYW0gPSBibG9ja1BhcmFtcyAmJiBpbmRleE9mKGJsb2NrUGFyYW1zLCBuYW1lKTtcclxuICAgICAgaWYgKGJsb2NrUGFyYW1zICYmIHBhcmFtID49IDApIHtcclxuICAgICAgICByZXR1cm4gW2RlcHRoLCBwYXJhbV07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHByZWNvbXBpbGUoaW5wdXQsIG9wdGlvbnMgPSB7fSwgZW52KSB7XHJcbiAgdmFsaWRhdGVJbnB1dChpbnB1dCwgb3B0aW9ucyk7XHJcblxyXG4gIGxldCBlbnZpcm9ubWVudCA9IGNvbXBpbGVFbnZpcm9ubWVudChpbnB1dCwgb3B0aW9ucywgZW52KTtcclxuICByZXR1cm4gbmV3IGVudi5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKGVudmlyb25tZW50LCBvcHRpb25zKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGUoaW5wdXQsIG9wdGlvbnMgPSB7fSwgZW52KSB7XHJcbiAgb3B0aW9ucyA9IGV4dGVuZCh7fSwgb3B0aW9ucyk7XHJcblxyXG4gIHZhbGlkYXRlSW5wdXQoaW5wdXQsIG9wdGlvbnMpO1xyXG5cclxuICBsZXQgY29tcGlsZWQ7XHJcblxyXG4gIGZ1bmN0aW9uIGNvbXBpbGVJbnB1dCgpIHtcclxuICAgIGxldCBlbnZpcm9ubWVudCA9IGNvbXBpbGVFbnZpcm9ubWVudChpbnB1dCwgb3B0aW9ucywgZW52KSxcclxuICAgICAgdGVtcGxhdGVTcGVjID0gbmV3IGVudi5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKFxyXG4gICAgICAgIGVudmlyb25tZW50LFxyXG4gICAgICAgIG9wdGlvbnMsXHJcbiAgICAgICAgdW5kZWZpbmVkLFxyXG4gICAgICAgIHRydWVcclxuICAgICAgKTtcclxuICAgIHJldHVybiBlbnYudGVtcGxhdGUodGVtcGxhdGVTcGVjKTtcclxuICB9XHJcblxyXG4gIC8vIFRlbXBsYXRlIGlzIG9ubHkgY29tcGlsZWQgb24gZmlyc3QgdXNlIGFuZCBjYWNoZWQgYWZ0ZXIgdGhhdCBwb2ludC5cclxuICByZXR1cm4gZnVuY3Rpb24gKGNvbnRleHQsIGV4ZWNPcHRpb25zKSB7XHJcbiAgICBpZiAoIWNvbXBpbGVkKSB7XHJcbiAgICAgIGNvbXBpbGVkID0gY29tcGlsZUlucHV0KCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29tcGlsZWQuY2FsbCh0aGlzLCBjb250ZXh0LCBleGVjT3B0aW9ucyk7XHJcbiAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gdmFsaWRhdGVJbnB1dChpbnB1dCwgb3B0aW9ucykge1xyXG4gIGlmIChcclxuICAgIGlucHV0ID09IG51bGwgfHxcclxuICAgICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnICYmIGlucHV0LnR5cGUgIT09ICdQcm9ncmFtJylcclxuICApIHtcclxuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXHJcbiAgICAgICdZb3UgbXVzdCBwYXNzIGEgc3RyaW5nIG9yIEhhbmRsZWJhcnMgQVNUIHRvIEhhbmRsZWJhcnMuY29tcGlsZS4gWW91IHBhc3NlZCAnICtcclxuICAgICAgICBpbnB1dFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGlmIChvcHRpb25zLnRyYWNrSWRzIHx8IG9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XHJcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFxyXG4gICAgICAnVHJhY2tJZHMgYW5kIHN0cmluZ1BhcmFtcyBhcmUgbm8gbG9uZ2VyIHN1cHBvcnRlZC4gU2VlIEdpdGh1YiAjMTE0NSdcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcclxuICAgIG9wdGlvbnMuZGF0YSA9IHRydWU7XHJcbiAgfVxyXG4gIGlmIChvcHRpb25zLmNvbXBhdCkge1xyXG4gICAgb3B0aW9ucy51c2VEZXB0aHMgPSB0cnVlO1xyXG4gIH1cclxufVxyXG5mdW5jdGlvbiBjb21waWxlRW52aXJvbm1lbnQoaW5wdXQsIG9wdGlvbnMsIGVudikge1xyXG4gIGxldCBhc3QgPSBlbnYucGFyc2UoaW5wdXQsIG9wdGlvbnMpO1xyXG4gIHJldHVybiBuZXcgZW52LkNvbXBpbGVyKCkuY29tcGlsZShhc3QsIG9wdGlvbnMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhcmdFcXVhbHMoYSwgYikge1xyXG4gIGlmIChhID09PSBiKSB7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGlmIChpc0FycmF5KGEpICYmIGlzQXJyYXkoYikgJiYgYS5sZW5ndGggPT09IGIubGVuZ3RoKSB7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYgKCFhcmdFcXVhbHMoYVtpXSwgYltpXSkpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gdHJhbnNmb3JtTGl0ZXJhbFRvUGF0aChzZXhwcikge1xyXG4gIGlmICghc2V4cHIucGF0aC5wYXJ0cykge1xyXG4gICAgbGV0IGxpdGVyYWwgPSBzZXhwci5wYXRoO1xyXG4gICAgLy8gQ2FzdGluZyB0byBzdHJpbmcgaGVyZSB0byBtYWtlIGZhbHNlIGFuZCAwIGxpdGVyYWwgdmFsdWVzIHBsYXkgbmljZWx5IHdpdGggdGhlIHJlc3RcclxuICAgIC8vIG9mIHRoZSBzeXN0ZW0uXHJcbiAgICBzZXhwci5wYXRoID0ge1xyXG4gICAgICB0eXBlOiAnUGF0aEV4cHJlc3Npb24nLFxyXG4gICAgICBkYXRhOiBmYWxzZSxcclxuICAgICAgZGVwdGg6IDAsXHJcbiAgICAgIHBhcnRzOiBbbGl0ZXJhbC5vcmlnaW5hbCArICcnXSxcclxuICAgICAgb3JpZ2luYWw6IGxpdGVyYWwub3JpZ2luYWwgKyAnJyxcclxuICAgICAgbG9jOiBsaXRlcmFsLmxvYyxcclxuICAgIH07XHJcbiAgfVxyXG59XHJcbiJdfQ==
