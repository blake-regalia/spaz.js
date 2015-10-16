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
* [`.where`](#q.where)

---------------------------------------
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

### .select(with_expressions: boolean)
Returns a list of variables and their corresponding expressions if `with_expressions` is true; otherwise returns list of variables as array

### .select(variable: string)
Adds `variable` to the set of variables used by the select statement
	*Note:* since the query builder uses a Set to store the variables, adding a variable that is already selected will have no effect.

### .select(expression: string, alias: string)
Adds `alias` to the set of variables along with a corresponding `expression` used by the select statement.

### .select(expression_w_alias: string)
Parses `expression_w_alias` for the expression and aliased variable name, which it then adds (respectively) to the set of variables and corresponding expressions used by the select statement.

### .select(expressions: array[string])
Creates a new list of select variables from the given `variables` array. Passing an empty array will effectively clear the current selection.

---------------------------------------
<a name="q.select" />

### .where()
Returns [SPARQL.js JSON representation](https://github.com/RubenVerborgh/SPARQL.js#representation) of group graph patterns as an array of objects.

### .where(...patterns: mixed)
Adds graph patterns to the existing list. See [Building Patterns](#building-patterns).

### .where.clear()
Clears all graph patterns from the `WHERE` block.


---------------------------------------

## Building Patterns

*

### Introduction

Single pattern statements can be made using strings:
```javascript
q.where(
	'?person a foaf:Person',
	'?person foaf:name ?name',
	'?person foaf:knows ?friend',
	'?friend foaf:name "Steve Brule"^^xsd:string'
);

You can also separate the subject, predicate and object by using an array:
```javascript
q.where(
	['?person','a','foaf:Person'],
	['?person','foaf:name','?name'],
	['?person','foaf:knows','?friend'],
	['?friend','foaf:name','"Steve Brule"^^xsd:string']
);
```

Even better yet, arrays let you make nestable statements:
```javascript
q.where(
	['?person', {
		a: 'foaf:Person',
		'foaf:name': '?name',
		'foaf:knows': {    // this will create a blanknode
			'foaf:name': '"Steve Brule"^^xsd:string'
		},
	}]
);
```

Following the previous example, if you wanted to create a variable instead of a blanknode:
```javascript
q.where(
	['?person', {
		a: 'foaf:Person',
		'foaf:name': '?name',
		'foaf:knows': '?friend',
	}],
	['?friend', 'foaf:name', $$.val('Steve Brule')]
);
```
Here, `$$.val` is invoked to generate `'"Steve Brule"^^xsd:string`. See [$$.val](#$$.val) for more deatil.

Arrays allow nesting from the predicate (as shown above) as well as from the subject:
```javascript
q.where(
	['?person', 'foaf:knows', {
		'foaf:name': $$.val('Steve Brule')
	}]
);
```

The examples above only demonstrate appending triples (or in some cases, new basic graph patterns) to an existing group pattern (or empty group). For other types of patterns, groups and expressions, use these `$$.` methods:
 * [$$.graph]
 * [$$.union]
 * [$$.optional]
 * [$$.minus]
 * [$$.filter]
 * [$$.values]
 * [$$.service]
 * [$$.bind]
 * [$$.select]

---------------------------------------
<a name="$$.val" />

### $$.val(value: boolean/number/string[, type: string])
Produces a SPARQL-ready string representation of a literal value:
```javascript
$$.val(2); // '"2"^^xsd:integer'
$$.val(2.5); // '"2.5"^^xsd:decimal'
$$.val(true); // '"true"^^xsd:boolean'
$$.val('test'); // '"test"^^xsd:string'
$$.val('other','my:type'); // '"other"^^my:type'
```
