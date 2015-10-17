'use strict';

// native imports
let util = require('util');

// third party libraries
let merge = require('merge');
let arginfo = require('arginfo');
let sparqljs = require('sparqljs');

//
const sparql_generator = sparqljs.Generator;

// local modules
const overloader = require(__dirname+'/overloader.js');


// colored output
require('./console-color.js');


/**
* private static:
**/

// meta class setup
const __class = 'QueryBuilder';
let __namespace, __exportee, __export_symbol;

// node.js
if(typeof module !== 'undefined' && module.exports) {
	__namespace = global;
	__exportee = module;
	__export_symbol = 'exports';
}


// class constants


// the following regular expressions were optimized for javascript from (http://www.w3.org/TR/sparql11-query/#sparqlGrammar)

// symbols
const S_PN_CHARS_BASE = '[A-Za-z\\ux00C0-\\ux00D6\\ux00D8-\\ux00F6\\ux00F8-\\ux02FF\\ux0370-\\ux037D\\ux037F-\\ux1FFF\\ux200C-\\ux200D\\ux2070-\\ux218F\\ux2C00-\\ux2FEF\\ux3001-\\uxD7FF\\uxF900-\\uxFDCF\\uxFDF0-\\uxFFFD\\ux10000-\\uxEFFFF]';
const S_PN_CHARS_U = S_PN_CHARS_BASE.slice(0,-1)+'_]';
const S_VARNAME_X = '0-9\\u00B7\\u0300-\\u036F\\u203F\\u2040';
const S_PN_CHARS = S_PN_CHARS_U.slice(0,-1)+S_VARNAME_X+'\\-]';
const S_PN_PREFIX = S_PN_CHARS_BASE+'(?:'+S_PN_CHARS.slice(0,-1)+'\\.]*'+S_PN_CHARS+')?';
const S_PLX = '%[0-9A-Fa-f]{2}|\\\\[_~.\\-!$&\'()|*+,;=/?#@%]';
const S_PN_LOCAL = S_PN_CHARS_U+'|[.0-9]|'+S_PLX+'(?:(?:'+S_PN_CHARS+'|[.:]|'+S_PLX+')*(?:'+S_PN_CHARS+'|[:]|'+S_PLX+'))?';
const S_PNAME_LN = '('+S_PN_PREFIX+')?:('+S_PN_LOCAL+')?';

// patterns
const S_VARNAME = S_PN_CHARS_U.slice(0,-1)+'0-9]'+S_PN_CHARS_U.slice(0,-1)+S_VARNAME_X+']*';

// helpers
const S_VAR = '(?:[\\?\\$]?)('+S_VARNAME+')';

// productions
const R_VAR = new RegExp('^'+S_VAR+'$');
const R_EXPRESSION = new RegExp('^(.*)\\s+[Aa][Ss]\\s+'+S_VAR+'$');
const R_PREFIX = new RegExp('^('+S_PN_PREFIX+')?:$');
const R_PREFIXED_NAME = new RegExp('^'+S_PNAME_LN+'$');
const R_IRIREF = /^<([^\s>]+)>$/;

const R_VALUE_METADATA = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)(?:@([A-Za-z]+(?:-[A-Za-z0-9]+)*)|(?:\^\^([^]+)))?$/;

//
const A_PATTERN_TYPES = new Set([
	'bgp',
	'minus',
	'filter',
	'optional',
]);


//
const assert_integer = (z_int, s_who) => {

	// numeric
	if('number' === typeof z_int) {

		// integer
		if(0 === z_int % 1) {
			return true;
		}
		// non-integer
		else {
			debug.error(s_who+' requires an integer. instead got '+z_int);
		}
	}
	// not a number
	else {
		debug.error(s_who+' requires a number. instead got '+arginfo(z_int));
	}

	// default
	return false;
};


//
const map_to_hash = (h_map) => {

	// create plain object (hash)
	var h_hash = {};

	// iterate keys of map
	for(let [s_key, z_value] of h_map) {

		// push each key/value pair to hahs
		h_hash[s_key] = z_value;
	}

	//
	return h_hash;
};


//
const add_methods = (d_class, h_methods) => {

	// process hash map
	Object.keys(h_methods).forEach((s_method) => {

		// add method to class' prototype
		d_class.prototype[s_method] = h_methods[s_method];
	});
};


// inspried by: http://www.w3.org/TeamSubmission/n3/
const H_PREDICATE_ALIASES = new Map([
	['a', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'],
	['=', 'http://www.w3.org/2002/07/owl#sameAs'],
	['=>', 'http://www.w3.org/2000/10/swap/log#implies'],
	// ['<=', 'http://www.w3.org/2000/10/swap/log#implies'], // not supported
]);



/**
* @class QueryBuilder
* using closure for private methods and fields
**/
const __construct = function(h_query) {

	/**
	* private:
	**/

	// set query type
	const s_query_type = h_query.type.toLowerCase();

	// set parent
	const h_parent = h_query.parent;

	// prefixes
	let h_prologue_prefixes = new Map();

	// dataset clause [from]
	let a_from_default = new Set();
	let a_from_named = new Set();

	// where clause
	let a_where_ggps = [];

	// group, having, order clauses
	let a_group_conditions = new Set();
	let a_having_conditions = new Set();
	let a_order_conditions = new Set();

	// values clause
	let h_values_data = new Map();

	//
	let k_query_producer = new query_producer();


	//
	let i_global_blanknode = 0;

	//
	const next_blanknode = () => {
		// while(i_global_blanknode)
		return '_:b'+(i_global_blanknode++);
	};



	//
	const add_prefix_item = (s_name, s_iri) => {

		// prefix already defined locally
		if(h_prologue_prefixes.has(s_name)) {

			// prefixes are not identical
			if(h_prologue_prefixes.get(s_name) !== s_iri) {

				// issue warning
				debug.warn(`overwriting a local prefix will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing '${s_name}' prefix from <${h_prologue_prefixes.get(s_name)}> to <${s_iri}>`);
			}
		}
		// prefix not yet defined (locally)
		else {

			// prefix already defined globally
			if(h_parent.prefix.has(s_name)) {
				
				// issue warning
				debug.warn(`overriding a global prefix by using a local one with the same name will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing '${s_name}' prefix from <${h_parent.prefix.get(s_name)}> to <${s_iri}>`);
			}
		}

		// set the mapping no matter what
		h_prologue_prefixes.set(s_name, s_iri);	
	};


	//
	const add_prologue_prefix = (z_prefix) => {

		// SPARQL string prefix
		if('string' === typeof z_prefix) {

			// split prefix name from iri
			let [s_name, s_iri] = z_prefix.trim().split(/\s+/);

			// match prefix regex
			let m_name = R_PREFIX.exec(s_name);

			// bad prefix name
			if(!m_name) {
				return debug.fail('failed to match SPARQL prefix name: '+arginfo(s_name));
			}

			// match iri regex
			let m_iriref = R_IRIREF.exec(s_iri);

			// bad iri
			if(!m_iriref) {
				return debug.fail('failed to match SPARQL prefix iri ref: '+arginfo(s_iriref));
			}

			//
			add_prefix_item(m_name[1] || '', m_iriref[1]);
		}
		// hash
		else if('object' === typeof z_prefix) {

			// each item
			for(let s_name in z_prefix) {
				
				// ref iri
				let s_iri = z_prefix[s_name];

				// assert string
				if('string' !== typeof s_iri) {
					return debug.fail('prefix iri must be [string]. for "'+s_name+'" key it received: '+arginfo(s_iri));
				}

				//
				add_prefix_item(s_name, s_iri);
			}
		}
		// other
		else {
			return debug.fail('prefix argument must be [string] or [object]. instead got: '+arginfo(z_prefix));
		}
	};


	// 
	const serialize_prefixes = () => {

		// merge global prefixes with local ones
		return merge(
			h_parent.prefix(),
			map_to_hash(h_prologue_prefixes)
		);
	};


	//
	const expanded = (s_iri) => {

		// variable or blanknode
		if('?' === s_iri[0] || '_:' === s_iri.substr(0,2)) {
			return s_iri;
		}
		// full uri
		else if(R_IRIREF.test(s_iri)) {

			// trim angle brackets
			return s_iri.substring(1,s_iri.length-1);
		}
		// value
		else if('"' === s_iri[0]) {

			// no type
			if('"' === s_iri[s_iri.length-1]) {
				return s_iri;
			}

			// match value metadata
			let m_value_metadata = R_VALUE_METADATA.exec(s_iri);

			// bad match
			if(!m_value_metadata) {
				return debug.fail('failed to parse SPARQL literal: '+arginfo(s_iri));
			}

			// destruct match
			let [, s_value, s_language, s_type] = m_value_metadata;

			// prepare final uri
			let p_uri = s_value;

			// language tag was specified
			if(s_language) {
				p_uri += '@'+s_language;
			}
			// type was specified (do not enclose url with angle brackets since sparqljs treats these as full irirefs)
			else if(s_type) {
				p_uri += '^^'+expanded(s_type);
			}

			//
			return p_uri;
		}
		// prefixed name
		else {

			// split by colon
			let [s_name, s_path] = s_iri.split(':');

			// attempt locally defined prefix
			let s_ref_base = h_prologue_prefixes.get(s_name);

			// not defined locally
			if(!s_ref_base) {

				// try globally
				s_ref_base = h_parent.prefix.get(s_name);

				// not defined globally either
				if(!s_ref_base) {
					return debug.fail('no such prefix defined "'+s_name+'"');
				}
			}

			// build full iri
			return s_ref_base+s_path;
		}
	};

	// expands predicate
	const expanded_predicate = (s_iri) => {

		// shortcut keyword
		let p_expanded_keyword = H_PREDICATE_ALIASES.get(s_iri);
		if(p_expanded_keyword) {
			return p_expanded_keyword;
		}

		// regular expand
		return expanded(s_iri);
	};


	//
	const serialize_raw_triple = (a_triple) => {
		return {
			subject: expanded(a_triple[0]),
			predicate: expanded_predicate(a_triple[1]),
			object: expanded(a_triple[2]),
		};
	};

	//
	const serialize_triples = (a_triple) => {

		// ref object of triple
		let z_object = a_triple[2];

		// object is a string (easy!)
		if('string' === typeof z_object) {
			return [serialize_raw_triple(a_triple)];
		}
		// object is hash
		else if('object' === typeof z_object) {
			return serialize_blanknode(a_triple);
		}
	};

	//
	const serialize_blanknode = (a_triple) => {

		// acquire new blanknode id
		var s_blanknode_id = next_blanknode();

		// prepare to store results and create root triple
		let a_results = [
			serialize_raw_triple([a_triple[0], a_triple[1], s_blanknode_id])
		];

		// ref object of triple
		let z_blanknode = a_triple[2];

		// create all subsequent triples
		if('object' === typeof z_blanknode) {

			// each predicate/object pair
			for(let s_predicate in z_blanknode) {

				// serialize this triple
				a_results.push(
					serialize_triples([s_blanknode_id, s_predicate, z_blanknode[s_predicate]])
				);
			}
		}
		// unsupported type
		else {
			debug.fail('blanknode creation does not support non-object type: '+arginfo(z_blanknode));
		}

		//
		return a_results;
	};

	//
	const serialize_nested_pairs = (a_root) => {

		// ref subject
		let s_subject = a_root[0];

		// ref predicate/object pairs
		let h_pairs = a_root[1];

		// prepare to store results
		let a_results = [];

		// each item in predicate/object pair
		for(var s_predicate in h_pairs) {

			// serialize this triple (append each item to existing triple group)
			a_results = a_results.concat.apply(a_results,
				serialize_triples([s_subject, s_predicate, h_pairs[s_predicate]])
			);
		}

		// return triples as array
		return a_results;
	};

	// sanitizes input from user in order to create serialized group graph pattern
	const serialize_group_graph_pattern = (z_group) => {

		// triple via array
		if(Array.isArray(z_group)) {

			// subject must be a string
			if('string' !== typeof z_group[0]) {
				return debug.fail('the subject of a triple-wannabe array must be a [string]. instead got: '+arginfo(z_group[0]));
			}

			// nestable statement
			if(2 === z_group.length && 'object' === typeof z_group[1]) {

				// forward to pair serializer
				return {
					type: 'bgp',
					triples: serialize_nested_pairs(z_group),
				};
			}

			// otherwise must be a triple
			if(3 !== z_group.length) {
				return debug.fail('encountered triple-wannabe array that does not have exactly three items: '+arginfo(z_group));
			}

			// predicate must be a string
			if('string' !== typeof z_group[1]) {
				return debug.fail('the prediate of a triple-wannabe array must be a [string]. instead got: '+arginfo(z_group[1]));
			}

			// forward to actual serializer
			return {
				type: 'bgp',
				triples: serialize_triples(z_group),
			};
		}
		// triple via SPARQL string
		else if('string' === typeof z_group) {

			// split the string by whitespace
			let a_triple = z_group.trim().split(/\s+/);

			// must be a triple
			if(3 !== a_triple.length) {
				return debug.fail('splitting this SPARQL triple by whitespace did not yield exactly three items: '+arginfo(z_group));
			}

			// forward to actual serializer
			return {
				type: 'bgp',
				triples: serialize_triples(a_triple),
			};
		}
		// special type
		else if('object' === typeof z_group && 'string' === typeof z_group.type) {

			// ref type
			let s_type = z_group.type.toLowerCase();

			// unrecognized pattern type
			if(!A_PATTERN_TYPES.has(s_type)) {
				return debug.fail('serializer does not recognize "'+s_type+'" type pattern block');
			}

			// work here is done
			return z_group;
		}
		// prefix resolver
		else if('function' === typeof z_group) {

			// apply resolver function
			return z_group.apply({

				// pass function means to serialize it's patterns
				serialize: function(s_type, a_patterns) {
					return {
						type: s_type,
						patterns: a_patterns.map((z_pattern) => {
							return serialize_group_graph_pattern(z_pattern)
						})
					};
				},
			});
		}
		// 
		else {
			debug.fail('serializer does not recognize argument as a valid serialized SPARQL object: '+arginfo(z_group));
		}
	};


	//
	const clear_from_graphs = () => {

		// clear default graphs
		a_from_default.clear();

		// clear named graphs
		a_from_named.clear();
	};


	//
	const add_from_graph = (z_graph) => {

		// add a default graph
		if('string' === typeof z_graph) {
			a_from_default.add(z_graph);
		}
		// add default/named graphs
		else if('object' === typeof z_graph) {

			// add named graph(s)
			if(z_graph.hasOwnProperty('named')) {

				// ref named value
				let z_named = z_graph.named;

				// single named graph
				if('string' === typeof z_named) {
					a_from_named.add(z_named);
				}
				// named graph array
				else if(Array.isArray(z_named)) {

					// empty array
					if(0 === z_named.length) {

						// clear named graphs
						a_from_named.clear();
					}
					// multiple named graphs
					else {

						// each item
						z_named.forEach((p_graph) => {

							// indeed a string (iri path)
							if('string' === typeof p_graph) {
								a_from_named.add(p_graph)
							}
							// not a string!
							else {
								debug.error('invalid from named graph item: '+arginfo(p_graph));
							}
						});
					}
				}
				// bad value in named graph object
				else {
					debug.error('from named graph value must be a [string] or [Array]; instead got: '+arginfo(z_named));
				}
			}

			// add default graph(s)
			if(z_graph.hasOwnProperty('default')) {

				// ref default value
				let z_default = z_graph.default;

				// single named graph
				if('string' === typeof z_default) {
					a_from_default.add(z_default);
				}
				// default graph array
				else if(Array.isArray(z_default)) {

					// empty array
					if(0 === z_default.length) {

						// clear default graphs
						a_from_default.clear();
					}
					// multiple default graphs
					else {

						// each item
						z_default.forEach((p_graph) => {

							// indeed a string (iri path)
							if('string' === typeof p_graph) {
								a_from_default.add(p_graph)
							}
							// not a string!
							else {
								debug.error('invalid from default graph item: '+arginfo(p_graph));
							}
						});
					}
				}
				// bad value in named graph object
				else {
					debug.error('from default graph value must be a [string] or [Array]; instead got: '+arginfo(z_default));
				}
			}
		}
		// bad graph value
		else {
			debug.error('cannot add from graph: '+arginfo(z_graph));
		}
	};


	//
	const serialize_from_graphs = () => {

		// return plain object (hash) of default and named graphs as arrays
		return {
			default: Array.from(a_from_default),
			named: Array.from(a_from_named),
		};
	};


	//
	const add_values_data = (z_block) => {

		// direct SPARQL block
		if('string' === typeof z_block) {

			// TODO: parse block
		}
		// key/value map
		else if('object' === typeof z_block) {

			// each item
			for(let [s_var, z_data] in z_block) {

				// prepare ref to set of values for this var
				let a_data;

				// map indeed has this key
				if(h_values_data.has(s_var)) {

					// set ref
					a_data = h_values_data.get(s_var);
				}
				// map does not have this key yet
				else {

					// create new set
					a_data = new Set();

					// store it in the map
					h_values_data.set(s_var, a_data);
				}

				// data is array
				if(Array.isArray(z_data)) {

					// append each item to the set
					z_data.forEach((s_value) => {

						// assert type
						if('string' === typeof s_value) {
							a_data.add(s_value);
						}
						// non-string
						else {
							debug.error('values clause expects data to be [string]. instead got: '+arginfo(s_value));
						}
					});
				}
				// item is string
				else if('string' === typeof z_block) {

					// append to set
					a_data.add(s_value);
				}
			}
		}
		// unexpected type
		else {
			debug.fail('values argument must be either [string] or [object]. instead got: '+arginfo(z_block));
		}
	};


	// all queries extend this class
	class basic_query {

		//
		constructor(s_type) {

			// set query type
			this.query_type = s_type;

			// add `.clear` method to `where`
			this.where.clear = () => {

				// allow user to clear all graph patterns
				a_where_ggps.length = 0;

				// enable chaining
				return this;
			};
		}

		// don't use BASE, ever.
		base() {

			//
			debug.fail('spaz does not support using the BASE keyword in SPARQL. Instead, use a PREFIX by invoking the .prefix() method');
		}

		// specifiy where clause
		where(...a_groups) {

			// empty-args getter
			if(0 === a_groups.length) {
				return a_where_ggps;
			}

			//
			a_groups.forEach((z_group) => {

				//
				let h_ggp = serialize_group_graph_pattern(z_group);

				//
				let h_previous = a_where_ggps[a_where_ggps.length-1];

				// previous ggp exists & is of same type
				if(h_previous && h_previous.type === h_ggp.type) {

					// triples
					if(Array.isArray(h_ggp.triples)) {

						// append triples onto existing previous group
						h_previous.triples = h_previous.triples.concat.apply(h_previous.triples, h_ggp.triples);
					}
					// patterns
					else if(h_ggp.patterns) {

						// append patterns onto existing previous group
						h_previous.patterns = h_previous.patterns.concat.apply(h_previous.patterns, h_ggp.patterns);
					}
					// uh-oh
					else {
						debug.warn('not sure what to do with '+h_ggp.type+' block because it doesn\'t have triples or patterns to merge. this is probably my fault');
					}
				}
				// previous ggp is non-existent or different type
				else {

					// append new ggp
					a_where_ggps.push(h_ggp);
				}
			});

			//
			return this;
		}

		// limit clause
		limit(n_size) {
			if(assert_integer(n_size, 'limit')) {
				n_limit = n_size;
			}
		}

		// offset clause
		offset(n_amount) {
			if(assert_integer(n_amount, 'offset')) {
				n_offset = n_amount;
			}
		}

		// values clause
		values(...a_values) {
			
		}

		toString() {
			return this.query_type+' query';
		}

		// dummy abstract method
		serialize_variables() {
			return [];
		}

		//
		serialize() {

			// empty-args getter
			return {
				type: 'query',
				queryType: s_query_type.toUpperCase(),
				prefixes: serialize_prefixes(),
				variables: this.serialize_variables(),
				from: serialize_from_graphs(),
				where: a_where_ggps,
			};
		}

		toSparql(h_options) {
			let s_break = ' ';
			let s_indent = '';
			if(h_options.pretty) {
				s_break = '\n';
				s_indent = '\t';
			}
			query_producer.produce(s_break, s_indent);
		}

		dump() {
			debug.info(this.toSparql());
		}
	};


	// add methods to basic query class
	add_methods(basic_query, {

		// adds prefixes to this query's internal map
		prefix: overloader({

			// reset local prefixes, then add new ones
			reset: (a_items) => {

				// clear local prefixes
				h_prologue_prefixes.clear();

				// apply each item in the array
				a_items.forEach(add_prologue_prefix);
			},

			// returns set of prefixes
			fetch: {

				// return only local prefixes as hash
				soft: () => {
					return map_to_hash(h_prologue_prefixes);
				},

				// return both local and global prefixes as hash
				hard: serialize_prefixes,
			},

			// add new prefixes
			add: (a_prefixes) => {
				a_prefixes.forEach(add_prologue_prefix);
			},
		}),

		// specify graph(s) to query from
		from: overloader({

			reset: (a_items) => {

				// clear all from graphs
				clear_from_graphs();

				// apply each item in the array
				a_items.forEach(add_from_graph);
			},

			fetch: {

				// return all graphs (default and named) as list
				soft: () => {
					return Array.from(a_from_default).concat(Array.from(a_from_named));
				},

				// return graphs as hash
				hard: () => {
					return serialize_from_graphs();
				},
			},

			// add graphs
			add: (a_graphs) => {
				a_graphs.forEach(add_from_graph);
			},
		}),

		// values clause
		values: overloader({

			reset: (a_items) => {

				// clear values
				h_values_data.clear();

				// apply each item in array
				a_items.forEach(add_values_data);
			},

			// simply convert map => hash
			fetch: () => {
				return map_to_hash(h_values_data);
			},

			// add values data
			add: (a_values) => {
				a_values.forEach(add_values_data);
			},
		}),
	});


	// clause conditioner [group, having, order]
	(() => {

		// set which clauses map to which private fields
		let h_condition_clauses = {
			group: a_group_conditions,
			having: a_having_conditions,
			order: a_order_conditions,
		};

		// process hash map
		Object.keys(h_condition_clauses).forEach((s_method) => {

			// ref condition set
			let a_these_conditions = h_condition_clauses[s_method];

			// prepare add condition function
			let add_this_condition = (s_condition) => {

				// strong type string
				if('string' === typeof s_condition) {
					a_these_conditions.add(s_condition);
				}
				// non-string
				else {
					debug.error(s_method+' clause expects a [string] condition. instead got: '+arginfo(s_condition));
				}
			};

			// extend basic query class prototype with new method (must use `function` keyword! so that `this` is contextual)
			basic_query.prototype[s_method] = overloader({

				reset: (a_items) => {

					// clear conditions
					a_these_conditions.clear();

					// apply each item in the array
					a_items.forEach(add_this_condition);
				},

				fetch: () => {

					// simple convert set => array
					return Array.from(a_these_conditions);
				},

				// add conditions
				add: (a_conditions) => {
					a_conditions.forEach(add_this_condition);
				},
			});

		});
	})();


	// ask query
	if('ask' === s_query_type) {

		// done!
		return new basic_query(s_query_type);
	}
	// select query
	else if('select' === s_query_type) {

		// private fields for select query class
		let a_select_variables = new Set();
		let h_select_expressions = new Map();


		//
		const clear_select_expressions = () => {

			// clear variables set
			a_select_variables.clear();

			// clear expressions map
			h_select_expressions.clear();
		};


		//
		const add_select_expression = (z_expression) => {

			// argument passed as hash
			if('object' === typeof z_expression) {

				// iterate hash
				for(let s_key in z_expression) {

					// match variable key
					let m_var = R_VAR.exec(s_key);
					if(m_var) {

						// prepend variable with '?' character
						let s_var = '?'+m_var[1];

						// add variable to list
						a_select_variables.add(s_var);

						// set mapping for corresponding expression
						h_select_expressions.set(s_var, z_expression[s_key]);
					}
					// key doesn't match
					else {
						debug.fail('"'+s_key+'" is an invalid name for a SPARQL variable');
					}
				}
			}
			// argument passed as string
			else if('string' === typeof z_expression) {

				// first try to match simple variable regex
				let m_var = R_VAR.exec(z_expression);

				// simple variable match
				if(m_var) {

					// destructure capture groups from match
					let [, s_var] = m_var;

					// prepend variable with '?' character
					s_var = '?'+s_var;

					// an expression already exists that is aliasing variable
					if(h_select_expressions.has(s_var)) {

						// remove that expression
						h_select_expressions.delete(s_var);
					}

					// add simple variable to set
					a_select_variables.add(s_var);
				}
				// either expression or invalid variable name
				else {

					// try match expression regex
					let m_expression = R_EXPRESSION.exec(z_expression);

					// expression match
					if(m_expression) {

						// destructure capture groups from match
						let [, s_expr, s_var] = m_expression;

						// prepend variable with '?' character
						s_var = '?'+s_var;

						// update select variable/expression
						a_select_variables.add(s_var);
						h_select_expressions.set(s_var, s_expr);
					}
					// invalid variable/expression
					else {
						debug.fail('"'+z_expression+'" is either an invalid name for a SPARQL variable, or is an invalid expression to use in a SELECT clause');
					}
				}
			}
			// argument pass as other
			else {
				return debug.fail('must pass [string] to select expression. instead got: '+arginfo(z_expression));
			}
		};


		//
		const serialize_select_expressions = () => {

			// create array
			let a_serial = [];

			// iterate variables to create keys for hash
			for(var s_var of a_select_variables) {

				// this variable has a corresponding expression
				if(h_select_expressions.has(s_var)) {

					// set key/value pair in plain object
					a_serial.push({
						expression: h_select_expressions.get(s_var),
						variable: s_var,
					});
				}
				// simple variable
				else {

					// set dummy value for simple variable as key
					a_serial.push(s_var);
				}
			}

			// 
			return a_serial;
		};

		//
		return new (class extends basic_query {

			//
			constructor(s_type) {
				super(s_type);
			}

			// sets the expressions used for select query
			select(...z_select) {

				// ref args length and 0th arg
				let n_args = z_select.length;
				let z_arg0 = z_select[0];

				// single argument
				if(n_args === 1) {

					// clear current selection and select all fields instead
					if('*' === z_arg0) {
						clear_select_expressions();
					}
					// replace current selection
					else if(Array.isArray(z_arg0)) {

						// clear current selection
						clear_select_expressions();

						// apply method to each item
						z_arg0.forEach(add_select_expression);
					}
					// append to current selection
					else if('string' === typeof z_arg0 || 'object' === typeof z_arg0) {
						add_select_expression(z_arg0);
					}
					// fetch current select expression as hash
					else if(true === z_arg0) {
						return serialize_select_expressions();
					}
					// fetch current variable list as an array
					else if(false === z_arg0) {
						return Array.from(a_select_variables);
					}
					// 
					else {
						debug.fail('select does not work on: '+arginfo(z_arg0));
					}
				}
				// no args: fetch current variable list as an array
				else if(!n_args) {
					return Array.from(a_select_variables);
				}
				// more than 1 argument
				else {

					// forward all items
					z_select.forEach(add_select_expression);
				}

				// enable chaining
				return this;
			}

			// sets distinct on or off (use of DISTINCT keyword in select clause)
			distinct(b_use_distinct=false) {
				b_select_distinct = b_use_distinct? true: false;
				return this;
			}

			// sets reduced on or off (use of REDUCED keyword in select clause)
			reduced(b_use_reduced=false) {
				b_select_reduced = b_use_reduced? true: false;
				return this;
			}

			//
			serialize_variables() {
				return serialize_select_expressions();
			}

		})(s_query_type);

	};

	// /**
	// * public operator() ():
	// **/
	// const operator = function() {

	// };


	// /**
	// * public:
	// **/
	// {




	// 	// 
	// 	limit() {

	// 	},	
	// };
};


/**
* public static operator() ():
**/
const debug = __exportee[__export_symbol] = function() {

	// called with `new`
	if(this !== __namespace) {
		return __construct.apply(this, arguments);
	}
	// called directly
	else {
		return debug.fail('not allowed to call '+debug+' without `new` operator');
	}
};

/**
* public static:
**/
{

	// 
	debug['toString'] = function() {
		return __class+'()';
	};

	// prefix output messages to console with class's tag
	require('./log-tag.js').extend(debug, __class);
}