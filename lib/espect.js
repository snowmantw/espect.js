'use strict';

/**
 * The interface to set up and apply multiple advices.
 */
(function() {
  var fs = require('fs');
  var acorn  = require('acorn');
  var escodegen = require('escodegen');
  var walker  = require(__dirname + '/walker.js');
  var Visitor = require(__dirname + '/visitor.js');
  var Advice = require(__dirname + '/advice.js');
  var Espect = function(opts) {
    this._advices = [];
    this._applied = [];
    this._generated = [];
    this._ASTCache = {};
    this._writer = opts.writer;
  };

  /**
   * selector: 'somefile.js #fun_id'   or
   * selector: 'somefile.js path.to.function'
   *
   * User should use this as:
   *    var aspect = new Espect();
   *    aspect.select('somefile.js #fun_id')
   *            .before(...)
   *            .before(...)
   *            .after(...)
   *            .after(...)
   *            .after(...)
   *            .done()
   *          .select('anotherfile.js path.to.function')
   *            .before(...)
   *            .done()
   *          .done()
   */
  Espect.prototype.select = function(selector) {
    var instance;
    try {
      var file  = selector.match(/(^.*) /)[1];
      var query = selector.match(/ (.*$)/)[1];
      instance = new Advice(file, query);
      this._advices.push({ 'instance': instance, 'file': file });
    } catch (e) {
      throw new Error('Invalid selector: ' + selector);
    }
    // We need to enter the advice context and then return from it.
    instance.done = (function() {
      return this;
    }).bind(this);
    return instance;
  };

  Espect.prototype.done = function() {
    this._advices = this._parse();
    this._applied = this._apply();
    this._generated = this._generate();
    this._write();
  };

  /**
   * TODO: if we have async parser we could rewrite it
   * as async method (Promise.all).
   */
  Espect.prototype._parse = function() {
    // In theory we should use map for better interface,
    // but I think it's fine to cheat here, although we
    // still keep the 'map-like' interface (to return result array).
    this._advices.forEach((function(advice) {
      var tree, parsedComments, parsedTokens;
      if (this._ASTCache[advice.file]) {
        // It would be parsed only once, so it's OK to cache them.
        tree = this._ASTCache[advice.file].tree;
        parsedComments = this._ASTCache[advice.file].comments;
        parsedTokens = this._ASTCache[advice.file].tokens;
      } else {
        parsedTokens = [];
        parsedComments = [];
        var parserOptions = {
          ecmaVersion: 6,
          ranges: true,
          locations: true,
          onComment: parsedComments,
          onToken: parsedTokens
        };
        try {
          tree = acorn.parse(fs.readFileSync(advice.file), parserOptions);
        } catch(e) {
          console.error('Error while parsing "' + advice.file + '"');
          throw e;
        }
        this._ASTCache[advice.file] = tree;
      }
      advice.ast = {
        tree: tree,
        comments: parsedComments,
        tokens: parsedTokens
      };
    }).bind(this));
    return this._advices;
  };

  Espect.prototype._apply = function() {
    return this._advices.map((function(advice) {
      var visitor = new Visitor({ 'advice': advice.instance });
      // Would alter the tree in place.
      walker.ancestor(advice.ast.tree, visitor);
      return advice;
    }).bind(this));
  };

  Espect.prototype._generate = function() {
    return this._applied.map((function(advice) {
      escodegen.attachComments(
        advice.ast.tree, advice.ast.comments, advice.ast.tokens);
      var code = escodegen.generate(advice.ast.tree, { comment: true });
      advice.code = code;
      return advice;
    }).bind(this));
  };

  Espect.prototype._write = function() {
    this._generated.forEach((function(advice) {
      this._writer.write(advice);
    }).bind(this));
  };

  module.exports = Espect;
})();
