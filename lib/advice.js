'use strict';

/**
 * Advice contains several 'before' or 'after' function that would be weaved
 * into the target function. No matter their type, these functions are all
 * able to receive such information about the target function as the only
 * argument of the weaved one:
 *
 * {
 *      self        // The 'this' of the original function.
 *      arguments   // The original arguments of the function.
 *                  // It would become {fooparam: foovalue}
 *      result      // The result of the original function.
 *      meta.file   // The file of the original source
 *      meta.loc    // The loc of the original function // TODO: broken
 *      predefines  // Any customed predefined variables.
 * }
 *
 */
(function() {
  var acorn = require('acorn');
  var Advice = function(file, query) {
    this.file = file; // meta needs it.
    this.query = query;
    this.count = 0;
    this.befores = [];
    this.afters = [];
    this.applied = false;
  };

  /**
   * The optional 'context' is an object could be the 'this' of this 'before'.
   * User doesn't need to serialize it. It could be any literal object.
   */
  Advice.prototype.before = function(fn, context) {
    var id = 'before_' + this.generateId();
    this.befores.push({ 'function': fn, 'context': context, 'id': id });
    return this;
  };

  /**
   * The optional 'context' is an object could be the 'this' of this 'after'.
   * User doesn't need to serialize it. It could be any literal object.
   */
  Advice.prototype.after = function(fn, context) {
    var id = 'after_'+ this.generateId();
    this.afters.push({ 'function': fn, 'context': context, 'id': id });
    return this;
  };

  /**
   * list: ['foo', 'bar', 'fn']
   * query: 'foo.bar.fn'
   */
  Advice.prototype.matchPath = function(list) {
    return this.query === list.join('.');
  };

  /**
   * id: 'ls_x_function'
   * query: '#ls_x_function'
   */
  Advice.prototype.matchId = function(id) {
    if ('*' === this.query) {
      return true;
    }
    return this.query.replace('#', '') === id;
  };

  /**
   * Give a function/arrow expression or function declaration node
   * and it would return another.
   *
   * The node, no matter which one it is, would has the 'body' prop
   * which is a 'BlockStatement' node.
   *
   * Note it would directly modify the FunctionExpression
   * 'meta': {id: function name, path: function access path, loc: loc}
   */
  Advice.prototype.apply = function(targetexpr, meta) {
    this.applied = true;
    meta.file = this.file;
    var originalexpr = JSON.parse(JSON.stringify(targetexpr),
        this.workaroundRegExp.bind(this));
    var builts = this.buildFunctionNodes(meta);
    var befores = builts.befores;
    var afters = builts.afters;
    var returnname = this.generateReturnName(this.generateId());
    var workaroundRestElementVarname =
        targetexpr._workaroundRestElement.variable;
    var result = this.createCallExpression({
          'expression': targetexpr,
          'name': returnname,
          'meta': meta,
          'proxymode': true,
          'arguments': (workaroundRestElementVarname) ?
                      [ workaroundRestElementVarname ] : undefined
        });
    var retvar = result[0];
    var retcall = result[1];
    // Clear all statements that we already wrapped them as 'retvar'.
    targetexpr.body.body = [];
    var targetstmts = targetexpr.body.body;
    befores.forEach((function(before) {
      var callstmts = this.createCallExpression({
          'expression': before.expression,
          'name': before.id,
          'meta': before.meta,
          'context': before.context,
          'proxied': originalexpr,
          'proxymode': false
        });
      var calldecl  = callstmts[0];
      var callassgn = callstmts[1];
      targetstmts.push(calldecl);
      targetstmts.push(callassgn);
    }).bind(this));
    targetstmts.push(retvar);
    targetstmts.push(retcall);
    afters.forEach((function(after) {
      var callstmts = this.createCallExpression({
          'expression': after.expression,
          'name': after.id,
          'meta': after.meta,
          'context': after.context,
          'proxied': originalexpr,
          'proxymode': false
        });
      var calldecl  = callstmts[0];
      var callassgn = callstmts[1];
      targetstmts.push(calldecl);
      targetstmts.push(callassgn);
    }).bind(this));
    targetstmts.push(this.createReturnLine(returnname));
    return targetexpr;
  };

  /**
   * Give a FunctionExpression code and a name, return two statements to
   *
   * 1. assign a temporary name to the function
   * 2. call it and assign the name to the result.
   *
   * If 'neocontext' is set, the function would apply on it. Or, it would
   * use the original function's 'this' as this.
   *
   * If 'predecls' is set, which should be {foo: bar} key value pair,
   * it would insert 'foo = bar' as initial lines of the target function.
   * Please note this is somewhat tricky because it slightly change
   * the original semantics. So the name of the declarations must be
   * considered.
   *
   * The generated function would receive one argument contains all info:
   *
   *    function generated(context) {
   *      this                // The assigned 'context', or the orignal this
   *      context.self        // The 'this' of the original function.
   *      context.arguments   // The original arguments of the function.
   *                          // It would become {fooparam: foovalue}
   *      context.result      // The result of the original function.
   *      context.meta.file   // The file of the original source
   *      context.meta.loc    // The loc of the original function
   *      context.predefines  // Any customed predefined variables.
   *    }
   *
   * The options could be:
   *
   *    {
   *       'expression': before.expression,
   *       'name': before.id,
   *       'meta': before.meta,
   *       'context': before.context,
   *       'proxied': originalexpression    //TODO: broken in some cases...
   *       'proxymode': false
   *       'arguments': [ string to put in applying argument list ] (optional)
   *    }
   *
   * The 'proxymode' means use the original 'this' and 'arguments' to apply it.
   */
  Advice.prototype.createCallExpression =
  function(opts) {
    var fnexpress = JSON.parse(JSON.stringify(
          opts.expression), this.workaroundRegExp);
    var varname = opts.name;
    var neocontext = opts.neocontext;
    if (!neocontext) {
      neocontext = 'this';
    } else if ('string' !== typeof neocontext) {
      neocontext = JSON.stringify(neocontext);
    } else {
      neocontext = neocontext;
    }
    var meta = opts.meta || {};
    var predecls = opts.predefines|| {};
    var fnparams = fnexpress.params;
    var fnstmts = fnexpress.body;
    var strargs = (opts.arguments) ?
                  '[' + opts.arguments.join(',') + ']'  :
                  'arguments';
    var template;
    // It should return:
    //    'var returnname = (function() {...}).apply(this, arguments)'
    // However, since generate would erase the '()' wrapper, it would become
    //    var returnname = function() {...}.apply(this, arguments)
    // It's an error, so we could only generate it as:
    //    var returnname = function() {...};
    //    returnname = returnname.apply(this, arguments);
    if (!opts.proxymode) {
      var arg = '{' +
        '\'self\': this,' +
        '\'arguments\': ' + strargs + ',' +
        '\'meta\': ' + JSON.stringify(meta) + ',' +
        '\'predefined\': ' + JSON.stringify(predecls) + 
      '}';
      template = 'var ' + varname + ' = function(context){};' +
        varname + ' = ' + varname + '.apply( ' + neocontext + ', [' + arg +'])';
    } else {
      template = 'var ' + varname + ' = function(){};' +
        varname + ' = ' + varname + '.apply(this, ' + strargs + ')';
    }

    // Get it from the auto-wrapped 'Program' container.
    var templatedstmts = acorn.parse(template,
      {ecmaVersion: 6, ranges: true, locations: true}).body;
    var templateddecl  = templatedstmts[0];
    var templatedcall = templatedstmts[1];
    // Replace the dummy one with the function.
    templateddecl.declarations[0].init.body = fnstmts;
    // TODO: If this grows larger we need to refactor it.
    if (opts.proxymode) {
      // Proxied function need to keep the params.
      templateddecl.declarations[0].init.params = fnparams;
    }
    // And copy it to prevent unexpected ref-modification.
    return [templateddecl, templatedcall];
  };

  /**
   * From function to text to AST.
   * To: { befores: [ {expression: AST, id: Id, context: {...}} ], afters: [] }
   *
   * meta: the meta infomation of the target function, include function name
   * and loc (line, column). It would become one filed in the advice.
   */
  Advice.prototype.buildFunctionNodes = function(meta) {
    var options = {
      ecmaVersion: 6,
      ranges: true,
      locations: true   // just to make sure field exists.
    };
    // Need to add '()' to prevent parser error.
    // It would parse the script as Program node so need to dig it later
    var befores = this.befores.map(function(before) {
      var tree = acorn.parse('(' + before['function'].toString() + ')', options);
      return { 'expression': tree.body[0].expression,
        'id': before.id, 'context': before.context, 'meta': meta };
    });
    var afters = this.afters.map(function(after) {
      var tree = acorn.parse('(' + after['function'].toString() + ')', options);
      return { 'expression': tree.body[0].expression,
        'id': after.id, 'context': after.context, 'meta': meta };
    });
    return { 'befores': befores , 'afters': afters };
  };

  Advice.prototype.createReturnLine = function(returnname) {
    var str = 'return ' + returnname + ';';
    return acorn.parse(str, {
      ecmaVersion: 6,
      ranges: true,
      locations: true ,  // just to make sure field exists.
      allowReturnOutsideFunction: true
    }).body[0];
  };

  Advice.prototype.generateReturnName = function(id) {
    return 'ret_' + id;
  };

  Advice.prototype.generateId = function() {
    var count = this.count;
    this.count ++;
    // Need to replace them to make a variable name.
    return 'hook_' + this.query.replace(/[.#*]/g, '$') + count;
  };

  /**
   * XXX: Because Escodegen bug#230, a 'regex' node would be 'toString' while
   * it's only a plain object, and then we would get the incorrect
   * '[object Object]' in our output.
   */
  Advice.prototype.workaroundRegExp = function(key, val) {
    if (val && val.regex && val.value) {
      val.value = val.regex;
      val.value.toString = function() {
        var re = new RegExp(val.value.pattern, val.value.flags);
        return re.toString();
      };
    }
    return val;
  };

  module.exports = Advice;
})();
