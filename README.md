# node-spaz

## WARNING: This package is currently under development! It is essentially vaporware right now. Do not download this code expecting anything to work. This README documents the future capabilities of this package.


## Install
```sh
$ npm install spaz
```

## Features
 * 


## Examples

### Introduction



query_builder

`.select()` Returns a list of variables in the current select query. Identical to calling `.select(false)`

`.select(as_hash: boolean)` Returns a hash of variables and their corresponding expressions if `as_hash` is true; otherwise returns list of variables as array

`.select(variable: string)` Adds `variable` to the set of variables used by the select statement
	Note: since the query builder uses a Set to store the variables, adding a variable that is already selected will have no effect.

`.select(expression: string, alias: string)` Adds `alias` to the set of variables along with a corresponding `expression` used by the select statement.

`.select(expression_w_alias: string)` Parses `expression_w_alias` for the expression and aliased variable name, which it then adds (respectively) to the set of variables and corresponding expressions used by the select statement.

`.select(expressions: array of strings)` Creates a new list of select variables from the given `variables` array. Passing an empty array will effectively clear the current selection.



`.from()` Returns list of default graphs and named graphs as array. Identical to calling `.from(false)`

`.from(as_hash: boolean)` If `as_hash` is true, returns a hash of graphs in the format `{default:[], named:[]}`; otherwise returns list of default graphs and named graphs as array

`.from()`