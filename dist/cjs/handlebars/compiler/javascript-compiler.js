'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebarsParser = require('@handlebars/parser');

var _base = require('../base');

var _utils = require('../utils');

var _codeGen = require('./code-gen');

var _codeGen2 = _interopRequireDefault(_codeGen);

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function nameLookup(parent, name /*,  type */) {
    return this.internalNameLookup(parent, name);
  },
  depthedLookup: function depthedLookup(name) {
    return [this.aliasable('container.lookup'), '(depths, ', JSON.stringify(name), ')'];
  },

  compilerInfo: function compilerInfo() {
    var revision = _base.COMPILER_REVISION,
        versions = _base.REVISION_CHANGES[revision];
    return [revision, versions];
  },

  appendToBuffer: function appendToBuffer(source, location, explicit) {
    // Force a source as this simplifies the merge logic.
    if (!_utils.isArray(source)) {
      source = [source];
    }
    source = this.source.wrap(source, location);

    if (this.environment.isSimple) {
      return ['return ', source, ';'];
    } else if (explicit) {
      // This is a case where the buffer operation occurs as a child of another
      // construct, generally braces. We have to explicitly output these buffer
      // operations to ensure that the emitted code goes in the correct location.
      return ['buffer += ', source, ';'];
    } else {
      source.appendToBuffer = true;
      return source;
    }
  },

  initializeBuffer: function initializeBuffer() {
    return this.quotedString('');
  },
  // END PUBLIC API
  internalNameLookup: function internalNameLookup(parent, name) {
    this.lookupPropertyFunctionIsUsed = true;
    return ['lookupProperty(', parent, ',', JSON.stringify(name), ')'];
  },

  lookupPropertyFunctionIsUsed: false,

  compile: function compile(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options;
    this.precompile = !asObject;

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      decorators: [],
      programs: [],
      environments: []
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.aliases = {};
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];
    this.blockParams = [];

    this.compileChildren(environment, options);

    this.useDepths = this.useDepths || environment.useDepths || environment.useDecorators || this.options.compat;
    this.useBlockParams = this.useBlockParams || environment.useBlockParams;

    var opcodes = environment.opcodes,
        opcode = undefined,
        firstLoc = undefined,
        i = undefined,
        l = undefined;

    for (i = 0, l = opcodes.length; i < l; i++) {
      opcode = opcodes[i];

      this.source.currentLocation = opcode.loc;
      firstLoc = firstLoc || opcode.loc;
      this[opcode.opcode].apply(this, opcode.args);
    }

    // Flush any trailing content that might be pending.
    this.source.currentLocation = firstLoc;
    this.pushSource('');

    /* istanbul ignore next */
    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new _handlebarsParser.Exception('Compile completed with content left on stack');
    }

    if (!this.decorators.isEmpty()) {
      this.useDecorators = true;

      this.decorators.prepend(['var decorators = container.decorators, ', this.lookupPropertyFunctionVarDeclaration(), ';\n']);
      this.decorators.push('return fn;');

      if (asObject) {
        // eslint-disable-next-line no-new-func
        this.decorators = Function.apply(this, ['fn', 'props', 'container', 'depth0', 'data', 'blockParams', 'depths', this.decorators.merge()]);
      } else {
        this.decorators.prepend('function(fn, props, container, depth0, data, blockParams, depths) {\n');
        this.decorators.push('}\n');
        this.decorators = this.decorators.merge();
      }
    } else {
      this.decorators = undefined;
    }

    var fn = this.createFunctionContext(asObject);
    if (!this.isChild) {
      var ret = {
        compiler: this.compilerInfo(),
        main: fn
      };

      if (this.decorators) {
        ret.main_d = this.decorators; // eslint-disable-line camelcase
        ret.useDecorators = true;
      }

      var _context = this.context;
      var programs = _context.programs;
      var decorators = _context.decorators;

      for (i = 0, l = programs.length; i < l; i++) {
        if (programs[i]) {
          ret[i] = programs[i];
          if (decorators[i]) {
            ret[i + '_d'] = decorators[i];
            ret.useDecorators = true;
          }
        }
      }

      if (this.environment.usePartial) {
        ret.usePartial = true;
      }
      if (this.options.data) {
        ret.useData = true;
      }
      if (this.useDepths) {
        ret.useDepths = true;
      }
      if (this.useBlockParams) {
        ret.useBlockParams = true;
      }
      if (this.options.compat) {
        ret.compat = true;
      }

      if (!asObject) {
        ret.compiler = JSON.stringify(ret.compiler);

        this.source.currentLocation = { start: { line: 1, column: 0 } };
        ret = this.objectLiteral(ret);

        if (options.srcName) {
          ret = ret.toStringWithSourceMap({ file: options.destName });
          ret.map = ret.map && ret.map.toString();
        } else {
          ret = ret.toString();
        }
      } else {
        ret.compilerOptions = this.options;
      }

      return ret;
    } else {
      return fn;
    }
  },

  preamble: function preamble() {
    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = new _codeGen2['default'](this.options.srcName);
    this.decorators = new _codeGen2['default'](this.options.srcName);
  },

  createFunctionContext: function createFunctionContext(asObject) {
    // istanbul ignore next

    var _this = this;

    var varDeclarations = '';

    var locals = this.stackVars.concat(this.registers.list);
    if (locals.length > 0) {
      varDeclarations += ', ' + locals.join(', ');
    }

    // Generate minimizer alias mappings
    //
    // When using true SourceNodes, this will update all references to the given alias
    // as the source nodes are reused in situ. For the non-source node compilation mode,
    // aliases will not be used, but this case is already being run on the client and
    // we aren't concern about minimizing the template size.
    var aliasCount = 0;
    Object.keys(this.aliases).forEach(function (alias) {
      var node = _this.aliases[alias];
      if (node.children && node.referenceCount > 1) {
        varDeclarations += ', alias' + ++aliasCount + '=' + alias;
        node.children[0] = 'alias' + aliasCount;
      }
    });

    if (this.lookupPropertyFunctionIsUsed) {
      varDeclarations += ', ' + this.lookupPropertyFunctionVarDeclaration();
    }

    var params = ['container', 'depth0', 'helpers', 'partials', 'data'];

    if (this.useBlockParams || this.useDepths) {
      params.push('blockParams');
    }
    if (this.useDepths) {
      params.push('depths');
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource(varDeclarations);

    if (asObject) {
      params.push(source);

      return Function.apply(this, params); // eslint-disable-line no-new-func
    } else {
        return this.source.wrap(['function(', params.join(','), ') {\n  ', source, '}']);
      }
  },
  mergeSource: function mergeSource(varDeclarations) {
    var isSimple = this.environment.isSimple,
        appendOnly = !this.forceBuffer,
        appendFirst = undefined,
        sourceSeen = undefined,
        bufferStart = undefined,
        bufferEnd = undefined;
    this.source.each(function (line) {
      if (line.appendToBuffer) {
        if (bufferStart) {
          line.prepend('  + ');
        } else {
          bufferStart = line;
        }
        bufferEnd = line;
      } else {
        if (bufferStart) {
          if (!sourceSeen) {
            appendFirst = true;
          } else {
            bufferStart.prepend('buffer += ');
          }
          bufferEnd.add(';');
          bufferStart = bufferEnd = undefined;
        }

        sourceSeen = true;
        if (!isSimple) {
          appendOnly = false;
        }
      }
    });

    if (appendOnly) {
      if (bufferStart) {
        bufferStart.prepend('return ');
        bufferEnd.add(';');
      } else if (!sourceSeen) {
        this.source.push('return "";');
      }
    } else {
      varDeclarations += ', buffer = ' + (appendFirst ? '' : this.initializeBuffer());

      if (bufferStart) {
        bufferStart.prepend('return buffer + ');
        bufferEnd.add(';');
      } else {
        this.source.push('return buffer;');
      }
    }

    if (varDeclarations) {
      this.source.prepend('var ' + varDeclarations.substring(2) + (appendFirst ? '' : ';\n'));
    }

    return this.source.merge();
  },

  lookupPropertyFunctionVarDeclaration: function lookupPropertyFunctionVarDeclaration() {
    return '\n      lookupProperty = container.lookupProperty || function(parent, propertyName) {\n        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {\n          return parent[propertyName];\n        }\n        return undefined\n    }\n    '.trim();
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#this.foo}}...{{/this.foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function blockValue(name) {
    var blockHelperMissing = this.aliasable('container.hooks.blockHelperMissing'),
        params = [this.contextName(0)];
    this.setupHelperArgs(name, 0, params);

    var blockName = this.popStack();
    params.splice(1, 0, blockName);

    this.push(this.source.functionCall(blockHelperMissing, 'call', params));
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function ambiguousBlockValue() {
    // We're being a bit cheeky and reusing the options value from the prior exec
    var blockHelperMissing = this.aliasable('container.hooks.blockHelperMissing'),
        params = [this.contextName(0)];
    this.setupHelperArgs('', 0, params, true);

    this.flushInline();

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource(['if (!', this.lastHelper, ') { ', current, ' = ', this.source.functionCall(blockHelperMissing, 'call', params), '}']);
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function appendContent(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    } else {
      this.pendingLocation = this.source.currentLocation;
    }

    this.pendingContent = content;
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function append() {
    if (this.isInline()) {
      this.replaceStack(function (current) {
        return [' != null ? ', current, ' : ""'];
      });

      this.pushSource(this.appendToBuffer(this.popStack()));
    } else {
      var local = this.popStack();
      this.pushSource(['if (', local, ' != null) { ', this.appendToBuffer(local, undefined, true), ' }']);
      if (this.environment.isSimple) {
        this.pushSource(['else { ', this.appendToBuffer("''", undefined, true), ' }']);
      }
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function appendEscaped() {
    this.pushSource(this.appendToBuffer([this.aliasable('container.escapeExpression'), '(', this.popStack(), ')']));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function getContext(depth) {
    this.lastContext = depth;
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function pushContext() {
    this.pushStackLiteral(this.contextName(this.lastContext));
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function lookupOnContext(parts, falsy, strict, scoped) {
    var i = 0;

    if (!scoped && this.options.compat && !this.lastContext) {
      // The depthed query is expected to handle the undefined logic for the root level that
      // is implemented below, so we evaluate that directly in compat mode
      this.push(this.depthedLookup(parts[i++]));
    } else {
      this.pushContext();
    }

    this.resolvePath('context', parts, i, falsy, strict);
  },

  // [lookupBlockParam]
  //
  // On stack, before: ...
  // On stack, after: blockParam[name], ...
  //
  // Looks up the value of `parts` on the given block param and pushes
  // it onto the stack.
  lookupBlockParam: function lookupBlockParam(blockParamId, parts) {
    this.useBlockParams = true;

    this.push(['blockParams[', blockParamId[0], '][', blockParamId[1], ']']);
    this.resolvePath('context', parts, 1);
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function lookupData(depth, parts, strict) {
    if (!depth) {
      this.pushStackLiteral('data');
    } else {
      this.pushStackLiteral('container.data(data, ' + depth + ')');
    }

    this.resolvePath('data', parts, 0, true, strict);
  },

  resolvePath: function resolvePath(type, parts, i, falsy, strict) {
    // istanbul ignore next

    var _this2 = this;

    if (this.options.strict || this.options.assumeObjects) {
      this.push(strictLookup(this.options.strict && strict, this, parts, i, type));
      return;
    }

    var len = parts.length;
    for (; i < len; i++) {
      /* eslint-disable no-loop-func */
      this.replaceStack(function (current) {
        var lookup = _this2.nameLookup(current, parts[i], type);
        // We want to ensure that zero and false are handled properly if the context (falsy flag)
        // needs to have the special handling for these values.
        if (!falsy) {
          return [' != null ? ', lookup, ' : ', current];
        } else {
          // Otherwise we can use generic falsy handling
          return [' && ', lookup];
        }
      });
      /* eslint-enable no-loop-func */
    }
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function resolvePossibleLambda() {
    this.push([this.aliasable('container.lambda'), '(', this.popStack(), ', ', this.contextName(0), ')']);
  },

  emptyHash: function emptyHash(omitEmpty) {
    this.pushStackLiteral(omitEmpty ? 'undefined' : '{}');
  },
  pushHash: function pushHash() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = { values: {} };
  },
  popHash: function popHash() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    this.push(this.objectLiteral(hash.values));
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function pushString(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function pushLiteral(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function pushProgram(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [registerDecorator]
  //
  // On stack, before: hash, program, params..., ...
  // On stack, after: ...
  //
  // Pops off the decorator's parameters, invokes the decorator,
  // and inserts the decorator into the decorators list.
  registerDecorator: function registerDecorator(paramSize, name) {
    var foundDecorator = this.nameLookup('decorators', name, 'decorator'),
        options = this.setupHelperArgs(name, paramSize);

    this.decorators.push(['fn = ', this.decorators.functionCall(foundDecorator, '', ['fn', 'props', 'container', options]), ' || fn;']);
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function invokeHelper(paramSize, name, isSimple) {
    var nonHelper = this.popStack(),
        helper = this.setupHelper(paramSize, name);

    var possibleFunctionCalls = [];

    if (isSimple) {
      // direct call to helper
      possibleFunctionCalls.push(helper.name);
    }
    // call a function from the input object
    possibleFunctionCalls.push(nonHelper);
    if (!this.options.strict) {
      possibleFunctionCalls.push(this.aliasable('container.hooks.helperMissing'));
    }

    var functionLookupCode = ['(', this.itemsSeparatedBy(possibleFunctionCalls, '||'), ')'];
    var functionCall = this.source.functionCall(functionLookupCode, 'call', helper.callParams);
    this.push(functionCall);
  },

  itemsSeparatedBy: function itemsSeparatedBy(items, separator) {
    var result = [];
    result.push(items[0]);
    for (var i = 1; i < items.length; i++) {
      result.push(separator, items[i]);
    }
    return result;
  },
  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function invokeKnownHelper(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(this.source.functionCall(helper.name, 'call', helper.callParams));
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function invokeAmbiguous(name, helperCall) {
    this.useRegister('helper');

    var nonHelper = this.popStack();

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var lookup = ['(', '(helper = ', helperName, ' || ', nonHelper, ')'];
    if (!this.options.strict) {
      lookup[0] = '(helper = ';
      lookup.push(' != null ? helper : ', this.aliasable('container.hooks.helperMissing'));
    }

    this.push(['(', lookup, helper.paramsInit ? ['),(', helper.paramsInit] : [], '),', '(typeof helper === ', this.aliasable('"function"'), ' ? ', this.source.functionCall('helper', 'call', helper.callParams), ' : helper))']);
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function invokePartial(isDynamic, name, indent) {
    var params = [],
        options = this.setupParams(name, 1, params);

    if (isDynamic) {
      name = this.popStack();
      delete options.name;
    }

    if (indent) {
      options.indent = JSON.stringify(indent);
    }
    options.helpers = 'helpers';
    options.partials = 'partials';
    options.decorators = 'container.decorators';

    if (!isDynamic) {
      params.unshift(this.nameLookup('partials', name, 'partial'));
    } else {
      params.unshift(name);
    }

    if (this.options.compat) {
      options.depths = 'depths';
    }
    options = this.objectLiteral(options);
    params.push(options);

    this.push(this.source.functionCall('container.invokePartial', '', params));
  },

  // [assignToHash]
  //
  // On stack, before: value, ..., hash, ...
  // On stack, after: ..., hash, ...
  //
  // Pops a value off the stack and assigns it to the current hash
  assignToHash: function assignToHash(key) {
    this.hash.values[key] = this.popStack();
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function compileChildren(environment, options) {
    var children = environment.children,
        child = undefined,
        compiler = undefined;

    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      compiler = new this.compiler(); // eslint-disable-line new-cap

      var existing = this.matchExistingProgram(child);

      if (existing == null) {
        this.context.programs.push(''); // Placeholder to prevent name conflicts for nested children
        var index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context, !this.precompile);
        this.context.decorators[index] = compiler.decorators;
        this.context.environments[index] = child;

        this.useDepths = this.useDepths || compiler.useDepths;
        this.useBlockParams = this.useBlockParams || compiler.useBlockParams;
        child.useDepths = this.useDepths;
        child.useBlockParams = this.useBlockParams;
      } else {
        child.index = existing.index;
        child.name = 'program' + existing.index;

        this.useDepths = this.useDepths || existing.useDepths;
        this.useBlockParams = this.useBlockParams || existing.useBlockParams;
      }
    }
  },
  matchExistingProgram: function matchExistingProgram(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return environment;
      }
    }
  },

  programExpression: function programExpression(guid) {
    var child = this.environment.children[guid],
        programParams = [child.index, 'data', child.blockParams];

    if (this.useBlockParams || this.useDepths) {
      programParams.push('blockParams');
    }
    if (this.useDepths) {
      programParams.push('depths');
    }

    return 'container.program(' + programParams.join(', ') + ')';
  },

  useRegister: function useRegister(name) {
    if (!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  push: function push(expr) {
    if (!(expr instanceof Literal)) {
      expr = this.source.wrap(expr);
    }

    this.inlineStack.push(expr);
    return expr;
  },

  pushStackLiteral: function pushStackLiteral(item) {
    this.push(new Literal(item));
  },

  pushSource: function pushSource(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent), this.pendingLocation));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  replaceStack: function replaceStack(callback) {
    var prefix = ['('],
        stack = undefined,
        createdStack = undefined,
        usedLiteral = undefined;

    /* istanbul ignore next */
    if (!this.isInline()) {
      throw new _handlebarsParser.Exception('replaceStack on non-inline');
    }

    // We want to merge the inline statement into the replacement statement via ','
    var top = this.popStack(true);

    if (top instanceof Literal) {
      // Literals do not need to be inlined
      stack = [top.value];
      prefix = ['(', stack];
      usedLiteral = true;
    } else {
      // Get or create the current stack name for use by the inline
      createdStack = true;
      var _name = this.incrStack();

      prefix = ['((', this.push(_name), ' = ', top, ')'];
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (!usedLiteral) {
      this.popStack();
    }
    if (createdStack) {
      this.stackSlot--;
    }
    this.push(prefix.concat(item, ')'));
  },

  incrStack: function incrStack() {
    this.stackSlot++;
    if (this.stackSlot > this.stackVars.length) {
      this.stackVars.push('stack' + this.stackSlot);
    }
    return this.topStackName();
  },
  topStackName: function topStackName() {
    return 'stack' + this.stackSlot;
  },
  flushInline: function flushInline() {
    var inlineStack = this.inlineStack;
    this.inlineStack = [];
    for (var i = 0, len = inlineStack.length; i < len; i++) {
      var entry = inlineStack[i];
      /* istanbul ignore if */
      if (entry instanceof Literal) {
        this.compileStack.push(entry);
      } else {
        var stack = this.incrStack();
        this.pushSource([stack, ' = ', entry, ';']);
        this.compileStack.push(stack);
      }
    }
  },
  isInline: function isInline() {
    return this.inlineStack.length;
  },

  popStack: function popStack(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && item instanceof Literal) {
      return item.value;
    } else {
      if (!inline) {
        /* istanbul ignore next */
        if (!this.stackSlot) {
          throw new _handlebarsParser.Exception('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function topStack() {
    var stack = this.isInline() ? this.inlineStack : this.compileStack,
        item = stack[stack.length - 1];

    /* istanbul ignore if */
    if (item instanceof Literal) {
      return item.value;
    } else {
      return item;
    }
  },

  contextName: function contextName(context) {
    if (this.useDepths && context) {
      return 'depths[' + context + ']';
    } else {
      return 'depth' + context;
    }
  },

  quotedString: function quotedString(str) {
    return this.source.quotedString(str);
  },

  objectLiteral: function objectLiteral(obj) {
    return this.source.objectLiteral(obj);
  },

  aliasable: function aliasable(name) {
    var ret = this.aliases[name];
    if (ret) {
      ret.referenceCount++;
      return ret;
    }

    ret = this.aliases[name] = this.source.wrap(name);
    ret.aliasable = true;
    ret.referenceCount = 1;

    return ret;
  },

  setupHelper: function setupHelper(paramSize, name, blockHelper) {
    var params = [],
        paramsInit = this.setupHelperArgs(name, paramSize, params, blockHelper);
    var foundHelper = this.nameLookup('helpers', name, 'helper'),
        callContext = this.aliasable(this.contextName(0) + ' != null ? ' + this.contextName(0) + ' : (container.nullContext || {})');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: [callContext].concat(params)
    };
  },

  setupParams: function setupParams(helper, paramSize, params) {
    var options = {},
        objectArgs = !params,
        param = undefined;

    if (objectArgs) {
      params = [];
    }

    options.name = this.quotedString(helper);
    options.hash = this.popStack();

    var inverse = this.popStack(),
        program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      options.fn = program || 'container.noop';
      options.inverse = inverse || 'container.noop';
    }

    // The parameters go on to the stack in order (making sure that they are evaluated in order)
    // so we need to pop them off the stack in reverse order
    var i = paramSize;
    while (i--) {
      param = this.popStack();
      params[i] = param;
    }

    if (objectArgs) {
      options.args = this.source.generateArray(params);
    }

    if (this.options.data) {
      options.data = 'data';
    }
    if (this.useBlockParams) {
      options.blockParams = 'blockParams';
    }
    return options;
  },

  setupHelperArgs: function setupHelperArgs(helper, paramSize, params, useRegister) {
    var options = this.setupParams(helper, paramSize, params);
    options.loc = JSON.stringify(this.source.currentLocation);
    options = this.objectLiteral(options);
    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return ['options=', options];
    } else if (params) {
      params.push(options);
      return '';
    } else {
      return options;
    }
  }
};

(function () {
  var reservedWords = ('break else new var' + ' case finally return void' + ' catch for switch while' + ' continue function this with' + ' default if throw' + ' delete in try' + ' do instanceof typeof' + ' abstract enum int short' + ' boolean export interface static' + ' byte extends long super' + ' char final native synchronized' + ' class float package throws' + ' const goto private transient' + ' debugger implements protected volatile' + ' double import public let yield await' + ' null true false').split(' ');

  var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

  for (var i = 0, l = reservedWords.length; i < l; i++) {
    compilerWords[reservedWords[i]] = true;
  }
})();

/**
 * @deprecated May be removed in the next major version
 */
JavaScriptCompiler.isValidJavaScriptVariableName = function (name) {
  return !JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
};

function strictLookup(requireTerminal, compiler, parts, i, type) {
  var stack = compiler.popStack(),
      len = parts.length;
  if (requireTerminal) {
    len--;
  }

  for (; i < len; i++) {
    stack = compiler.nameLookup(stack, parts[i], type);
  }

  if (requireTerminal) {
    return [compiler.aliasable('container.strict'), '(', stack, ', ', compiler.quotedString(parts[i]), ', ', JSON.stringify(compiler.source.currentLocation), ' )'];
  } else {
    return stack;
  }
}

exports['default'] = JavaScriptCompiler;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2phdmFzY3JpcHQtY29tcGlsZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztnQ0FBMEIsb0JBQW9COztvQkFDTSxTQUFTOztxQkFDckMsVUFBVTs7dUJBQ2QsWUFBWTs7OztBQUVoQyxTQUFTLE9BQU8sQ0FBQyxLQUFLLEVBQUU7QUFDdEIsTUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7Q0FDcEI7O0FBRUQsU0FBUyxrQkFBa0IsR0FBRyxFQUFFOztBQUVoQyxrQkFBa0IsQ0FBQyxTQUFTLEdBQUc7OztBQUc3QixZQUFVLEVBQUUsb0JBQVUsTUFBTSxFQUFFLElBQUksZUFBZTtBQUMvQyxXQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7R0FDOUM7QUFDRCxlQUFhLEVBQUUsdUJBQVUsSUFBSSxFQUFFO0FBQzdCLFdBQU8sQ0FDTCxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLEVBQ2xDLFdBQVcsRUFDWCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUNwQixHQUFHLENBQ0osQ0FBQztHQUNIOztBQUVELGNBQVksRUFBRSx3QkFBWTtBQUN4QixRQUFNLFFBQVEsMEJBQW9CO1FBQ2hDLFFBQVEsR0FBRyx1QkFBaUIsUUFBUSxDQUFDLENBQUM7QUFDeEMsV0FBTyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztHQUM3Qjs7QUFFRCxnQkFBYyxFQUFFLHdCQUFVLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFOztBQUVwRCxRQUFJLENBQUMsZUFBUSxNQUFNLENBQUMsRUFBRTtBQUNwQixZQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNuQjtBQUNELFVBQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7O0FBRTVDLFFB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QUNuQixXQUFPLENBQ0wsUUFBUSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUN0QyxHQUFHLEVBQ0gsS0FBSyxFQUNMLElBQUksRUFDSixRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUMvQixJQUFJLEVBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUMvQyxJQUFJLENBQ0wsQ0FBQztHQUNILE1BQU07QUFDTCxXQUFPLEtBQUssQ0FBQztHQUNkO0NBQ0Y7O3FCQUVjLGtCQUFrQiIsImZpbGUiOiJqYXZhc2NyaXB0LWNvbXBpbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXhjZXB0aW9uIH0gZnJvbSAnQGhhbmRsZWJhcnMvcGFyc2VyJztcclxuaW1wb3J0IHsgQ09NUElMRVJfUkVWSVNJT04sIFJFVklTSU9OX0NIQU5HRVMgfSBmcm9tICcuLi9iYXNlJztcclxuaW1wb3J0IHsgaXNBcnJheSB9IGZyb20gJy4uL3V0aWxzJztcclxuaW1wb3J0IENvZGVHZW4gZnJvbSAnLi9jb2RlLWdlbic7XHJcblxyXG5mdW5jdGlvbiBMaXRlcmFsKHZhbHVlKSB7XHJcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBKYXZhU2NyaXB0Q29tcGlsZXIoKSB7fVxyXG5cclxuSmF2YVNjcmlwdENvbXBpbGVyLnByb3RvdHlwZSA9IHtcclxuICAvLyBQVUJMSUMgQVBJOiBZb3UgY2FuIG92ZXJyaWRlIHRoZXNlIG1ldGhvZHMgaW4gYSBzdWJjbGFzcyB0byBwcm92aWRlXHJcbiAgLy8gYWx0ZXJuYXRpdmUgY29tcGlsZWQgZm9ybXMgZm9yIG5hbWUgbG9va3VwIGFuZCBidWZmZXJpbmcgc2VtYW50aWNzXHJcbiAgbmFtZUxvb2t1cDogZnVuY3Rpb24gKHBhcmVudCwgbmFtZSAvKiwgIHR5cGUgKi8pIHtcclxuICAgIHJldHVybiB0aGlzLmludGVybmFsTmFtZUxvb2t1cChwYXJlbnQsIG5hbWUpO1xyXG4gIH0sXHJcbiAgZGVwdGhlZExvb2t1cDogZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIHRoaXMuYWxpYXNhYmxlKCdjb250YWluZXIubG9va3VwJyksXHJcbiAgICAgICcoZGVwdGhzLCAnLFxyXG4gICAgICBKU09OLnN0cmluZ2lmeShuYW1lKSxcclxuICAgICAgJyknLFxyXG4gICAgXTtcclxuICB9LFxyXG5cclxuICBjb21waWxlckluZm86IGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnN0IHJldmlzaW9uID0gQ09NUElMRVJfUkVWSVNJT04sXHJcbiAgICAgIHZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tyZXZpc2lvbl07XHJcbiAgICByZXR1cm4gW3JldmlzaW9uLCB2ZXJzaW9uc107XHJcbiAgfSxcclxuXHJcbiAgYXBwZW5kVG9CdWZmZXI6IGZ1bmN0aW9uIChzb3VyY2UsIGxvY2F0aW9uLCBleHBsaWNpdCkge1xyXG4gICAgLy8gRm9yY2UgYSBzb3VyY2UgYXMgdGhpcyBzaW1wbGlmaWVzIHRoZSBtZXJnZSBsb2dpYy5cclxuICAgIGlmICghaXNBcnJheShzb3VyY2UpKSB7XHJcbiAgICAgIHNvdXJjZSA9IFtzb3VyY2VdO1xyXG4gICAgfVxyXG4gICAgc291cmNlID0gdGhpcy5zb3VyY2Uud3JhcChzb3VyY2UsIGxvY2F0aW9uKTtcclxuXHJcbiAgICBpZiAodGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xyXG4gICAgICByZXR1cm4gWydyZXR1cm4gJywgc291cmNlLCAnOyddO1xyXG4gICAgfSBlbHNlIGlmIChleHBsaWNpdCkge1xyXG4gICAgICAvLyBUaGlzIGlzIGEgY2FzZSB3aGVyZSB0aGUgYnVmZmVyIG9wZXJhdGlvbiBvY2N1cnMgYXMgYSBjaGlsZCBvZiBhbm90aGVyXHJcbiAgICAgIC8vIGNvbnN0cnVjdCwgZ2VuZXJhbGx5IGJyYWNlcy4gV2UgaGF2ZSB0byBleHBsaWNpdGx5IG91dHB1dCB0aGVzZSBidWZmZXJcclxuICAgICAgLy8gb3BlcmF0aW9ucyB0byBlbnN1cmUgdGhhdCB0aGUgZW1pdHRlZCBjb2RlIGdvZXMgaW4gdGhlIGNvcnJlY3QgbG9jYXRpb24uXHJcbiAgICAgIHJldHVybiBbJ2J1ZmZlciArPSAnLCBzb3VyY2UsICc7J107XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzb3VyY2UuYXBwZW5kVG9CdWZmZXIgPSB0cnVlO1xyXG4gICAgICByZXR1cm4gc291cmNlO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIGluaXRpYWxpemVCdWZmZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB0aGlzLnF1b3RlZFN0cmluZygnJyk7XHJcbiAgfSxcclxuICAvLyBFTkQgUFVCTElDIEFQSVxyXG4gIGludGVybmFsTmFtZUxvb2t1cDogZnVuY3Rpb24gKHBhcmVudCwgbmFtZSkge1xyXG4gICAgdGhpcy5sb29rdXBQcm9wZXJ0eUZ1bmN0aW9uSXNVc2VkID0gdHJ1ZTtcclxuICAgIHJldHVybiBbJ2xvb2t1cFByb3BlcnR5KCcsIHBhcmVudCwgJywnLCBKU09OLnN0cmluZ2lmeShuYW1lKSwgJyknXTtcclxuICB9LFxyXG5cclxuICBsb29rdXBQcm9wZXJ0eUZ1bmN0aW9uSXNVc2VkOiBmYWxzZSxcclxuXHJcbiAgY29tcGlsZTogZnVuY3Rpb24gKGVudmlyb25tZW50LCBvcHRpb25zLCBjb250ZXh0LCBhc09iamVjdCkge1xyXG4gICAgdGhpcy5lbnZpcm9ubWVudCA9IGVudmlyb25tZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICAgIHRoaXMucHJlY29tcGlsZSA9ICFhc09iamVjdDtcclxuXHJcbiAgICB0aGlzLm5hbWUgPSB0aGlzLmVudmlyb25tZW50Lm5hbWU7XHJcbiAgICB0aGlzLmlzQ2hpbGQgPSAhIWNvbnRleHQ7XHJcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0IHx8IHtcclxuICAgICAgZGVjb3JhdG9yczogW10sXHJcbiAgICAgIHByb2dyYW1zOiBbXSxcclxuICAgICAgZW52aXJvbm1lbnRzOiBbXSxcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5wcmVhbWJsZSgpO1xyXG5cclxuICAgIHRoaXMuc3RhY2tTbG90ID0gMDtcclxuICAgIHRoaXMuc3RhY2tWYXJzID0gW107XHJcbiAgICB0aGlzLmFsaWFzZXMgPSB7fTtcclxuICAgIHRoaXMucmVnaXN0ZXJzID0geyBsaXN0OiBbXSB9O1xyXG4gICAgdGhpcy5oYXNoZXMgPSBbXTtcclxuICAgIHRoaXMuY29tcGlsZVN0YWNrID0gW107XHJcbiAgICB0aGlzLmlubGluZVN0YWNrID0gW107XHJcbiAgICB0aGlzLmJsb2NrUGFyYW1zID0gW107XHJcblxyXG4gICAgdGhpcy5jb21waWxlQ2hpbGRyZW4oZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMudXNlRGVwdGhzID1cclxuICAgICAgdGhpcy51c2VEZXB0aHMgfHxcclxuICAgICAgZW52aXJvbm1lbnQudXNlRGVwdGhzIHx8XHJcbiAgICAgIGVudmlyb25tZW50LnVzZURlY29yYXRvcnMgfHxcclxuICAgICAgdGhpcy5vcHRpb25zLmNvbXBhdDtcclxuICAgIHRoaXMudXNlQmxvY2tQYXJhbXMgPSB0aGlzLnVzZUJsb2NrUGFyYW1zIHx8IGVudmlyb25tZW50LnVzZUJsb2NrUGFyYW1zO1xyXG5cclxuICAgIGxldCBvcGNvZGVzID0gZW52aXJvbm1lbnQub3Bjb2RlcyxcclxuICAgICAgb3Bjb2RlLFxyXG4gICAgICBmaXJzdExvYyxcclxuICAgICAgaSxcclxuICAgICAgbDtcclxuXHJcbiAgICBmb3IgKGkgPSAwLCBsID0gb3Bjb2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1tpXTtcclxuXHJcbiAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRMb2NhdGlvbiA9IG9wY29kZS5sb2M7XHJcbiAgICAgIGZpcnN0TG9jID0gZmlyc3RMb2MgfHwgb3Bjb2RlLmxvYztcclxuICAgICAgdGhpc1tvcGNvZGUub3Bjb2RlXS5hcHBseSh0aGlzLCBvcGNvZGUuYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmx1c2ggYW55IHRyYWlsaW5nIGNvbnRlbnQgdGhhdCBtaWdodCBiZSBwZW5kaW5nLlxyXG4gICAgdGhpcy5zb3VyY2UuY3VycmVudExvY2F0aW9uID0gZmlyc3RMb2M7XHJcbiAgICB0aGlzLnB1c2hTb3VyY2UoJycpO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICBpZiAodGhpcy5zdGFja1Nsb3QgfHwgdGhpcy5pbmxpbmVTdGFjay5sZW5ndGggfHwgdGhpcy5jb21waWxlU3RhY2subGVuZ3RoKSB7XHJcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ0NvbXBpbGUgY29tcGxldGVkIHdpdGggY29udGVudCBsZWZ0IG9uIHN0YWNrJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLmRlY29yYXRvcnMuaXNFbXB0eSgpKSB7XHJcbiAgICAgIHRoaXMudXNlRGVjb3JhdG9ycyA9IHRydWU7XHJcblxyXG4gICAgICB0aGlzLmRlY29yYXRvcnMucHJlcGVuZChbXHJcbiAgICAgICAgJ3ZhciBkZWNvcmF0b3JzID0gY29udGFpbmVyLmRlY29yYXRvcnMsICcsXHJcbiAgICAgICAgdGhpcy5sb29rdXBQcm9wZXJ0eUZ1bmN0aW9uVmFyRGVjbGFyYXRpb24oKSxcclxuICAgICAgICAnO1xcbicsXHJcbiAgICAgIF0pO1xyXG4gICAgICB0aGlzLmRlY29yYXRvcnMucHVzaCgncmV0dXJuIGZuOycpO1xyXG5cclxuICAgICAgaWYgKGFzT2JqZWN0KSB7XHJcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLW5ldy1mdW5jXHJcbiAgICAgICAgdGhpcy5kZWNvcmF0b3JzID0gRnVuY3Rpb24uYXBwbHkodGhpcywgW1xyXG4gICAgICAgICAgJ2ZuJyxcclxuICAgICAgICAgICdwcm9wcycsXHJcbiAgICAgICAgICAnY29udGFpbmVyJyxcclxuICAgICAgICAgICdkZXB0aDAnLFxyXG4gICAgICAgICAgJ2RhdGEnLFxyXG4gICAgICAgICAgJ2Jsb2NrUGFyYW1zJyxcclxuICAgICAgICAgICdkZXB0aHMnLFxyXG4gICAgICAgICAgdGhpcy5kZWNvcmF0b3JzLm1lcmdlKCksXHJcbiAgICAgICAgXSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5kZWNvcmF0b3JzLnByZXBlbmQoXHJcbiAgICAgICAgICAnZnVuY3Rpb24oZm4sIHByb3BzLCBjb250YWluZXIsIGRlcHRoMCwgZGF0YSwgYmxvY2tQYXJhbXMsIGRlcHRocykge1xcbidcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuZGVjb3JhdG9ycy5wdXNoKCd9XFxuJyk7XHJcbiAgICAgICAgdGhpcy5kZWNvcmF0b3JzID0gdGhpcy5kZWNvcmF0b3JzLm1lcmdlKCk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuZGVjb3JhdG9ycyA9IHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgZm4gPSB0aGlzLmNyZWF0ZUZ1bmN0aW9uQ29udGV4dChhc09iamVjdCk7XHJcbiAgICBpZiAoIXRoaXMuaXNDaGlsZCkge1xyXG4gICAgICBsZXQgcmV0ID0ge1xyXG4gICAgICAgIGNvbXBpbGVyOiB0aGlzLmNvbXBpbGVySW5mbygpLFxyXG4gICAgICAgIG1haW46IGZuLFxyXG4gICAgICB9O1xyXG5cclxuICAgICAgaWYgKHRoaXMuZGVjb3JhdG9ycykge1xyXG4gICAgICAgIHJldC5tYWluX2QgPSB0aGlzLmRlY29yYXRvcnM7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgY2FtZWxjYXNlXHJcbiAgICAgICAgcmV0LnVzZURlY29yYXRvcnMgPSB0cnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsZXQgeyBwcm9ncmFtcywgZGVjb3JhdG9ycyB9ID0gdGhpcy5jb250ZXh0O1xyXG4gICAgICBmb3IgKGkgPSAwLCBsID0gcHJvZ3JhbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKHByb2dyYW1zW2ldKSB7XHJcbiAgICAgICAgICByZXRbaV0gPSBwcm9ncmFtc1tpXTtcclxuICAgICAgICAgIGlmIChkZWNvcmF0b3JzW2ldKSB7XHJcbiAgICAgICAgICAgIHJldFtpICsgJ19kJ10gPSBkZWNvcmF0b3JzW2ldO1xyXG4gICAgICAgICAgICByZXQudXNlRGVjb3JhdG9ycyA9IHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5lbnZpcm9ubWVudC51c2VQYXJ0aWFsKSB7XHJcbiAgICAgICAgcmV0LnVzZVBhcnRpYWwgPSB0cnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZGF0YSkge1xyXG4gICAgICAgIHJldC51c2VEYXRhID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodGhpcy51c2VEZXB0aHMpIHtcclxuICAgICAgICByZXQudXNlRGVwdGhzID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodGhpcy51c2VCbG9ja1BhcmFtcykge1xyXG4gICAgICAgIHJldC51c2VCbG9ja1BhcmFtcyA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5jb21wYXQpIHtcclxuICAgICAgICByZXQuY29tcGF0ID0gdHJ1ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCFhc09iamVjdCkge1xyXG4gICAgICAgIHJldC5jb21waWxlciA9IEpTT04uc3RyaW5naWZ5KHJldC5jb21waWxlcik7XHJcblxyXG4gICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRMb2NhdGlvbiA9IHsgc3RhcnQ6IHsgbGluZTogMSwgY29sdW1uOiAwIH0gfTtcclxuICAgICAgICByZXQgPSB0aGlzLm9iamVjdExpdGVyYWwocmV0KTtcclxuXHJcbiAgICAgICAgaWYgKG9wdGlvbnMuc3JjTmFtZSkge1xyXG4gICAgICAgICAgcmV0ID0gcmV0LnRvU3RyaW5nV2l0aFNvdXJjZU1hcCh7IGZpbGU6IG9wdGlvbnMuZGVzdE5hbWUgfSk7XHJcbiAgICAgICAgICByZXQubWFwID0gcmV0Lm1hcCAmJiByZXQubWFwLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldCA9IHJldC50b1N0cmluZygpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXQuY29tcGlsZXJPcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gcmV0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIGZuO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIHByZWFtYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAvLyB0cmFjayB0aGUgbGFzdCBjb250ZXh0IHB1c2hlZCBpbnRvIHBsYWNlIHRvIGFsbG93IHNraXBwaW5nIHRoZVxyXG4gICAgLy8gZ2V0Q29udGV4dCBvcGNvZGUgd2hlbiBpdCB3b3VsZCBiZSBhIG5vb3BcclxuICAgIHRoaXMubGFzdENvbnRleHQgPSAwO1xyXG4gICAgdGhpcy5zb3VyY2UgPSBuZXcgQ29kZUdlbih0aGlzLm9wdGlvbnMuc3JjTmFtZSk7XHJcbiAgICB0aGlzLmRlY29yYXRvcnMgPSBuZXcgQ29kZUdlbih0aGlzLm9wdGlvbnMuc3JjTmFtZSk7XHJcbiAgfSxcclxuXHJcbiAgY3JlYXRlRnVuY3Rpb25Db250ZXh0OiBmdW5jdGlvbiAoYXNPYmplY3QpIHtcclxuICAgIGxldCB2YXJEZWNsYXJhdGlvbnMgPSAnJztcclxuXHJcbiAgICBsZXQgbG9jYWxzID0gdGhpcy5zdGFja1ZhcnMuY29uY2F0KHRoaXMucmVnaXN0ZXJzLmxpc3QpO1xyXG4gICAgaWYgKGxvY2Fscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHZhckRlY2xhcmF0aW9ucyArPSAnLCAnICsgbG9jYWxzLmpvaW4oJywgJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2VuZXJhdGUgbWluaW1pemVyIGFsaWFzIG1hcHBpbmdzXHJcbiAgICAvL1xyXG4gICAgLy8gV2hlbiB1c2luZyB0cnVlIFNvdXJjZU5vZGVzLCB0aGlzIHdpbGwgdXBkYXRlIGFsbCByZWZlcmVuY2VzIHRvIHRoZSBnaXZlbiBhbGlhc1xyXG4gICAgLy8gYXMgdGhlIHNvdXJjZSBub2RlcyBhcmUgcmV1c2VkIGluIHNpdHUuIEZvciB0aGUgbm9uLXNvdXJjZSBub2RlIGNvbXBpbGF0aW9uIG1vZGUsXHJcbiAgICAvLyBhbGlhc2VzIHdpbGwgbm90IGJlIHVzZWQsIGJ1dCB0aGlzIGNhc2UgaXMgYWxyZWFkeSBiZWluZyBydW4gb24gdGhlIGNsaWVudCBhbmRcclxuICAgIC8vIHdlIGFyZW4ndCBjb25jZXJuIGFib3V0IG1pbmltaXppbmcgdGhlIHRlbXBsYXRlIHNpemUuXHJcbiAgICBsZXQgYWxpYXNDb3VudCA9IDA7XHJcbiAgICBPYmplY3Qua2V5cyh0aGlzLmFsaWFzZXMpLmZvckVhY2goKGFsaWFzKSA9PiB7XHJcbiAgICAgIGxldCBub2RlID0gdGhpcy5hbGlhc2VzW2FsaWFzXTtcclxuICAgICAgaWYgKG5vZGUuY2hpbGRyZW4gJiYgbm9kZS5yZWZlcmVuY2VDb3VudCA+IDEpIHtcclxuICAgICAgICB2YXJEZWNsYXJhdGlvbnMgKz0gJywgYWxpYXMnICsgKythbGlhc0NvdW50ICsgJz0nICsgYWxpYXM7XHJcbiAgICAgICAgbm9kZS5jaGlsZHJlblswXSA9ICdhbGlhcycgKyBhbGlhc0NvdW50O1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAodGhpcy5sb29rdXBQcm9wZXJ0eUZ1bmN0aW9uSXNVc2VkKSB7XHJcbiAgICAgIHZhckRlY2xhcmF0aW9ucyArPSAnLCAnICsgdGhpcy5sb29rdXBQcm9wZXJ0eUZ1bmN0aW9uVmFyRGVjbGFyYXRpb24oKTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcGFyYW1zID0gWydjb250YWluZXInLCAnZGVwdGgwJywgJ2hlbHBlcnMnLCAncGFydGlhbHMnLCAnZGF0YSddO1xyXG5cclxuICAgIGlmICh0aGlzLnVzZUJsb2NrUGFyYW1zIHx8IHRoaXMudXNlRGVwdGhzKSB7XHJcbiAgICAgIHBhcmFtcy5wdXNoKCdibG9ja1BhcmFtcycpO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMudXNlRGVwdGhzKSB7XHJcbiAgICAgIHBhcmFtcy5wdXNoKCdkZXB0aHMnKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBQZXJmb3JtIGEgc2Vjb25kIHBhc3Mgb3ZlciB0aGUgb3V0cHV0IHRvIG1lcmdlIGNvbnRlbnQgd2hlbiBwb3NzaWJsZVxyXG4gICAgbGV0IHNvdXJjZSA9IHRoaXMubWVyZ2VTb3VyY2UodmFyRGVjbGFyYXRpb25zKTtcclxuXHJcbiAgICBpZiAoYXNPYmplY3QpIHtcclxuICAgICAgcGFyYW1zLnB1c2goc291cmNlKTtcclxuXHJcbiAgICAgIHJldHVybiBGdW5jdGlvbi5hcHBseSh0aGlzLCBwYXJhbXMpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5zb3VyY2Uud3JhcChbXHJcbiAgICAgICAgJ2Z1bmN0aW9uKCcsXHJcbiAgICAgICAgcGFyYW1zLmpvaW4oJywnKSxcclxuICAgICAgICAnKSB7XFxuICAnLFxyXG4gICAgICAgIHNvdXJjZSxcclxuICAgICAgICAnfScsXHJcbiAgICAgIF0pO1xyXG4gICAgfVxyXG4gIH0sXHJcbiAgbWVyZ2VTb3VyY2U6IGZ1bmN0aW9uICh2YXJEZWNsYXJhdGlvbnMpIHtcclxuICAgIGxldCBpc1NpbXBsZSA9IHRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUsXHJcbiAgICAgIGFwcGVuZE9ubHkgPSAhdGhpcy5mb3JjZUJ1ZmZlcixcclxuICAgICAgYXBwZW5kRmlyc3QsXHJcbiAgICAgIHNvdXJjZVNlZW4sXHJcbiAgICAgIGJ1ZmZlclN0YXJ0LFxyXG4gICAgICBidWZmZXJFbmQ7XHJcbiAgICB0aGlzLnNvdXJjZS5lYWNoKChsaW5lKSA9PiB7XHJcbiAgICAgIGlmIChsaW5lLmFwcGVuZFRvQnVmZmVyKSB7XHJcbiAgICAgICAgaWYgKGJ1ZmZlclN0YXJ0KSB7XHJcbiAgICAgICAgICBsaW5lLnByZXBlbmQoJyAgKyAnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYnVmZmVyU3RhcnQgPSBsaW5lO1xyXG4gICAgICAgIH1cclxuICAgICAgICBidWZmZXJFbmQgPSBsaW5lO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChidWZmZXJTdGFydCkge1xyXG4gICAgICAgICAgaWYgKCFzb3VyY2VTZWVuKSB7XHJcbiAgICAgICAgICAgIGFwcGVuZEZpcnN0ID0gdHJ1ZTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJ1ZmZlclN0YXJ0LnByZXBlbmQoJ2J1ZmZlciArPSAnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJ1ZmZlckVuZC5hZGQoJzsnKTtcclxuICAgICAgICAgIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc291cmNlU2VlbiA9IHRydWU7XHJcbiAgICAgICAgaWYgKCFpc1NpbXBsZSkge1xyXG4gICAgICAgICAgYXBwZW5kT25seSA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKGFwcGVuZE9ubHkpIHtcclxuICAgICAgaWYgKGJ1ZmZlclN0YXJ0KSB7XHJcbiAgICAgICAgYnVmZmVyU3RhcnQucHJlcGVuZCgncmV0dXJuICcpO1xyXG4gICAgICAgIGJ1ZmZlckVuZC5hZGQoJzsnKTtcclxuICAgICAgfSBlbHNlIGlmICghc291cmNlU2Vlbikge1xyXG4gICAgICAgIHRoaXMuc291cmNlLnB1c2goJ3JldHVybiBcIlwiOycpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB2YXJEZWNsYXJhdGlvbnMgKz1cclxuICAgICAgICAnLCBidWZmZXIgPSAnICsgKGFwcGVuZEZpcnN0ID8gJycgOiB0aGlzLmluaXRpYWxpemVCdWZmZXIoKSk7XHJcblxyXG4gICAgICBpZiAoYnVmZmVyU3RhcnQpIHtcclxuICAgICAgICBidWZmZXJTdGFydC5wcmVwZW5kKCdyZXR1cm4gYnVmZmVyICsgJyk7XHJcbiAgICAgICAgYnVmZmVyRW5kLmFkZCgnOycpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuc291cmNlLnB1c2goJ3JldHVybiBidWZmZXI7Jyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAodmFyRGVjbGFyYXRpb25zKSB7XHJcbiAgICAgIHRoaXMuc291cmNlLnByZXBlbmQoXHJcbiAgICAgICAgJ3ZhciAnICsgdmFyRGVjbGFyYXRpb25zLnN1YnN0cmluZygyKSArIChhcHBlbmRGaXJzdCA/ICcnIDogJztcXG4nKVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzLnNvdXJjZS5tZXJnZSgpO1xyXG4gIH0sXHJcblxyXG4gIGxvb2t1cFByb3BlcnR5RnVuY3Rpb25WYXJEZWNsYXJhdGlvbjogZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIGBcclxuICAgICAgbG9va3VwUHJvcGVydHkgPSBjb250YWluZXIubG9va3VwUHJvcGVydHkgfHwgZnVuY3Rpb24ocGFyZW50LCBwcm9wZXJ0eU5hbWUpIHtcclxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHBhcmVudCwgcHJvcGVydHlOYW1lKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHBhcmVudFtwcm9wZXJ0eU5hbWVdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkXHJcbiAgICB9XHJcbiAgICBgLnRyaW0oKTtcclxuICB9LFxyXG5cclxuICAvLyBbYmxvY2tWYWx1ZV1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHZhbHVlXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXR1cm4gdmFsdWUgb2YgYmxvY2tIZWxwZXJNaXNzaW5nXHJcbiAgLy9cclxuICAvLyBUaGUgcHVycG9zZSBvZiB0aGlzIG9wY29kZSBpcyB0byB0YWtlIGEgYmxvY2sgb2YgdGhlIGZvcm1cclxuICAvLyBge3sjdGhpcy5mb299fS4uLnt7L3RoaXMuZm9vfX1gLCByZXNvbHZlIHRoZSB2YWx1ZSBvZiBgZm9vYCwgYW5kXHJcbiAgLy8gcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgd2l0aCB0aGUgcmVzdWx0IG9mIHByb3Blcmx5XHJcbiAgLy8gaW52b2tpbmcgYmxvY2tIZWxwZXJNaXNzaW5nLlxyXG4gIGJsb2NrVmFsdWU6IGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICBsZXQgYmxvY2tIZWxwZXJNaXNzaW5nID0gdGhpcy5hbGlhc2FibGUoXHJcbiAgICAgICAgJ2NvbnRhaW5lci5ob29rcy5ibG9ja0hlbHBlck1pc3NpbmcnXHJcbiAgICAgICksXHJcbiAgICAgIHBhcmFtcyA9IFt0aGlzLmNvbnRleHROYW1lKDApXTtcclxuICAgIHRoaXMuc2V0dXBIZWxwZXJBcmdzKG5hbWUsIDAsIHBhcmFtcyk7XHJcblxyXG4gICAgbGV0IGJsb2NrTmFtZSA9IHRoaXMucG9wU3RhY2soKTtcclxuICAgIHBhcmFtcy5zcGxpY2UoMSwgMCwgYmxvY2tOYW1lKTtcclxuXHJcbiAgICB0aGlzLnB1c2godGhpcy5zb3VyY2UuZnVuY3Rpb25DYWxsKGJsb2NrSGVscGVyTWlzc2luZywgJ2NhbGwnLCBwYXJhbXMpKTtcclxuICB9LFxyXG5cclxuICAvLyBbYW1iaWd1b3VzQmxvY2tWYWx1ZV1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHZhbHVlXHJcbiAgLy8gQ29tcGlsZXIgdmFsdWUsIGJlZm9yZTogbGFzdEhlbHBlcj12YWx1ZSBvZiBsYXN0IGZvdW5kIGhlbHBlciwgaWYgYW55XHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyLCBpZiBubyBsYXN0SGVscGVyOiBzYW1lIGFzIFtibG9ja1ZhbHVlXVxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlciwgaWYgbGFzdEhlbHBlcjogdmFsdWVcclxuICBhbWJpZ3VvdXNCbG9ja1ZhbHVlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAvLyBXZSdyZSBiZWluZyBhIGJpdCBjaGVla3kgYW5kIHJldXNpbmcgdGhlIG9wdGlvbnMgdmFsdWUgZnJvbSB0aGUgcHJpb3IgZXhlY1xyXG4gICAgbGV0IGJsb2NrSGVscGVyTWlzc2luZyA9IHRoaXMuYWxpYXNhYmxlKFxyXG4gICAgICAgICdjb250YWluZXIuaG9va3MuYmxvY2tIZWxwZXJNaXNzaW5nJ1xyXG4gICAgICApLFxyXG4gICAgICBwYXJhbXMgPSBbdGhpcy5jb250ZXh0TmFtZSgwKV07XHJcbiAgICB0aGlzLnNldHVwSGVscGVyQXJncygnJywgMCwgcGFyYW1zLCB0cnVlKTtcclxuXHJcbiAgICB0aGlzLmZsdXNoSW5saW5lKCk7XHJcblxyXG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLnRvcFN0YWNrKCk7XHJcbiAgICBwYXJhbXMuc3BsaWNlKDEsIDAsIGN1cnJlbnQpO1xyXG5cclxuICAgIHRoaXMucHVzaFNvdXJjZShbXHJcbiAgICAgICdpZiAoIScsXHJcbiAgICAgIHRoaXMubGFzdEhlbHBlcixcclxuICAgICAgJykgeyAnLFxyXG4gICAgICBjdXJyZW50LFxyXG4gICAgICAnID0gJyxcclxuICAgICAgdGhpcy5zb3VyY2UuZnVuY3Rpb25DYWxsKGJsb2NrSGVscGVyTWlzc2luZywgJ2NhbGwnLCBwYXJhbXMpLFxyXG4gICAgICAnfScsXHJcbiAgICBdKTtcclxuICB9LFxyXG5cclxuICAvLyBbYXBwZW5kQ29udGVudF1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXHJcbiAgLy9cclxuICAvLyBBcHBlbmRzIHRoZSBzdHJpbmcgdmFsdWUgb2YgYGNvbnRlbnRgIHRvIHRoZSBjdXJyZW50IGJ1ZmZlclxyXG4gIGFwcGVuZENvbnRlbnQ6IGZ1bmN0aW9uIChjb250ZW50KSB7XHJcbiAgICBpZiAodGhpcy5wZW5kaW5nQ29udGVudCkge1xyXG4gICAgICBjb250ZW50ID0gdGhpcy5wZW5kaW5nQ29udGVudCArIGNvbnRlbnQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnBlbmRpbmdMb2NhdGlvbiA9IHRoaXMuc291cmNlLmN1cnJlbnRMb2NhdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnBlbmRpbmdDb250ZW50ID0gY29udGVudDtcclxuICB9LFxyXG5cclxuICAvLyBbYXBwZW5kXVxyXG4gIC8vXHJcbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXHJcbiAgLy9cclxuICAvLyBDb2VyY2VzIGB2YWx1ZWAgdG8gYSBTdHJpbmcgYW5kIGFwcGVuZHMgaXQgdG8gdGhlIGN1cnJlbnQgYnVmZmVyLlxyXG4gIC8vXHJcbiAgLy8gSWYgYHZhbHVlYCBpcyB0cnV0aHksIG9yIDAsIGl0IGlzIGNvZXJjZWQgaW50byBhIHN0cmluZyBhbmQgYXBwZW5kZWRcclxuICAvLyBPdGhlcndpc2UsIHRoZSBlbXB0eSBzdHJpbmcgaXMgYXBwZW5kZWRcclxuICBhcHBlbmQ6IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLmlzSW5saW5lKCkpIHtcclxuICAgICAgdGhpcy5yZXBsYWNlU3RhY2soKGN1cnJlbnQpID0+IFsnICE9IG51bGwgPyAnLCBjdXJyZW50LCAnIDogXCJcIiddKTtcclxuXHJcbiAgICAgIHRoaXMucHVzaFNvdXJjZSh0aGlzLmFwcGVuZFRvQnVmZmVyKHRoaXMucG9wU3RhY2soKSkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbGV0IGxvY2FsID0gdGhpcy5wb3BTdGFjaygpO1xyXG4gICAgICB0aGlzLnB1c2hTb3VyY2UoW1xyXG4gICAgICAgICdpZiAoJyxcclxuICAgICAgICBsb2NhbCxcclxuICAgICAgICAnICE9IG51bGwpIHsgJyxcclxuICAgICAgICB0aGlzLmFwcGVuZFRvQnVmZmVyKGxvY2FsLCB1bmRlZmluZWQsIHRydWUpLFxyXG4gICAgICAgICcgfScsXHJcbiAgICAgIF0pO1xyXG4gICAgICBpZiAodGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xyXG4gICAgICAgIHRoaXMucHVzaFNvdXJjZShbXHJcbiAgICAgICAgICAnZWxzZSB7ICcsXHJcbiAgICAgICAgICB0aGlzLmFwcGVuZFRvQnVmZmVyKFwiJydcIiwgdW5kZWZpbmVkLCB0cnVlKSxcclxuICAgICAgICAgICcgfScsXHJcbiAgICAgICAgXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyBbYXBwZW5kRXNjYXBlZF1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi5cclxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxyXG4gIC8vXHJcbiAgLy8gRXNjYXBlIGB2YWx1ZWAgYW5kIGFwcGVuZCBpdCB0byB0aGUgYnVmZmVyXHJcbiAgYXBwZW5kRXNjYXBlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5wdXNoU291cmNlKFxyXG4gICAgICB0aGlzLmFwcGVuZFRvQnVmZmVyKFtcclxuICAgICAgICB0aGlzLmFsaWFzYWJsZSgnY29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb24nKSxcclxuICAgICAgICAnKCcsXHJcbiAgICAgICAgdGhpcy5wb3BTdGFjaygpLFxyXG4gICAgICAgICcpJyxcclxuICAgICAgXSlcclxuICAgICk7XHJcbiAgfSxcclxuXHJcbiAgLy8gW2dldENvbnRleHRdXHJcbiAgLy9cclxuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cclxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxyXG4gIC8vIENvbXBpbGVyIHZhbHVlLCBhZnRlcjogbGFzdENvbnRleHQ9ZGVwdGhcclxuICAvL1xyXG4gIC8vIFNldCB0aGUgdmFsdWUgb2YgdGhlIGBsYXN0Q29udGV4dGAgY29tcGlsZXIgdmFsdWUgdG8gdGhlIGRlcHRoXHJcbiAgZ2V0Q29udGV4dDogZnVuY3Rpb24gKGRlcHRoKSB7XHJcbiAgICB0aGlzLmxhc3RDb250ZXh0ID0gZGVwdGg7XHJcbiAgfSxcclxuXHJcbiAgLy8gW3B1c2hDb250ZXh0XVxyXG4gIC8vXHJcbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dCwgLi4uXHJcbiAgLy9cclxuICAvLyBQdXNoZXMgdGhlIHZhbHVlIG9mIHRoZSBjdXJyZW50IGNvbnRleHQgb250byB0aGUgc3RhY2suXHJcbiAgcHVzaENvbnRleHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLmNvbnRleHROYW1lKHRoaXMubGFzdENvbnRleHQpKTtcclxuICB9LFxyXG5cclxuICAvLyBbbG9va3VwT25Db250ZXh0XVxyXG4gIC8vXHJcbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dFtuYW1lXSwgLi4uXHJcbiAgLy9cclxuICAvLyBMb29rcyB1cCB0aGUgdmFsdWUgb2YgYG5hbWVgIG9uIHRoZSBjdXJyZW50IGNvbnRleHQgYW5kIHB1c2hlc1xyXG4gIC8vIGl0IG9udG8gdGhlIHN0YWNrLlxyXG4gIGxvb2t1cE9uQ29udGV4dDogZnVuY3Rpb24gKHBhcnRzLCBmYWxzeSwgc3RyaWN0LCBzY29wZWQpIHtcclxuICAgIGxldCBpID0gMDtcclxuXHJcbiAgICBpZiAoIXNjb3BlZCAmJiB0aGlzLm9wdGlvbnMuY29tcGF0ICYmICF0aGlzLmxhc3RDb250ZXh0KSB7XHJcbiAgICAgIC8vIFRoZSBkZXB0aGVkIHF1ZXJ5IGlzIGV4cGVjdGVkIHRvIGhhbmRsZSB0aGUgdW5kZWZpbmVkIGxvZ2ljIGZvciB0aGUgcm9vdCBsZXZlbCB0aGF0XHJcbiAgICAgIC8vIGlzIGltcGxlbWVudGVkIGJlbG93LCBzbyB3ZSBldmFsdWF0ZSB0aGF0IGRpcmVjdGx5IGluIGNvbXBhdCBtb2RlXHJcbiAgICAgIHRoaXMucHVzaCh0aGlzLmRlcHRoZWRMb29rdXAocGFydHNbaSsrXSkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5wdXNoQ29udGV4dCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVzb2x2ZVBhdGgoJ2NvbnRleHQnLCBwYXJ0cywgaSwgZmFsc3ksIHN0cmljdCk7XHJcbiAgfSxcclxuXHJcbiAgLy8gW2xvb2t1cEJsb2NrUGFyYW1dXHJcbiAgLy9cclxuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cclxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGJsb2NrUGFyYW1bbmFtZV0sIC4uLlxyXG4gIC8vXHJcbiAgLy8gTG9va3MgdXAgdGhlIHZhbHVlIG9mIGBwYXJ0c2Agb24gdGhlIGdpdmVuIGJsb2NrIHBhcmFtIGFuZCBwdXNoZXNcclxuICAvLyBpdCBvbnRvIHRoZSBzdGFjay5cclxuICBsb29rdXBCbG9ja1BhcmFtOiBmdW5jdGlvbiAoYmxvY2tQYXJhbUlkLCBwYXJ0cykge1xyXG4gICAgdGhpcy51c2VCbG9ja1BhcmFtcyA9IHRydWU7XHJcblxyXG4gICAgdGhpcy5wdXNoKFsnYmxvY2tQYXJhbXNbJywgYmxvY2tQYXJhbUlkWzBdLCAnXVsnLCBibG9ja1BhcmFtSWRbMV0sICddJ10pO1xyXG4gICAgdGhpcy5yZXNvbHZlUGF0aCgnY29udGV4dCcsIHBhcnRzLCAxKTtcclxuICB9LFxyXG5cclxuICAvLyBbbG9va3VwRGF0YV1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogZGF0YSwgLi4uXHJcbiAgLy9cclxuICAvLyBQdXNoIHRoZSBkYXRhIGxvb2t1cCBvcGVyYXRvclxyXG4gIGxvb2t1cERhdGE6IGZ1bmN0aW9uIChkZXB0aCwgcGFydHMsIHN0cmljdCkge1xyXG4gICAgaWYgKCFkZXB0aCkge1xyXG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ2RhdGEnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgnY29udGFpbmVyLmRhdGEoZGF0YSwgJyArIGRlcHRoICsgJyknKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnJlc29sdmVQYXRoKCdkYXRhJywgcGFydHMsIDAsIHRydWUsIHN0cmljdCk7XHJcbiAgfSxcclxuXHJcbiAgcmVzb2x2ZVBhdGg6IGZ1bmN0aW9uICh0eXBlLCBwYXJ0cywgaSwgZmFsc3ksIHN0cmljdCkge1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpY3QgfHwgdGhpcy5vcHRpb25zLmFzc3VtZU9iamVjdHMpIHtcclxuICAgICAgdGhpcy5wdXNoKFxyXG4gICAgICAgIHN0cmljdExvb2t1cCh0aGlzLm9wdGlvbnMuc3RyaWN0ICYmIHN0cmljdCwgdGhpcywgcGFydHMsIGksIHR5cGUpXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgbGVuID0gcGFydHMubGVuZ3RoO1xyXG4gICAgZm9yICg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1sb29wLWZ1bmMgKi9cclxuICAgICAgdGhpcy5yZXBsYWNlU3RhY2soKGN1cnJlbnQpID0+IHtcclxuICAgICAgICBsZXQgbG9va3VwID0gdGhpcy5uYW1lTG9va3VwKGN1cnJlbnQsIHBhcnRzW2ldLCB0eXBlKTtcclxuICAgICAgICAvLyBXZSB3YW50IHRvIGVuc3VyZSB0aGF0IHplcm8gYW5kIGZhbHNlIGFyZSBoYW5kbGVkIHByb3Blcmx5IGlmIHRoZSBjb250ZXh0IChmYWxzeSBmbGFnKVxyXG4gICAgICAgIC8vIG5lZWRzIHRvIGhhdmUgdGhlIHNwZWNpYWwgaGFuZGxpbmcgZm9yIHRoZXNlIHZhbHVlcy5cclxuICAgICAgICBpZiAoIWZhbHN5KSB7XHJcbiAgICAgICAgICByZXR1cm4gWycgIT0gbnVsbCA/ICcsIGxvb2t1cCwgJyA6ICcsIGN1cnJlbnRdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBPdGhlcndpc2Ugd2UgY2FuIHVzZSBnZW5lcmljIGZhbHN5IGhhbmRsaW5nXHJcbiAgICAgICAgICByZXR1cm4gWycgJiYgJywgbG9va3VwXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWxvb3AtZnVuYyAqL1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8vIFtyZXNvbHZlUG9zc2libGVMYW1iZGFdXHJcbiAgLy9cclxuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXNvbHZlZCB2YWx1ZSwgLi4uXHJcbiAgLy9cclxuICAvLyBJZiB0aGUgYHZhbHVlYCBpcyBhIGxhbWJkYSwgcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgYnlcclxuICAvLyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBsYW1iZGFcclxuICByZXNvbHZlUG9zc2libGVMYW1iZGE6IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMucHVzaChbXHJcbiAgICAgIHRoaXMuYWxpYXNhYmxlKCdjb250YWluZXIubGFtYmRhJyksXHJcbiAgICAgICcoJyxcclxuICAgICAgdGhpcy5wb3BTdGFjaygpLFxyXG4gICAgICAnLCAnLFxyXG4gICAgICB0aGlzLmNvbnRleHROYW1lKDApLFxyXG4gICAgICAnKScsXHJcbiAgICBdKTtcclxuICB9LFxyXG5cclxuICBlbXB0eUhhc2g6IGZ1bmN0aW9uIChvbWl0RW1wdHkpIHtcclxuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbChvbWl0RW1wdHkgPyAndW5kZWZpbmVkJyA6ICd7fScpO1xyXG4gIH0sXHJcbiAgcHVzaEhhc2g6IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLmhhc2gpIHtcclxuICAgICAgdGhpcy5oYXNoZXMucHVzaCh0aGlzLmhhc2gpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5oYXNoID0geyB2YWx1ZXM6IHt9IH07XHJcbiAgfSxcclxuICBwb3BIYXNoOiBmdW5jdGlvbiAoKSB7XHJcbiAgICBsZXQgaGFzaCA9IHRoaXMuaGFzaDtcclxuICAgIHRoaXMuaGFzaCA9IHRoaXMuaGFzaGVzLnBvcCgpO1xyXG5cclxuICAgIHRoaXMucHVzaCh0aGlzLm9iamVjdExpdGVyYWwoaGFzaC52YWx1ZXMpKTtcclxuICB9LFxyXG5cclxuICAvLyBbcHVzaFN0cmluZ11cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcXVvdGVkU3RyaW5nKHN0cmluZyksIC4uLlxyXG4gIC8vXHJcbiAgLy8gUHVzaCBhIHF1b3RlZCB2ZXJzaW9uIG9mIGBzdHJpbmdgIG9udG8gdGhlIHN0YWNrXHJcbiAgcHVzaFN0cmluZzogZnVuY3Rpb24gKHN0cmluZykge1xyXG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHRoaXMucXVvdGVkU3RyaW5nKHN0cmluZykpO1xyXG4gIH0sXHJcblxyXG4gIC8vIFtwdXNoTGl0ZXJhbF1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogdmFsdWUsIC4uLlxyXG4gIC8vXHJcbiAgLy8gUHVzaGVzIGEgdmFsdWUgb250byB0aGUgc3RhY2suIFRoaXMgb3BlcmF0aW9uIHByZXZlbnRzXHJcbiAgLy8gdGhlIGNvbXBpbGVyIGZyb20gY3JlYXRpbmcgYSB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gaG9sZFxyXG4gIC8vIGl0LlxyXG4gIHB1c2hMaXRlcmFsOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh2YWx1ZSk7XHJcbiAgfSxcclxuXHJcbiAgLy8gW3B1c2hQcm9ncmFtXVxyXG4gIC8vXHJcbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBwcm9ncmFtKGd1aWQpLCAuLi5cclxuICAvL1xyXG4gIC8vIFB1c2ggYSBwcm9ncmFtIGV4cHJlc3Npb24gb250byB0aGUgc3RhY2suIFRoaXMgdGFrZXNcclxuICAvLyBhIGNvbXBpbGUtdGltZSBndWlkIGFuZCBjb252ZXJ0cyBpdCBpbnRvIGEgcnVudGltZS1hY2Nlc3NpYmxlXHJcbiAgLy8gZXhwcmVzc2lvbi5cclxuICBwdXNoUHJvZ3JhbTogZnVuY3Rpb24gKGd1aWQpIHtcclxuICAgIGlmIChndWlkICE9IG51bGwpIHtcclxuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHRoaXMucHJvZ3JhbUV4cHJlc3Npb24oZ3VpZCkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKG51bGwpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8vIFtyZWdpc3RlckRlY29yYXRvcl1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cclxuICAvL1xyXG4gIC8vIFBvcHMgb2ZmIHRoZSBkZWNvcmF0b3IncyBwYXJhbWV0ZXJzLCBpbnZva2VzIHRoZSBkZWNvcmF0b3IsXHJcbiAgLy8gYW5kIGluc2VydHMgdGhlIGRlY29yYXRvciBpbnRvIHRoZSBkZWNvcmF0b3JzIGxpc3QuXHJcbiAgcmVnaXN0ZXJEZWNvcmF0b3IocGFyYW1TaXplLCBuYW1lKSB7XHJcbiAgICBsZXQgZm91bmREZWNvcmF0b3IgPSB0aGlzLm5hbWVMb29rdXAoJ2RlY29yYXRvcnMnLCBuYW1lLCAnZGVjb3JhdG9yJyksXHJcbiAgICAgIG9wdGlvbnMgPSB0aGlzLnNldHVwSGVscGVyQXJncyhuYW1lLCBwYXJhbVNpemUpO1xyXG5cclxuICAgIHRoaXMuZGVjb3JhdG9ycy5wdXNoKFtcclxuICAgICAgJ2ZuID0gJyxcclxuICAgICAgdGhpcy5kZWNvcmF0b3JzLmZ1bmN0aW9uQ2FsbChmb3VuZERlY29yYXRvciwgJycsIFtcclxuICAgICAgICAnZm4nLFxyXG4gICAgICAgICdwcm9wcycsXHJcbiAgICAgICAgJ2NvbnRhaW5lcicsXHJcbiAgICAgICAgb3B0aW9ucyxcclxuICAgICAgXSksXHJcbiAgICAgICcgfHwgZm47JyxcclxuICAgIF0pO1xyXG4gIH0sXHJcblxyXG4gIC8vIFtpbnZva2VIZWxwZXJdXHJcbiAgLy9cclxuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzdWx0IG9mIGhlbHBlciBpbnZvY2F0aW9uXHJcbiAgLy9cclxuICAvLyBQb3BzIG9mZiB0aGUgaGVscGVyJ3MgcGFyYW1ldGVycywgaW52b2tlcyB0aGUgaGVscGVyLFxyXG4gIC8vIGFuZCBwdXNoZXMgdGhlIGhlbHBlcidzIHJldHVybiB2YWx1ZSBvbnRvIHRoZSBzdGFjay5cclxuICAvL1xyXG4gIC8vIElmIHRoZSBoZWxwZXIgaXMgbm90IGZvdW5kLCBgaGVscGVyTWlzc2luZ2AgaXMgY2FsbGVkLlxyXG4gIGludm9rZUhlbHBlcjogZnVuY3Rpb24gKHBhcmFtU2l6ZSwgbmFtZSwgaXNTaW1wbGUpIHtcclxuICAgIGxldCBub25IZWxwZXIgPSB0aGlzLnBvcFN0YWNrKCksXHJcbiAgICAgIGhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIocGFyYW1TaXplLCBuYW1lKTtcclxuXHJcbiAgICBsZXQgcG9zc2libGVGdW5jdGlvbkNhbGxzID0gW107XHJcblxyXG4gICAgaWYgKGlzU2ltcGxlKSB7XHJcbiAgICAgIC8vIGRpcmVjdCBjYWxsIHRvIGhlbHBlclxyXG4gICAgICBwb3NzaWJsZUZ1bmN0aW9uQ2FsbHMucHVzaChoZWxwZXIubmFtZSk7XHJcbiAgICB9XHJcbiAgICAvLyBjYWxsIGEgZnVuY3Rpb24gZnJvbSB0aGUgaW5wdXQgb2JqZWN0XHJcbiAgICBwb3NzaWJsZUZ1bmN0aW9uQ2FsbHMucHVzaChub25IZWxwZXIpO1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuc3RyaWN0KSB7XHJcbiAgICAgIHBvc3NpYmxlRnVuY3Rpb25DYWxscy5wdXNoKFxyXG4gICAgICAgIHRoaXMuYWxpYXNhYmxlKCdjb250YWluZXIuaG9va3MuaGVscGVyTWlzc2luZycpXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGZ1bmN0aW9uTG9va3VwQ29kZSA9IFtcclxuICAgICAgJygnLFxyXG4gICAgICB0aGlzLml0ZW1zU2VwYXJhdGVkQnkocG9zc2libGVGdW5jdGlvbkNhbGxzLCAnfHwnKSxcclxuICAgICAgJyknLFxyXG4gICAgXTtcclxuICAgIGxldCBmdW5jdGlvbkNhbGwgPSB0aGlzLnNvdXJjZS5mdW5jdGlvbkNhbGwoXHJcbiAgICAgIGZ1bmN0aW9uTG9va3VwQ29kZSxcclxuICAgICAgJ2NhbGwnLFxyXG4gICAgICBoZWxwZXIuY2FsbFBhcmFtc1xyXG4gICAgKTtcclxuICAgIHRoaXMucHVzaChmdW5jdGlvbkNhbGwpO1xyXG4gIH0sXHJcblxyXG4gIGl0ZW1zU2VwYXJhdGVkQnk6IGZ1bmN0aW9uIChpdGVtcywgc2VwYXJhdG9yKSB7XHJcbiAgICBsZXQgcmVzdWx0ID0gW107XHJcbiAgICByZXN1bHQucHVzaChpdGVtc1swXSk7XHJcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHJlc3VsdC5wdXNoKHNlcGFyYXRvciwgaXRlbXNbaV0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9LFxyXG4gIC8vIFtpbnZva2VLbm93bkhlbHBlcl1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXHJcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgaGVscGVyIGludm9jYXRpb25cclxuICAvL1xyXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGlzIHVzZWQgd2hlbiB0aGUgaGVscGVyIGlzIGtub3duIHRvIGV4aXN0LFxyXG4gIC8vIHNvIGEgYGhlbHBlck1pc3NpbmdgIGZhbGxiYWNrIGlzIG5vdCByZXF1aXJlZC5cclxuICBpbnZva2VLbm93bkhlbHBlcjogZnVuY3Rpb24gKHBhcmFtU2l6ZSwgbmFtZSkge1xyXG4gICAgbGV0IGhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIocGFyYW1TaXplLCBuYW1lKTtcclxuICAgIHRoaXMucHVzaCh0aGlzLnNvdXJjZS5mdW5jdGlvbkNhbGwoaGVscGVyLm5hbWUsICdjYWxsJywgaGVscGVyLmNhbGxQYXJhbXMpKTtcclxuICB9LFxyXG5cclxuICAvLyBbaW52b2tlQW1iaWd1b3VzXVxyXG4gIC8vXHJcbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cclxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBkaXNhbWJpZ3VhdGlvblxyXG4gIC8vXHJcbiAgLy8gVGhpcyBvcGVyYXRpb24gaXMgdXNlZCB3aGVuIGFuIGV4cHJlc3Npb24gbGlrZSBge3tmb299fWBcclxuICAvLyBpcyBwcm92aWRlZCwgYnV0IHdlIGRvbid0IGtub3cgYXQgY29tcGlsZS10aW1lIHdoZXRoZXIgaXRcclxuICAvLyBpcyBhIGhlbHBlciBvciBhIHBhdGguXHJcbiAgLy9cclxuICAvLyBUaGlzIG9wZXJhdGlvbiBlbWl0cyBtb3JlIGNvZGUgdGhhbiB0aGUgb3RoZXIgb3B0aW9ucyxcclxuICAvLyBhbmQgY2FuIGJlIGF2b2lkZWQgYnkgcGFzc2luZyB0aGUgYGtub3duSGVscGVyc2AgYW5kXHJcbiAgLy8gYGtub3duSGVscGVyc09ubHlgIGZsYWdzIGF0IGNvbXBpbGUtdGltZS5cclxuICBpbnZva2VBbWJpZ3VvdXM6IGZ1bmN0aW9uIChuYW1lLCBoZWxwZXJDYWxsKSB7XHJcbiAgICB0aGlzLnVzZVJlZ2lzdGVyKCdoZWxwZXInKTtcclxuXHJcbiAgICBsZXQgbm9uSGVscGVyID0gdGhpcy5wb3BTdGFjaygpO1xyXG5cclxuICAgIHRoaXMuZW1wdHlIYXNoKCk7XHJcbiAgICBsZXQgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcigwLCBuYW1lLCBoZWxwZXJDYWxsKTtcclxuXHJcbiAgICBsZXQgaGVscGVyTmFtZSA9ICh0aGlzLmxhc3RIZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoXHJcbiAgICAgICdoZWxwZXJzJyxcclxuICAgICAgbmFtZSxcclxuICAgICAgJ2hlbHBlcidcclxuICAgICkpO1xyXG5cclxuICAgIGxldCBsb29rdXAgPSBbJygnLCAnKGhlbHBlciA9ICcsIGhlbHBlck5hbWUsICcgfHwgJywgbm9uSGVscGVyLCAnKSddO1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuc3RyaWN0KSB7XHJcbiAgICAgIGxvb2t1cFswXSA9ICcoaGVscGVyID0gJztcclxuICAgICAgbG9va3VwLnB1c2goXHJcbiAgICAgICAgJyAhPSBudWxsID8gaGVscGVyIDogJyxcclxuICAgICAgICB0aGlzLmFsaWFzYWJsZSgnY29udGFpbmVyLmhvb2tzLmhlbHBlck1pc3NpbmcnKVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucHVzaChbXHJcbiAgICAgICcoJyxcclxuICAgICAgbG9va3VwLFxyXG4gICAgICBoZWxwZXIucGFyYW1zSW5pdCA/IFsnKSwoJywgaGVscGVyLnBhcmFtc0luaXRdIDogW10sXHJcbiAgICAgICcpLCcsXHJcbiAgICAgICcodHlwZW9mIGhlbHBlciA9PT0gJyxcclxuICAgICAgdGhpcy5hbGlhc2FibGUoJ1wiZnVuY3Rpb25cIicpLFxyXG4gICAgICAnID8gJyxcclxuICAgICAgdGhpcy5zb3VyY2UuZnVuY3Rpb25DYWxsKCdoZWxwZXInLCAnY2FsbCcsIGhlbHBlci5jYWxsUGFyYW1zKSxcclxuICAgICAgJyA6IGhlbHBlcikpJyxcclxuICAgIF0pO1xyXG4gIH0sXHJcblxyXG4gIC8vIFtpbnZva2VQYXJ0aWFsXVxyXG4gIC8vXHJcbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogY29udGV4dCwgLi4uXHJcbiAgLy8gT24gc3RhY2sgYWZ0ZXI6IHJlc3VsdCBvZiBwYXJ0aWFsIGludm9jYXRpb25cclxuICAvL1xyXG4gIC8vIFRoaXMgb3BlcmF0aW9uIHBvcHMgb2ZmIGEgY29udGV4dCwgaW52b2tlcyBhIHBhcnRpYWwgd2l0aCB0aGF0IGNvbnRleHQsXHJcbiAgLy8gYW5kIHB1c2hlcyB0aGUgcmVzdWx0IG9mIHRoZSBpbnZvY2F0aW9uIGJhY2suXHJcbiAgaW52b2tlUGFydGlhbDogZnVuY3Rpb24gKGlzRHluYW1pYywgbmFtZSwgaW5kZW50KSB7XHJcbiAgICBsZXQgcGFyYW1zID0gW10sXHJcbiAgICAgIG9wdGlvbnMgPSB0aGlzLnNldHVwUGFyYW1zKG5hbWUsIDEsIHBhcmFtcyk7XHJcblxyXG4gICAgaWYgKGlzRHluYW1pYykge1xyXG4gICAgICBuYW1lID0gdGhpcy5wb3BTdGFjaygpO1xyXG4gICAgICBkZWxldGUgb3B0aW9ucy5uYW1lO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChpbmRlbnQpIHtcclxuICAgICAgb3B0aW9ucy5pbmRlbnQgPSBKU09OLnN0cmluZ2lmeShpbmRlbnQpO1xyXG4gICAgfVxyXG4gICAgb3B0aW9ucy5oZWxwZXJzID0gJ2hlbHBlcnMnO1xyXG4gICAgb3B0aW9ucy5wYXJ0aWFscyA9ICdwYXJ0aWFscyc7XHJcbiAgICBvcHRpb25zLmRlY29yYXRvcnMgPSAnY29udGFpbmVyLmRlY29yYXRvcnMnO1xyXG5cclxuICAgIGlmICghaXNEeW5hbWljKSB7XHJcbiAgICAgIHBhcmFtcy51bnNoaWZ0KHRoaXMubmFtZUxvb2t1cCgncGFydGlhbHMnLCBuYW1lLCAncGFydGlhbCcpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHBhcmFtcy51bnNoaWZ0KG5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29tcGF0KSB7XHJcbiAgICAgIG9wdGlvbnMuZGVwdGhzID0gJ2RlcHRocyc7XHJcbiAgICB9XHJcbiAgICBvcHRpb25zID0gdGhpcy5vYmplY3RMaXRlcmFsKG9wdGlvbnMpO1xyXG4gICAgcGFyYW1zLnB1c2gob3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5wdXNoKHRoaXMuc291cmNlLmZ1bmN0aW9uQ2FsbCgnY29udGFpbmVyLmludm9rZVBhcnRpYWwnLCAnJywgcGFyYW1zKSk7XHJcbiAgfSxcclxuXHJcbiAgLy8gW2Fzc2lnblRvSGFzaF1cclxuICAvL1xyXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi4sIGhhc2gsIC4uLlxyXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uLCBoYXNoLCAuLi5cclxuICAvL1xyXG4gIC8vIFBvcHMgYSB2YWx1ZSBvZmYgdGhlIHN0YWNrIGFuZCBhc3NpZ25zIGl0IHRvIHRoZSBjdXJyZW50IGhhc2hcclxuICBhc3NpZ25Ub0hhc2g6IGZ1bmN0aW9uIChrZXkpIHtcclxuICAgIHRoaXMuaGFzaC52YWx1ZXNba2V5XSA9IHRoaXMucG9wU3RhY2soKTtcclxuICB9LFxyXG5cclxuICAvLyBIRUxQRVJTXHJcblxyXG4gIGNvbXBpbGVyOiBKYXZhU2NyaXB0Q29tcGlsZXIsXHJcblxyXG4gIGNvbXBpbGVDaGlsZHJlbjogZnVuY3Rpb24gKGVudmlyb25tZW50LCBvcHRpb25zKSB7XHJcbiAgICBsZXQgY2hpbGRyZW4gPSBlbnZpcm9ubWVudC5jaGlsZHJlbixcclxuICAgICAgY2hpbGQsXHJcbiAgICAgIGNvbXBpbGVyO1xyXG5cclxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XHJcbiAgICAgIGNvbXBpbGVyID0gbmV3IHRoaXMuY29tcGlsZXIoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXHJcblxyXG4gICAgICBsZXQgZXhpc3RpbmcgPSB0aGlzLm1hdGNoRXhpc3RpbmdQcm9ncmFtKGNoaWxkKTtcclxuXHJcbiAgICAgIGlmIChleGlzdGluZyA9PSBudWxsKSB7XHJcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zLnB1c2goJycpOyAvLyBQbGFjZWhvbGRlciB0byBwcmV2ZW50IG5hbWUgY29uZmxpY3RzIGZvciBuZXN0ZWQgY2hpbGRyZW5cclxuICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmNvbnRleHQucHJvZ3JhbXMubGVuZ3RoO1xyXG4gICAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXg7XHJcbiAgICAgICAgY2hpbGQubmFtZSA9ICdwcm9ncmFtJyArIGluZGV4O1xyXG4gICAgICAgIHRoaXMuY29udGV4dC5wcm9ncmFtc1tpbmRleF0gPSBjb21waWxlci5jb21waWxlKFxyXG4gICAgICAgICAgY2hpbGQsXHJcbiAgICAgICAgICBvcHRpb25zLFxyXG4gICAgICAgICAgdGhpcy5jb250ZXh0LFxyXG4gICAgICAgICAgIXRoaXMucHJlY29tcGlsZVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5jb250ZXh0LmRlY29yYXRvcnNbaW5kZXhdID0gY29tcGlsZXIuZGVjb3JhdG9ycztcclxuICAgICAgICB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzW2luZGV4XSA9IGNoaWxkO1xyXG5cclxuICAgICAgICB0aGlzLnVzZURlcHRocyA9IHRoaXMudXNlRGVwdGhzIHx8IGNvbXBpbGVyLnVzZURlcHRocztcclxuICAgICAgICB0aGlzLnVzZUJsb2NrUGFyYW1zID0gdGhpcy51c2VCbG9ja1BhcmFtcyB8fCBjb21waWxlci51c2VCbG9ja1BhcmFtcztcclxuICAgICAgICBjaGlsZC51c2VEZXB0aHMgPSB0aGlzLnVzZURlcHRocztcclxuICAgICAgICBjaGlsZC51c2VCbG9ja1BhcmFtcyA9IHRoaXMudXNlQmxvY2tQYXJhbXM7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY2hpbGQuaW5kZXggPSBleGlzdGluZy5pbmRleDtcclxuICAgICAgICBjaGlsZC5uYW1lID0gJ3Byb2dyYW0nICsgZXhpc3RpbmcuaW5kZXg7XHJcblxyXG4gICAgICAgIHRoaXMudXNlRGVwdGhzID0gdGhpcy51c2VEZXB0aHMgfHwgZXhpc3RpbmcudXNlRGVwdGhzO1xyXG4gICAgICAgIHRoaXMudXNlQmxvY2tQYXJhbXMgPSB0aGlzLnVzZUJsb2NrUGFyYW1zIHx8IGV4aXN0aW5nLnVzZUJsb2NrUGFyYW1zO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBtYXRjaEV4aXN0aW5nUHJvZ3JhbTogZnVuY3Rpb24gKGNoaWxkKSB7XHJcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5jb250ZXh0LmVudmlyb25tZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICBsZXQgZW52aXJvbm1lbnQgPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzW2ldO1xyXG4gICAgICBpZiAoZW52aXJvbm1lbnQgJiYgZW52aXJvbm1lbnQuZXF1YWxzKGNoaWxkKSkge1xyXG4gICAgICAgIHJldHVybiBlbnZpcm9ubWVudDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIHByb2dyYW1FeHByZXNzaW9uOiBmdW5jdGlvbiAoZ3VpZCkge1xyXG4gICAgbGV0IGNoaWxkID0gdGhpcy5lbnZpcm9ubWVudC5jaGlsZHJlbltndWlkXSxcclxuICAgICAgcHJvZ3JhbVBhcmFtcyA9IFtjaGlsZC5pbmRleCwgJ2RhdGEnLCBjaGlsZC5ibG9ja1BhcmFtc107XHJcblxyXG4gICAgaWYgKHRoaXMudXNlQmxvY2tQYXJhbXMgfHwgdGhpcy51c2VEZXB0aHMpIHtcclxuICAgICAgcHJvZ3JhbVBhcmFtcy5wdXNoKCdibG9ja1BhcmFtcycpO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMudXNlRGVwdGhzKSB7XHJcbiAgICAgIHByb2dyYW1QYXJhbXMucHVzaCgnZGVwdGhzJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuICdjb250YWluZXIucHJvZ3JhbSgnICsgcHJvZ3JhbVBhcmFtcy5qb2luKCcsICcpICsgJyknO1xyXG4gIH0sXHJcblxyXG4gIHVzZVJlZ2lzdGVyOiBmdW5jdGlvbiAobmFtZSkge1xyXG4gICAgaWYgKCF0aGlzLnJlZ2lzdGVyc1tuYW1lXSkge1xyXG4gICAgICB0aGlzLnJlZ2lzdGVyc1tuYW1lXSA9IHRydWU7XHJcbiAgICAgIHRoaXMucmVnaXN0ZXJzLmxpc3QucHVzaChuYW1lKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBwdXNoOiBmdW5jdGlvbiAoZXhwcikge1xyXG4gICAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIExpdGVyYWwpKSB7XHJcbiAgICAgIGV4cHIgPSB0aGlzLnNvdXJjZS53cmFwKGV4cHIpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaW5saW5lU3RhY2sucHVzaChleHByKTtcclxuICAgIHJldHVybiBleHByO1xyXG4gIH0sXHJcblxyXG4gIHB1c2hTdGFja0xpdGVyYWw6IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICB0aGlzLnB1c2gobmV3IExpdGVyYWwoaXRlbSkpO1xyXG4gIH0sXHJcblxyXG4gIHB1c2hTb3VyY2U6IGZ1bmN0aW9uIChzb3VyY2UpIHtcclxuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XHJcbiAgICAgIHRoaXMuc291cmNlLnB1c2goXHJcbiAgICAgICAgdGhpcy5hcHBlbmRUb0J1ZmZlcihcclxuICAgICAgICAgIHRoaXMuc291cmNlLnF1b3RlZFN0cmluZyh0aGlzLnBlbmRpbmdDb250ZW50KSxcclxuICAgICAgICAgIHRoaXMucGVuZGluZ0xvY2F0aW9uXHJcbiAgICAgICAgKVxyXG4gICAgICApO1xyXG4gICAgICB0aGlzLnBlbmRpbmdDb250ZW50ID0gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChzb3VyY2UpIHtcclxuICAgICAgdGhpcy5zb3VyY2UucHVzaChzb3VyY2UpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIHJlcGxhY2VTdGFjazogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICBsZXQgcHJlZml4ID0gWycoJ10sXHJcbiAgICAgIHN0YWNrLFxyXG4gICAgICBjcmVhdGVkU3RhY2ssXHJcbiAgICAgIHVzZWRMaXRlcmFsO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXHJcbiAgICBpZiAoIXRoaXMuaXNJbmxpbmUoKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdyZXBsYWNlU3RhY2sgb24gbm9uLWlubGluZScpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFdlIHdhbnQgdG8gbWVyZ2UgdGhlIGlubGluZSBzdGF0ZW1lbnQgaW50byB0aGUgcmVwbGFjZW1lbnQgc3RhdGVtZW50IHZpYSAnLCdcclxuICAgIGxldCB0b3AgPSB0aGlzLnBvcFN0YWNrKHRydWUpO1xyXG5cclxuICAgIGlmICh0b3AgaW5zdGFuY2VvZiBMaXRlcmFsKSB7XHJcbiAgICAgIC8vIExpdGVyYWxzIGRvIG5vdCBuZWVkIHRvIGJlIGlubGluZWRcclxuICAgICAgc3RhY2sgPSBbdG9wLnZhbHVlXTtcclxuICAgICAgcHJlZml4ID0gWycoJywgc3RhY2tdO1xyXG4gICAgICB1c2VkTGl0ZXJhbCA9IHRydWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBHZXQgb3IgY3JlYXRlIHRoZSBjdXJyZW50IHN0YWNrIG5hbWUgZm9yIHVzZSBieSB0aGUgaW5saW5lXHJcbiAgICAgIGNyZWF0ZWRTdGFjayA9IHRydWU7XHJcbiAgICAgIGxldCBuYW1lID0gdGhpcy5pbmNyU3RhY2soKTtcclxuXHJcbiAgICAgIHByZWZpeCA9IFsnKCgnLCB0aGlzLnB1c2gobmFtZSksICcgPSAnLCB0b3AsICcpJ107XHJcbiAgICAgIHN0YWNrID0gdGhpcy50b3BTdGFjaygpO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBpdGVtID0gY2FsbGJhY2suY2FsbCh0aGlzLCBzdGFjayk7XHJcblxyXG4gICAgaWYgKCF1c2VkTGl0ZXJhbCkge1xyXG4gICAgICB0aGlzLnBvcFN0YWNrKCk7XHJcbiAgICB9XHJcbiAgICBpZiAoY3JlYXRlZFN0YWNrKSB7XHJcbiAgICAgIHRoaXMuc3RhY2tTbG90LS07XHJcbiAgICB9XHJcbiAgICB0aGlzLnB1c2gocHJlZml4LmNvbmNhdChpdGVtLCAnKScpKTtcclxuICB9LFxyXG5cclxuICBpbmNyU3RhY2s6IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuc3RhY2tTbG90Kys7XHJcbiAgICBpZiAodGhpcy5zdGFja1Nsb3QgPiB0aGlzLnN0YWNrVmFycy5sZW5ndGgpIHtcclxuICAgICAgdGhpcy5zdGFja1ZhcnMucHVzaCgnc3RhY2snICsgdGhpcy5zdGFja1Nsb3QpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMudG9wU3RhY2tOYW1lKCk7XHJcbiAgfSxcclxuICB0b3BTdGFja05hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiAnc3RhY2snICsgdGhpcy5zdGFja1Nsb3Q7XHJcbiAgfSxcclxuICBmbHVzaElubGluZTogZnVuY3Rpb24gKCkge1xyXG4gICAgbGV0IGlubGluZVN0YWNrID0gdGhpcy5pbmxpbmVTdGFjaztcclxuICAgIHRoaXMuaW5saW5lU3RhY2sgPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbmxpbmVTdGFjay5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICBsZXQgZW50cnkgPSBpbmxpbmVTdGFja1tpXTtcclxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXHJcbiAgICAgIGlmIChlbnRyeSBpbnN0YW5jZW9mIExpdGVyYWwpIHtcclxuICAgICAgICB0aGlzLmNvbXBpbGVTdGFjay5wdXNoKGVudHJ5KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBsZXQgc3RhY2sgPSB0aGlzLmluY3JTdGFjaygpO1xyXG4gICAgICAgIHRoaXMucHVzaFNvdXJjZShbc3RhY2ssICcgPSAnLCBlbnRyeSwgJzsnXSk7XHJcbiAgICAgICAgdGhpcy5jb21waWxlU3RhY2sucHVzaChzdGFjayk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIGlzSW5saW5lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5pbmxpbmVTdGFjay5sZW5ndGg7XHJcbiAgfSxcclxuXHJcbiAgcG9wU3RhY2s6IGZ1bmN0aW9uICh3cmFwcGVkKSB7XHJcbiAgICBsZXQgaW5saW5lID0gdGhpcy5pc0lubGluZSgpLFxyXG4gICAgICBpdGVtID0gKGlubGluZSA/IHRoaXMuaW5saW5lU3RhY2sgOiB0aGlzLmNvbXBpbGVTdGFjaykucG9wKCk7XHJcblxyXG4gICAgaWYgKCF3cmFwcGVkICYmIGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSB7XHJcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKCFpbmxpbmUpIHtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xyXG4gICAgICAgIGlmICghdGhpcy5zdGFja1Nsb3QpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ0ludmFsaWQgc3RhY2sgcG9wJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuc3RhY2tTbG90LS07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGl0ZW07XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgdG9wU3RhY2s6IGZ1bmN0aW9uICgpIHtcclxuICAgIGxldCBzdGFjayA9IHRoaXMuaXNJbmxpbmUoKSA/IHRoaXMuaW5saW5lU3RhY2sgOiB0aGlzLmNvbXBpbGVTdGFjayxcclxuICAgICAgaXRlbSA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xyXG5cclxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xyXG4gICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSB7XHJcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIGl0ZW07XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgY29udGV4dE5hbWU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XHJcbiAgICBpZiAodGhpcy51c2VEZXB0aHMgJiYgY29udGV4dCkge1xyXG4gICAgICByZXR1cm4gJ2RlcHRoc1snICsgY29udGV4dCArICddJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiAnZGVwdGgnICsgY29udGV4dDtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBxdW90ZWRTdHJpbmc6IGZ1bmN0aW9uIChzdHIpIHtcclxuICAgIHJldHVybiB0aGlzLnNvdXJjZS5xdW90ZWRTdHJpbmcoc3RyKTtcclxuICB9LFxyXG5cclxuICBvYmplY3RMaXRlcmFsOiBmdW5jdGlvbiAob2JqKSB7XHJcbiAgICByZXR1cm4gdGhpcy5zb3VyY2Uub2JqZWN0TGl0ZXJhbChvYmopO1xyXG4gIH0sXHJcblxyXG4gIGFsaWFzYWJsZTogZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgIGxldCByZXQgPSB0aGlzLmFsaWFzZXNbbmFtZV07XHJcbiAgICBpZiAocmV0KSB7XHJcbiAgICAgIHJldC5yZWZlcmVuY2VDb3VudCsrO1xyXG4gICAgICByZXR1cm4gcmV0O1xyXG4gICAgfVxyXG5cclxuICAgIHJldCA9IHRoaXMuYWxpYXNlc1tuYW1lXSA9IHRoaXMuc291cmNlLndyYXAobmFtZSk7XHJcbiAgICByZXQuYWxpYXNhYmxlID0gdHJ1ZTtcclxuICAgIHJldC5yZWZlcmVuY2VDb3VudCA9IDE7XHJcblxyXG4gICAgcmV0dXJuIHJldDtcclxuICB9LFxyXG5cclxuICBzZXR1cEhlbHBlcjogZnVuY3Rpb24gKHBhcmFtU2l6ZSwgbmFtZSwgYmxvY2tIZWxwZXIpIHtcclxuICAgIGxldCBwYXJhbXMgPSBbXSxcclxuICAgICAgcGFyYW1zSW5pdCA9IHRoaXMuc2V0dXBIZWxwZXJBcmdzKG5hbWUsIHBhcmFtU2l6ZSwgcGFyYW1zLCBibG9ja0hlbHBlcik7XHJcbiAgICBsZXQgZm91bmRIZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2hlbHBlcnMnLCBuYW1lLCAnaGVscGVyJyksXHJcbiAgICAgIGNhbGxDb250ZXh0ID0gdGhpcy5hbGlhc2FibGUoXHJcbiAgICAgICAgYCR7dGhpcy5jb250ZXh0TmFtZSgwKX0gIT0gbnVsbCA/ICR7dGhpcy5jb250ZXh0TmFtZShcclxuICAgICAgICAgIDBcclxuICAgICAgICApfSA6IChjb250YWluZXIubnVsbENvbnRleHQgfHwge30pYFxyXG4gICAgICApO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHBhcmFtczogcGFyYW1zLFxyXG4gICAgICBwYXJhbXNJbml0OiBwYXJhbXNJbml0LFxyXG4gICAgICBuYW1lOiBmb3VuZEhlbHBlcixcclxuICAgICAgY2FsbFBhcmFtczogW2NhbGxDb250ZXh0XS5jb25jYXQocGFyYW1zKSxcclxuICAgIH07XHJcbiAgfSxcclxuXHJcbiAgc2V0dXBQYXJhbXM6IGZ1bmN0aW9uIChoZWxwZXIsIHBhcmFtU2l6ZSwgcGFyYW1zKSB7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHt9LFxyXG4gICAgICBvYmplY3RBcmdzID0gIXBhcmFtcyxcclxuICAgICAgcGFyYW07XHJcblxyXG4gICAgaWYgKG9iamVjdEFyZ3MpIHtcclxuICAgICAgcGFyYW1zID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgb3B0aW9ucy5uYW1lID0gdGhpcy5xdW90ZWRTdHJpbmcoaGVscGVyKTtcclxuICAgIG9wdGlvbnMuaGFzaCA9IHRoaXMucG9wU3RhY2soKTtcclxuXHJcbiAgICBsZXQgaW52ZXJzZSA9IHRoaXMucG9wU3RhY2soKSxcclxuICAgICAgcHJvZ3JhbSA9IHRoaXMucG9wU3RhY2soKTtcclxuXHJcbiAgICAvLyBBdm9pZCBzZXR0aW5nIGZuIGFuZCBpbnZlcnNlIGlmIG5laXRoZXIgYXJlIHNldC4gVGhpcyBhbGxvd3NcclxuICAgIC8vIGhlbHBlcnMgdG8gZG8gYSBjaGVjayBmb3IgYGlmIChvcHRpb25zLmZuKWBcclxuICAgIGlmIChwcm9ncmFtIHx8IGludmVyc2UpIHtcclxuICAgICAgb3B0aW9ucy5mbiA9IHByb2dyYW0gfHwgJ2NvbnRhaW5lci5ub29wJztcclxuICAgICAgb3B0aW9ucy5pbnZlcnNlID0gaW52ZXJzZSB8fCAnY29udGFpbmVyLm5vb3AnO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFRoZSBwYXJhbWV0ZXJzIGdvIG9uIHRvIHRoZSBzdGFjayBpbiBvcmRlciAobWFraW5nIHN1cmUgdGhhdCB0aGV5IGFyZSBldmFsdWF0ZWQgaW4gb3JkZXIpXHJcbiAgICAvLyBzbyB3ZSBuZWVkIHRvIHBvcCB0aGVtIG9mZiB0aGUgc3RhY2sgaW4gcmV2ZXJzZSBvcmRlclxyXG4gICAgbGV0IGkgPSBwYXJhbVNpemU7XHJcbiAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgIHBhcmFtID0gdGhpcy5wb3BTdGFjaygpO1xyXG4gICAgICBwYXJhbXNbaV0gPSBwYXJhbTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAob2JqZWN0QXJncykge1xyXG4gICAgICBvcHRpb25zLmFyZ3MgPSB0aGlzLnNvdXJjZS5nZW5lcmF0ZUFycmF5KHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7XHJcbiAgICAgIG9wdGlvbnMuZGF0YSA9ICdkYXRhJztcclxuICAgIH1cclxuICAgIGlmICh0aGlzLnVzZUJsb2NrUGFyYW1zKSB7XHJcbiAgICAgIG9wdGlvbnMuYmxvY2tQYXJhbXMgPSAnYmxvY2tQYXJhbXMnO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG9wdGlvbnM7XHJcbiAgfSxcclxuXHJcbiAgc2V0dXBIZWxwZXJBcmdzOiBmdW5jdGlvbiAoaGVscGVyLCBwYXJhbVNpemUsIHBhcmFtcywgdXNlUmVnaXN0ZXIpIHtcclxuICAgIGxldCBvcHRpb25zID0gdGhpcy5zZXR1cFBhcmFtcyhoZWxwZXIsIHBhcmFtU2l6ZSwgcGFyYW1zKTtcclxuICAgIG9wdGlvbnMubG9jID0gSlNPTi5zdHJpbmdpZnkodGhpcy5zb3VyY2UuY3VycmVudExvY2F0aW9uKTtcclxuICAgIG9wdGlvbnMgPSB0aGlzLm9iamVjdExpdGVyYWwob3B0aW9ucyk7XHJcbiAgICBpZiAodXNlUmVnaXN0ZXIpIHtcclxuICAgICAgdGhpcy51c2VSZWdpc3Rlcignb3B0aW9ucycpO1xyXG4gICAgICBwYXJhbXMucHVzaCgnb3B0aW9ucycpO1xyXG4gICAgICByZXR1cm4gWydvcHRpb25zPScsIG9wdGlvbnNdO1xyXG4gICAgfSBlbHNlIGlmIChwYXJhbXMpIHtcclxuICAgICAgcGFyYW1zLnB1c2gob3B0aW9ucyk7XHJcbiAgICAgIHJldHVybiAnJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBvcHRpb25zO1xyXG4gICAgfVxyXG4gIH0sXHJcbn07XHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG4gIGNvbnN0IHJlc2VydmVkV29yZHMgPSAoXHJcbiAgICAnYnJlYWsgZWxzZSBuZXcgdmFyJyArXHJcbiAgICAnIGNhc2UgZmluYWxseSByZXR1cm4gdm9pZCcgK1xyXG4gICAgJyBjYXRjaCBmb3Igc3dpdGNoIHdoaWxlJyArXHJcbiAgICAnIGNvbnRpbnVlIGZ1bmN0aW9uIHRoaXMgd2l0aCcgK1xyXG4gICAgJyBkZWZhdWx0IGlmIHRocm93JyArXHJcbiAgICAnIGRlbGV0ZSBpbiB0cnknICtcclxuICAgICcgZG8gaW5zdGFuY2VvZiB0eXBlb2YnICtcclxuICAgICcgYWJzdHJhY3QgZW51bSBpbnQgc2hvcnQnICtcclxuICAgICcgYm9vbGVhbiBleHBvcnQgaW50ZXJmYWNlIHN0YXRpYycgK1xyXG4gICAgJyBieXRlIGV4dGVuZHMgbG9uZyBzdXBlcicgK1xyXG4gICAgJyBjaGFyIGZpbmFsIG5hdGl2ZSBzeW5jaHJvbml6ZWQnICtcclxuICAgICcgY2xhc3MgZmxvYXQgcGFja2FnZSB0aHJvd3MnICtcclxuICAgICcgY29uc3QgZ290byBwcml2YXRlIHRyYW5zaWVudCcgK1xyXG4gICAgJyBkZWJ1Z2dlciBpbXBsZW1lbnRzIHByb3RlY3RlZCB2b2xhdGlsZScgK1xyXG4gICAgJyBkb3VibGUgaW1wb3J0IHB1YmxpYyBsZXQgeWllbGQgYXdhaXQnICtcclxuICAgICcgbnVsbCB0cnVlIGZhbHNlJ1xyXG4gICkuc3BsaXQoJyAnKTtcclxuXHJcbiAgY29uc3QgY29tcGlsZXJXb3JkcyA9IChKYXZhU2NyaXB0Q29tcGlsZXIuUkVTRVJWRURfV09SRFMgPSB7fSk7XHJcblxyXG4gIGZvciAobGV0IGkgPSAwLCBsID0gcmVzZXJ2ZWRXb3Jkcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgIGNvbXBpbGVyV29yZHNbcmVzZXJ2ZWRXb3Jkc1tpXV0gPSB0cnVlO1xyXG4gIH1cclxufSkoKTtcclxuXHJcbi8qKlxyXG4gKiBAZGVwcmVjYXRlZCBNYXkgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uXHJcbiAqL1xyXG5KYXZhU2NyaXB0Q29tcGlsZXIuaXNWYWxpZEphdmFTY3JpcHRWYXJpYWJsZU5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xyXG4gIHJldHVybiAoXHJcbiAgICAhSmF2YVNjcmlwdENvbXBpbGVyLlJFU0VSVkVEX1dPUkRTW25hbWVdICYmXHJcbiAgICAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdKiQvLnRlc3QobmFtZSlcclxuICApO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gc3RyaWN0TG9va3VwKHJlcXVpcmVUZXJtaW5hbCwgY29tcGlsZXIsIHBhcnRzLCBpLCB0eXBlKSB7XHJcbiAgbGV0IHN0YWNrID0gY29tcGlsZXIucG9wU3RhY2soKSxcclxuICAgIGxlbiA9IHBhcnRzLmxlbmd0aDtcclxuICBpZiAocmVxdWlyZVRlcm1pbmFsKSB7XHJcbiAgICBsZW4tLTtcclxuICB9XHJcblxyXG4gIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgIHN0YWNrID0gY29tcGlsZXIubmFtZUxvb2t1cChzdGFjaywgcGFydHNbaV0sIHR5cGUpO1xyXG4gIH1cclxuXHJcbiAgaWYgKHJlcXVpcmVUZXJtaW5hbCkge1xyXG4gICAgcmV0dXJuIFtcclxuICAgICAgY29tcGlsZXIuYWxpYXNhYmxlKCdjb250YWluZXIuc3RyaWN0JyksXHJcbiAgICAgICcoJyxcclxuICAgICAgc3RhY2ssXHJcbiAgICAgICcsICcsXHJcbiAgICAgIGNvbXBpbGVyLnF1b3RlZFN0cmluZyhwYXJ0c1tpXSksXHJcbiAgICAgICcsICcsXHJcbiAgICAgIEpTT04uc3RyaW5naWZ5KGNvbXBpbGVyLnNvdXJjZS5jdXJyZW50TG9jYXRpb24pLFxyXG4gICAgICAnICknLFxyXG4gICAgXTtcclxuICB9IGVsc2Uge1xyXG4gICAgcmV0dXJuIHN0YWNrO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgSmF2YVNjcmlwdENvbXBpbGVyO1xyXG4iXX0=
