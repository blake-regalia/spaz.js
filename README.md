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



## Query Builder

* [`.from`](#q.from)
* [`.select`](#q.select)


<a name="q.from" />

### .from()
Returns list of default graphs and named graphs as array. Identical to calling `.from(false)`

### .from(as_hash: boolean)
If `as_hash` is true, returns a hash of graphs in the format `{default:[], named:[]}`; otherwise returns list of default graphs and named graphs as array

### .from(graph_args: array[string/hash])
Clears graphs from both default and named sets. Then tries to add items in `graph_args` to default/named graphs depending on data type of each item (see overloaded versions below)

### .from(...default_graph_uris: string)
Adds URIs to the set of default graphs
	*Note:* since the query builder uses a Set to store the variables, adding a variable that is already selected will have no effect.

### .from(graph_uris: hash)
Will add all items from `graph_uris.default` and `graph_uris.named` to the respective existing graph sets. If defined, expects either a string or an array of strings for each property (`.default` and `.named`). **However if an empty array is given for the `.default` or `.named` property, only that corresponding set will be cleared.**

---------------------------------------

<a name="q.select" />

### .select()
Returns a list of variables in the current select query. Identical to calling `.select(false)`

### .select(as_hash: boolean)
Returns a hash of variables and their corresponding expressions if `as_hash` is true; otherwise returns list of variables as array

### .select(variable: string)
Adds `variable` to the set of variables used by the select statement
	*Note:* since the query builder uses a Set to store the variables, adding a variable that is already selected will have no effect.

### .select(expression: string, alias: string)
Adds `alias` to the set of variables along with a corresponding `expression` used by the select statement.

### .select(expression_w_alias: string)
Parses `expression_w_alias` for the expression and aliased variable name, which it then adds (respectively) to the set of variables and corresponding expressions used by the select statement.

### .select(expressions: array of strings)
Creates a new list of select variables from the given `variables` array. Passing an empty array will effectively clear the current selection.


