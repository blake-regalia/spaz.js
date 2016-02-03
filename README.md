# spaz

## WARNING: This package is currently under development! This README documents the current/future capabilities of this package.


## Install
```sh
$ npm install spaz
```

## Features
 * 


## Examples

### Introduction


### Terminology used in this document

 * **hash** - refers to a typical plain javascript object that has keys and values (eg: `{key: 'value'}`)
 * **list** - refers to a 1-dimensional javascript array
 * **item** - refers to an element in a javacsript array


## SPARQL Query Builder

Creating the builder
 * [`$$.ask`](#$$.ask)
 * [`$$.select`](#$$.select)
 * [`$$.describe`](#$$.describe)

Modifying the query
 * [`.prefix`](#q.prefix)
 * [`.from`](#q.from)
 * [`.select`](#q.select)
 * [`.where`](#q.where)
 * [`.values`](#q.values)
 * [`.limit`](#q.limit)
 * [`.offset`](#q.offset)

Creating graph patterns
 * [`$$.union`]
 * [`$$.minus`]
 * [`$$.graph`]

Triple helpers
 * [`$$.val`]
 * [`$$.triple`]

Executing the query
 * [`.answer`](#q.answer) - for ASK queries
 * [`.rows`](#q.rows) - for SELECT queries
 * [`.browse`](#q.browse) - for DESCRIBE queries

---------------------------------------

## N3 Serializer

Creating the builder
 * [`$$.ttl`](#$$.ttl)
 * [`$$.nquad`](#$$.nquad)

Modifying the document
 * [`.prefix`](#n.prefix)
 * [`.add`](#n.add)

Generating the document
 * [`.render`](#n.render)


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

Each `pattern` argument passed to the `.where` method is interpretted independently based on its type. The following section documents the various types of arguments the `.where` method accepts, and the implications of each.

#### Strings

Any argument that is a string (ie: `'string' === typeof pattern`), is directly added to the query's where block as raw SPARQL:
```js
q.where(
	'?person a foaf:Person',
	'?person foaf:name ?name',
	'?person foaf:knows ?friend',
	'?friend foaf:name "Steve Brule"^^xsd:string'
);
```
> These SPARQL strings will only be parsed if subsequent calls to this query builder instance require inspecting its graph patterns. Each string argument will be automatically terminated with a '.' unless it ends with one of the following characters: ',' ';' '}'


#### Arrays

To take advantage of this module's features, you can separate the subject, predicate and object by using an array:
```js
q.where(
	['?person','a','foaf:Person'],
	['?person','foaf:name','?name'],
	['?person','foaf:knows','?friend'],
	['?friend','foaf:name','"Steve Brule"^^xsd:string']
);
```

Arrays let you make nestable statements:
```js
q.where(
	// re-use `?person` as the subject for several triples
	['?person', {

		// all keys are treated as SPARQL strings
		a: 'foaf:Person', // (eg: `a` is short for `rdf:type` in SPARQL)

		// string values are also treated as SPARQL strings 
		'foaf:name': '?name', // (eg: `?name` is a variable)

		// array values indicate object lists (ie: re-using same preciate)
		'ns:alias': ['"Joe"', '"John"', '"Jo"'],

		// hash values indicate a new blanknode
		'foaf:knows': {
			'foaf:name': $$.val('Steve Brule'),
		},
	}]
);
```

This yields:
```sparql
{
	?person
		a foaf:Person ;
		foaf:name '?name' ;
		ns:alias "Joe", "John", "Jo" ;
		foaf:knows [
			foaf:name "Steve Brule"^^xsd:string
		] .
}
```
> In the example above, `$$.val` is invoked to generate `'"Steve Brule"^^xsd:string`. See [$$.val](#$$.val) for more deatil.


If you need an ordered list, you can produce an `rdf:collection` by using [$$.collection](#$$.collection)
```js
q.where(
	['?plant', {
		'ns:stages': $$.collection([
			'ns:FindSpace',
			'plant:Seed',
			'plant:Grow',
			'plant:Harvest',
		]),
	}]
);
```

Embedding a triple in an array allows nesting hashes in the predicate position (as shown above) to reuse the same subject; it also allows nesting hashes in the object position, which triggers the creation of a blanknode as shown here:
```js
q.where(
	['?person', 'foaf:knows', {    // this will create a blanknode
		'foaf:name': $$.val('Steve Brule')
	}]
);
```

You can also specify multiple objects (known as an object-list in N3) by using an array in the object position:
```js
q.where(
	['?person', {
		'foaf:alias': ['"Joe"', '"John"', '"Jo"'],
	}]
);
```

#### Hashes

A hash argument can be one of two types. Either it has a `type` property (in which case it is treated as a prescribed pattern), or it does not have a `type` property (in which case it is treated as a blanknode).

##### Hash Blanknode

To create a blanknode at the top-level:
```js
q.where(
	{
		a: 'ns:Fruit',
		'ns:color': 'color:Yellow',
		'ns:name': '?fruitName',
	}
);
```

yields:
```sparql
{
	[
		a ns:Fruit ;
		ns:color color:Yellow ;
		ns:name ?fruitName
	] .
}
```

#### Hash Prescribed Pattern
```js
q.where(
	
);
```


The examples above only demonstrate appending triples (or in some cases, new basic graph patterns) to an existing group pattern (or empty group). For other types of patterns, groups and expressions, use these `$$.` methods:
 * [$$.graph](#$$.graph)
 * [$$.union](#$$.union)
 * [$$.optional](#$$.optional)
 * [$$.minus](#$$.minus)
 * [$$.filter](#$$.filter)
 * [$$.values](#$$.values)
 * [$$.service](#$$.service)
 * [$$.bind](#$$.bind)
 * [$$.select](#$$.select)


---------------------------------------
<a name="q.values" />

> Available on all query types.

### .values()
Returns a list of the current values block. Each item in the list is a hash who's keys are variable names and values are the variables corresponding subtitution value as a ttl string.

### .values(combo: hash)
Adds the given `combo` to the existing values block. If any key in `combo` is not included in the current variable list, it will be added and all other combos that do not have said key will use an `UNDEF` as their value.

### .values(combos: array)
Adds each item in `combos` to the existing values block. Also performs the same auto-correct feature as the method above.

### .values(variable: string, data: array)
Creates a simple values block that substitues values for only a single variable. This will clear all values in the current values block.

### .values.clear()
Clears all values from the values block.

eg:
```js
q.values({fruit: ':Orange'});

q.values([
	{
		fruit: ':Banana',
		color: $$.val('yellow')
	},
	{
		fruit: ':Apple',
		color: ['color:red', '"green"'],
	},
	{
		fruit: ':Strawberry',
		color: {
			type: 'literal',
			value: 'red',
			datatype: 'vocab://local/color'
		}
	}
]);
```

yields:
```sparql
VALUES (?fruit ?color) {
	(:Orange UNDEF)
	(:Banana "yellow"^^xsd:string)
	(:Apple (color:red "green"))
	(:Strawberry "red"^^<vocab://local/color>)
}
```


---------------------------------------
<a name="q.answer" />

> Only available on ASK query types (ie: builders created with [`$$.ask`]($$.ask)))

### .answer(yes_or_no: function)
Executes the ASK query, then calls `yes_or_no(answer: boolean)`

eg:
```js
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
```js
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
```js
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
```js
$$.val(2); // '"2"^^xsd:integer'
$$.val(2.5); // '"2.5"^^xsd:decimal'
$$.val(true); // '"true"^^xsd:boolean'
$$.val('test'); // '"test"^^xsd:string'
$$.val('other','my:type'); // '"other"^^my:type'
```

