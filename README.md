# spaz

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

Creating the builder
 * [`$$.ask`](#$$.ask)
 * [`$$.select`](#q.select)
 * [`$$.describe`](#$$.describe)

Building the query
 * [`.prefix`](#q.prefix)
 * [`.from`](#q.from)
 * [`.select`](#q.select)
 * [`.where`](#q.where)
 * [`.limit`](#q.limit)
 * [`.offset`](#q.offset)

Executing the query
 * [`.answer`](#q.answer) - for ASK queries
 * [`.rows`](#q.rows) - for SELECT queries
 * [`.browse`](#q.browse) - for DESCRIBE queries


---------------------------------------
<a name="$$.ask" />

### $$.ask(...patterns: mixed)
Creates a builder for an ASK query, then calls `.where(patterns)`.

---------------------------------------
<a name="$$.select" />

### $$.select(...select_args: mixed)
Creates a builder for a SELECT query, then calls `.select(select_args)`.

---------------------------------------
<a name="$$.describe" />

### $$.decsribe(...patterns: mixed)
Creates a builder for a DESCRIBE query, then calls `.where(patterns)`.

---------------------------------------
<a name="q.prefix" />

### .prefix()
Returns a hash of only the prefixes defined on this builder.

### .prefix(include_global: boolean)
If `include_global` is true, returns a combined hash of the prefixes defined both on this builder and on this spaz instance; otherwise returns same as `.prefix()`

### .prefix(prefixes: hash)
Adds all key/value pairs in `prefixes`. Expects each key to be the prefix name without the ':' character at the end, and each value to be the full URI without '<' and '>' characters enclosed.

### .prefix.clear()
Clears all prefixes defined on this builder. Does not affect prefixes defined on this spaz instance.

### .prefixes
An alias for `.prefix`

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

### .from.clear()
Clears all graphs from dataset clause.

---------------------------------------
<a name="q.select" />

> Only available on SELECT query types (ie: builders created with [`$$.select`]($$.select))

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

### .select.clear()
Clears all select variables & expressions.

---------------------------------------
<a name="q.where" />

> Available on all query types.

### .where()
Returns [SPARQL.js JSON representation](https://github.com/RubenVerborgh/SPARQL.js#representation) of group graph patterns as an array of objects.

### .where(...patterns: mixed)
Adds graph patterns to the existing list. See [Building Patterns](#building-patterns).

### .where.clear()
Clears all graph patterns.


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
```

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

Arrays allow nesting from the predicate (as shown above) as well as from the subject (which triggers the creation of a blanknode):
```javascript
q.where(
	['?person', 'foaf:knows', {    // this will create a blanknode
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
<a name="q.answer" />

> Only available on ASK query types (ie: builders created with [`$$.ask`]($$.ask)))

### .answer(yes_or_no: function)
Executes the ASK query, then calls `yes_or_no(answer: boolean)`

eg:
```javascript
$$.ask('ns:Banana a ns:Fruit')
	.answer(function(b_fruit) {
		if(b_fruit) {
			// yes, that triple exists
		}
		else {
			// no, triple does not exist
		}
	});
```

---------------------------------------
<a name="q.rows" />

> Only available on SELECT queries (ie: builders created with [`$$.select`]($$.select))

### .rows(each: function)
Executes the SELECT query, then calls `each(row: hash)` where `row` is an element taken from the `.bindings` array in the JSON results object.

eg:
```javascript
$$.select('?alias')
	.where('ns:Banana :alias ?alias')
	.rows(function(h_row) {
		do_something(h_row.alias);
	});
```

---------------------------------------
<a name="q.browse" />

> Only available on DESCRIBE queries (ie: builders created with [`$$.select`]($$.select))

### .browse(namespace_iri: string, ready: function)
Executes the DESCRIBE query, then calls `ready(nodes: array)` where `nodes` is an array [graphy](https://github.com/blake-regalia/graphy.js) nodes namespaced by `namespace_iri`

eg:
```javascript
$$.describe('ns:Banana')
	.browse('ns:', function(a_nodes) {
		if(!a_nodes.length) console.error('no bananas :(');
		else {
			a_nodes.forEach(function(k_node) {
				k_node.$id+' is a '+k_node.$type; // 'Banana is a Fruit'
			});
		}
	});
```

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

