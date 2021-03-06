# Espect: static AOP tool for ECMAScript

This is a Node.js tool to help to weave specified advices to the base scripts.

**It's currently very experimental so more information would be added later**

## How to use it

1. Write a new `advices` file (ex: `/sample/dummy/dummyadvices.esp.js`)
2. Use command-line to perform the task
   (ex: `espect ./sample/dummy/dummyadvices.esp.js /tmp/dummytest.js`)
3. For test, add `--dry` to see output in console, not to real file

Or, use it as a Node.js module:

`Espect = require('espect');`

In this way you could write an eDSL like the `dummyadvices` does to compose
your own AOP scripts.

## How does it work

It would take a look at your advices file to see which file and function should be
adviced. If it could find one, attach every `before` and `after` function around the
base function. It would make sure the original function not been modified, and
the `before` and `after` could get as much information as the original function get.

The compiled function should work as the same with the previous one.

## The selector

It could select two kinds of ECMAScript functions:

1. By ID: `function foo() {}` could be selected with `#foo`
2. By path: `Foo.prototype.bar = function() {}` could be selected with `foo.prototype.bar`
3. Select all: `*`

In `/sample/dummy/dummybase.js` it lists the all supported function expression styles.

## How to test it

`gulp test`

## License

Since it's a project used and originally designed for Mozilla Gaia,
it could only be licensed under Apache2.

Currently there is a `/lib/walker.js` is from Acorn parser, which
need to be under MIT license. We would fix this to avoid license
issue ASAP.
