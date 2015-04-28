'use strict';

/**
 * Call this Visitor on a walker and collect what it generates to
 * re-build the tree. And since every method could only return
 * the node (shouldn't recursively look up in the node), the walker
 * should visite the tree from the deepest node, not from the top most
 * node (aka 'backward' visiting).
 *
 * Or the walker should provide a tracking path to let it update the
 * whole member accessing at the visiting time. For example:
 *
 *   Walker.onNode = (path, prop, node) {
 *      var newNode = this.visitor[node.type](node, this.states);
 *      path[prop] = node;  // update it
 *   };
 */
(function() {
  // XXX: see 'workaroundAssignmentPattern' and other workarounds...
  var acorn = require('acorn');
  var Visitor = function(opts) {
    this.advice = opts.advice;
  };
  Visitor.prototype.ArrowFunctionExpression =
  Visitor.prototype.FunctionExpression =
  Visitor.prototype.FunctionDeclaration = function(node, states) {
    // XXX: see 'workaroundAssignmentPattern'...
    var assignmentstmts = this.workaroundAssignmentPattern(node);
    // XXX: see 'workaroundRestElement'...
    var workaroundRestElement = this.workaroundRestElement(node);
    var reststmt = workaroundRestElement.statements;
    // Now we're in the body of the node.
    var accesslist = this.fetchAccessList(states);
    var functionid  = this.fetchFunctionId(node);
    node._workaroundRestElement = workaroundRestElement;
    this.processAdvice(node, accesslist, functionid);

    if (reststmt) {
      node.body.body.unshift(reststmt);
    }
    node.body.body = assignmentstmts.concat(node.body.body);
    // XXX: yes it sucks but we need to let generator know which one is
    // the rest element variable.
  };

  /**
   *  var foo = bar.goo = x.y.z = { a: { b: {f: function() {}}}}
   *  [ [foo], [bar, goo], [x, y, z], a, b, f ] to
   *  [ [foo, a, b, f] [bar, goo, a, b, f], [x, y, z, a, b, f] ]
   */
  Visitor.prototype.flatternAccessList = function(accesslist) {
    var groups = accesslist.reduce(function(acc, node) {
      if (Array.isArray(node)) {
        acc.parentlists.push(node);
      } else {
        acc.children.push(node);
      }
      return acc;
    },
    { parentlists: [], children: [] });
    var flatterns = groups.parentlists.map(function(parents) {
      return parents.concat(groups.children);
    });
    return flatterns;
  };

  Visitor.prototype.fetchNameList = function(accesslists) {
    var namelist = accesslists.map(function(list) {
      return list.map(function(id) {
        return id.name;
      });
    });
    return namelist;
  };

  Visitor.prototype.processAdvice = function(node, accesslist, functionid) {
    var adviced;
    var pathlists = this.fetchNameList(this.flatternAccessList(accesslist));
    var fname = functionid ? functionid.name : null;
    var pathMatched;
    var isMatch = (function() {
      var idMatched = false;
      if (this.advice.matchId(fname)) {
        idMatched = true;
      } else {
        // Only one matched.
        pathMatched = pathlists.filter(
          (function(list) { return this.advice.matchPath(list); })
          .bind(this))[0];
      }
      return idMatched || pathMatched;
    }).bind(this);

    if (isMatch()) {
      // Note: file name isn't from AST, so here we can't set it.
      var meta = {'id': fname, 'paths': pathlists, 'loc': node.loc};
      adviced = this.advice.apply(node, meta);
    }
  };

  Visitor.prototype.fetchFunctionId = function(node) {
    if (node.id) {
      return node.id;
    } else {
      return null;
    }
  };

  Visitor.prototype.fetchMemberList = function(memberExpression) {
    // Since the nature of recursion, we could tolerate inner function
    // like this.
    var doFetch = function(object, list) {
      // No matter whether it's the leaf node, every object should
      // follow a 'property'.
      if (object.property) {
        list.unshift(object.property);
      }
      if (object.object) {
        return doFetch(object.object, list);
      } else if (!object.property) {

        // The name of the object itself
        list.unshift(object);
        return list;
      }
    };
    var result = [];
    return doFetch(memberExpression, result);
  };

  // XXX: because some generator doesn't support RestElement yet...
  Visitor.prototype.workaroundRestElement = function(node) {
    var params = node.params;
    var resultstmt;
    var resultvarname;
    params.forEach(function(param, idx) {
      if ('RestElement' !== param.type) {
        return;
      }
      var varname = param.argument.name;
      // The template is from Babel.
      // But we don't have 'let', so it's so ugly to prevent name collision.
      var lenvar = '_len_espect_' + Date.now();
      var keyvar = '_key_espect_' + Date.now();
      var template = 'for (var ' + lenvar +
                           ' = arguments.length, ' +
                           keyvar + ' = ' + idx + ';' +
                           keyvar + ' < ' + lenvar + '; ' + keyvar + '++) {' +
            varname + ' = Array(' + lenvar + ');' +
            varname + '[' + keyvar + ' -  ' + idx +' ] = arguments[' + keyvar + '];' +
      '}';
      var parsedtemplate =
        acorn.parse(template, { ecmaVersion: 6, ranges: true, locations: true});
      // Replace the node with Id
      node.params[idx] = param.argument;
      // This should be only one, or it's a syntax error.
      // So we don't need to concat arrays.
      resultstmt = parsedtemplate;
      resultvarname = varname;
    });
    return {'statements': resultstmt, 'variable': resultvarname};
  };

  // XXX: because some code generator doesn't support assignment pattern yet...
  // We compile it here and put it at the head of the original function.
  Visitor.prototype.workaroundAssignmentPattern = function(node) {
    var params = node.params;
    var varstmts = [];
    params.forEach(function(param, idx) {
      if ('AssignmentPattern' !== param.type) {
        return;
      }
      var id = param.left;
      var value = param.right;
      // The template is from Babel.
      var template = 'arguments[' + idx + ']' +
        ' = ' + 'arguments[' + idx + '] '+ ' !== undefined ? ' +
        'arguments[ ' + idx + ' ] : __placeholder__ ';
      var parsedtemplate = acorn.parse(
        template, { ranges: true, ecmaVersion: 6, locations: true}).body[0];
      // To replace the placeholder.
      parsedtemplate.expression.right.alternate =
        JSON.parse(JSON.stringify(value));
      varstmts.push(parsedtemplate);
      node.params[idx] = id;
    });
    return varstmts;
  };

  Visitor.prototype.fetchAccessList = function(parentlist) {
    var vardecl;
    return parentlist.map((function (parent){
      if ('VariableDeclaration' === parent.type &&
          'var' === parent.kind) {
        vardecl = parent;
      }
      if ('Property' === parent.type) {
        return parent.key;
      } else if ('AssignmentExpression' === parent.type) {
        // May return an array that's in the result array.
        // Since 'x.y = z.a = w.s = function' exists, we may have
        // a 'multiparents' function declaration.
        return this.fetchMemberList(parent.left);
      } else if ('ObjectExpression' === parent.type &&
                 vardecl) {
        // For the case: var foo = { somefn: function() {} }
        var result = vardecl.declarations.map(function(dec) {
          return dec.id;
        });
        vardecl = null; //  only need first object to bind with the var
        return result;
      }
    }).bind(this)).filter(function(e) {
      return 'undefined' !== typeof e;
    });
  };
  module.exports = Visitor;
})();
