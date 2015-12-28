// native imports
import util from 'util';

// libraries
import arginfo from 'arginfo';
import merge from 'merge';
import rapunzel from 'rapunzel';

// local modules
import overloader from './overloader';
import query_patterns from './query-patterns';


/**
* private static:
**/

// meta class setup
const __class_name = 'QueryBuilder';


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

const R_COMPRESS_SPARQL = /\s+(?!\w*:|(?:in|from|named|where|a)\b)|\.\s*(})|([>])\s+(?=:_)/g;

//
const A_PATTERN_TYPES = new Set([
	'bgp',
	'minus',
	'filter',
	'optional',
	'union',
	'graph',
	'exists',
	'notexists',
	'bind',
]);


//
const turtlize = (h_thing) => {
	switch(h_thing.type) {
		case 'uri':
		case 'iri':
			return '<'+h_thing.value+'>';
		case 'literal':
		case 'typed-literal':
			return '"'+h_thing.value.replace(/"/g, '\\"')+'"'+(h_thing.datatype? '^^<'+h_thing.datatype+'>': '');
	}
};


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
			local.error(s_who+' requires an integer. instead got '+z_int);
		}
	}
	// not a number
	else {
		local.error(s_who+' requires a number. instead got '+arginfo(z_int));
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


// creates a pattern handler for simple types
const simple_pattern = (s_type) => {

	// return pattern handler
	return (add, h_gp) => {

		// open clause
		add.open(s_type+(add.pretty? ' ': '')+'{');

		// each pattern
		h_gp.patterns.forEach((h_pattern) => {

			// pass query producing torch to next pattern
			produce_pattern(add, h_pattern);
		});

		// close block
		add.close('}');
	};
};

//
const sparql_entity = (z_item) => {

	// 
	switch(z_item[0]) {
		case '?': // variable
		case '$': // variable
		case '"': // literal
		case '(': // list
		case '<': // iri ref
			return z_item;

		case '_': // blanknode
			if(':' !== z_item[1]) { // iri ref
				return '<'+z_item+'>';
			}
			return z_item;

		default: // iri ref
			return '<'+z_item+'>';
	}
};


//
const stringify_expression = (add, z_expression) => {

	// SPARQL-ready expression
	if('string' === typeof z_expression) {
		return add(z_expression, true);
	}
	// JSON object
	else if('object' === typeof z_expression) {

		// depending on expression type
		switch(z_expression.type) {

			case 'operation':

				// ref operator
				let s_operator = z_expression.operator;

				// ref args
				let z_args = z_expression.arguments;

				// 
				switch(s_operator) {

					// infix operators
					case '>': case '<': case '>=': case '<=':
					case '&&': case '||': case '=': case '!=':
					case '+': case '-': case '*': case '/':

						// to each argument...
						z_args.forEach((z_arg, i_arg) => {

							// pass the torch
							stringify_expression(add, z_arg);

							// not the last arg
							if(i_arg < z_args.length-1) {

								// join by operator
								add(s_operator, true);
							}
						});
						return;

					// unary operators
					case '!':

						// start with operator
						add(s_operator, true);

						// stringify the only arg
						stringify_expression(add, z_args[0]);
						return;
 
					// in/not in
					case 'in': case 'not in':

						// stringify lhs
						stringify_expression(add, z_args[0]);

						// add operator & open list
						add(' '+s_operator+' (', true);

						// stringify rhs
						z_args[1].forEach((z_arg, i_arg, a_list) => {

							// pass the torch
							stringify_expression(add, '<'+z_arg+'>');

							// not the last list item
							if(i_arg < a_list.length-1) {

								// join by comma
								add(', ', true);
							}
						});

						// close list
						add(')', true);
						return;

					// exists/not exists
					case 'exists': case 'not exists':

						// open block
						add.open(s_operator+(add.pretty? ' ': '')+'{', '', true);

						// each pattern..
						z_args.forEach((h_gp) => {

							// pass torch to pattern producer
							produce_pattern(add, h_gp);
						});

						// close block
						add.close('}');
						return;

					//
					default:
						local.fail('expression cannot stringify unrecognized operator: '+s_operator);
						return;
				}
				return;

			case 'functionCall':
				add(`${z_expression.function}(${z_expression.arguments.join(', ')})`, true);
				break;
		}
	}
	//
	else {
		local.fail('filter expects all expressions to be either [string] or [object], instead got: '+arginfo(z_expression));
	}
};


//
const H_PATTERNS = {

	// basic graph pattern
	bgp: (add, h_gp) => {

		//
		let s_terminate = (add.pretty? ' ': '')+'.';

		// each triple in pattern
		h_gp.triples.map((h_triple) => {

			//
			if(Array.isArray(h_triple)) {

				// SPARQL-ready array
				add(h_triple.join(' ')+s_terminate);
			}
			else {

				//
				add(sparql_entity(h_triple.subject)
					+' '+sparql_entity(h_triple.predicate)
					+' '+sparql_entity(h_triple.object)
					+(h_triple.datatype? '^^<'+h_triple.datatype+'>': '')
					+s_terminate);
			}
		});
	},

	//
	graph: (add, h_gp) => {
		return simple_pattern('graph <'+h_gp.graph+'>')(add, h_gp);
	},

	//
	query: (add, h_gp) => {

		if('select' === h_gp.queryType.toLowerCase()) {

			//
			add.open('select ');

			//
			h_gp.variables.forEach((z_var) => {
				if('string' === typeof z_var) {
					local.fail('not yet supported!');
				}
				else if('object' === typeof z_var) {
					add('(');
					stringify_expression(add, z_var.expression);
					add(' as '+z_var.variable+')', true);
				}
			});

			//
			add.close('');
			add.open('where {');

			h_gp.where.forEach((h_pattern) => {
				H_PATTERNS[h_pattern.type](add, h_pattern);
			});

			add.close('}');
		}
	},

	//
	bind: (add, h_gp) => {

		if('string' === typeof h_gp.expression) {
			add('bind('+h_gp.expression+' as '+h_gp.variable+')');
		}
		else {
			local.fail('bind does not support serialized blocks');
		}
	},

	// group block
	group: simple_pattern(''),

	// minus block
	minus: simple_pattern('minus'),

	// optional block
	optional: simple_pattern('optional'),

	// 
	union: (add, h_gp) => {

		// each pattern
		h_gp.patterns.forEach((h_pattern, i_pattern) => {

			// open group/union block
			add.open((0 === i_pattern? '': 'union ')+'{');

			// pass query production torch to next pattern
			produce_pattern(add, h_pattern);

			// close group block
			add.close('}');
		});
	},

	//
	filter: (add, h_gp) => {

		// ref expression
		let z_expression = h_gp.expression;

		// expression is a pattern
		let b_pattern = ('object' === typeof z_expression && ['exists','not exists'].includes(z_expression.operator));

		// open filter
		add('filter'+(add.pretty? ' ': '')+(b_pattern? '': '(')+' ');

		// pass query producing torch to stringify expression function
		stringify_expression(add, h_gp.expression);

		// close filter (if we need it)
		if(!b_pattern) {
			add(')', true);
		}
	},
};


//
const produce_pattern = (add, h_gp) => {

	// it's a string, just add it
	if('string' === typeof h_gp) {
		add(h_gp);
		return;
	}

	// ref graph pattern type
	var s_type = h_gp.type;

	// lookup pattern
	if(!H_PATTERNS[s_type]) {
		local.fail('no such pattern type: "'+s_type+'"; in '+arginfo(h_gp));
	}

	// lookup pattern and apply producer
	H_PATTERNS[s_type](add, h_gp);
};


/**
* @class QueryBuilder
* using closure for private methods and fields
**/
const __construct = function(h_init) {

	/**
	* private:
	**/

	// set parent
	const h_parent = h_init.parent;

	// set query type
	const s_query_type = h_init.type.toLowerCase();

	// prep submit type; default to table
	let s_submit_type = 'table';

	// prefixes
	let hm_prologue_prefixes = new Map();

	// dataset clause [from]
	let as_from_default = new Set();
	let as_from_named = new Set();

	// where clause
	let a_where_ggps = [];
	let a_where_last = [];

	// group, having, order clauses
	let as_group_conditions = new Set();
	let as_having_conditions = new Set();
	let as_order_conditions = new Set();

	// values clause
	let a_values_combos = [];

	// limit, offset
	let n_limit;
	let n_offset;

	// user data
	let hm_user_data = new Map();


	// load query directly from hash
	if(h_init.query) {

		// ref query
		let h_query = h_init.query;

		// prefixes
		if(h_query.prefixes) {

			// load each prefix into map
			for(let s_prefix in h_query.prefixes) {
				hm_prologue_prefixes.set(s_prefix, h_query.prefixes[s_prefix]);
			}
		}

		// from graphs
		if(h_query.from) {

			// ref from
			let h_from = h_query.from;

			// default
			if(h_from.default) {
				h_from.default.forEach(p_graph => as_from_default.add('<'+p_graph+'>'));
			}
			// named
			if(h_from.named) {
				h_from.named.forEach(p_graph => as_from_named.add('<'+p_graph+'>'));
			}
		}

		// where clauses
		if(h_query.where) {
			a_where_ggps = h_query.where;
		}

		// order by
		if(h_query.order) {
			h_query.order.forEach((h_expr) => {
				as_order_conditions.add(h_expr);
			});
		}

		// limit
		if(h_query.limit) {
			n_limit = h_query.limit;
		}

		// offset
		if(h_query.offset) {
			n_offset = h_query.offset;
		}

		// TODO: everything else later
	}


	//
	const k_query_producer = rapunzel({

		// 
		prefix: (add) => {

			// merge global and local prefixes
			let h_prefixes = new Map();
			let f_add_here = (p_uri, s_prefix) => {
				h_prefixes.set(s_prefix, p_uri);
			};
			h_parent.prefixes.forEach(f_add_here);
			hm_prologue_prefixes.forEach(f_add_here);

			// add each prefix item
			h_prefixes.forEach((p_uri, s_prefix) => {
				add(`prefix ${s_prefix}: <${p_uri}>`);
			});
		},

		//
		dataset: (add) => {

			// 
			as_from_default.forEach((s_graph_iri) => {
				add(`from ${s_graph_iri}`);
			});
			as_from_named.forEach((s_graph_iri) => {
				add(`from named ${s_graph_iri}`);
			});
		},

		//
		where: (add) => {

			// open where block
			add.open((add.pretty? 'where ': '')+'{');

			// recursively transform serialized object form to query string
			a_where_ggps.forEach((h_gp) => {

				//
				produce_pattern(add, h_gp);
			});

			// recursively transform serialized object form to query string
			a_where_last.forEach((h_gp) => {

				//
				produce_pattern(add, h_gp);
			});

			// values block
			if(a_values_combos.length) {

				// prep variables list
				let a_values_variables = [];

				// each combo
				a_values_combos.forEach((h_combo) => {

					// each key in combo
					for(let s_key in h_combo) {

						// variables list does not yet include this key
						if(!a_values_variables.includes(s_key)) {

							// add it to variables list
							a_values_variables.push(s_key);
						}
					}
				});

				// open values block
				add.open(`values (${a_values_variables.map(s => '?'+s).join(' ')}) {`);

				// each combo (once more)
				a_values_combos.forEach((h_combo) => {

					// prep combo list
					var a_combo_list = [];

					// each key in variables list
					a_values_variables.forEach((s_var) => {

						// add value to combo list
						a_combo_list.push(h_combo[s_var] || 'UNDEF');
					});

					// commit combo list
					add('('+a_combo_list.join(' ')+')');
				});

				// close values block
				add.close('}');
			}

			// close where block
			add.close('}');
		},

		solution: (add) => {

			// 
			if(as_order_conditions.size) {
				add('order by '+Array.from(as_order_conditions).join(', '));
			}

			// limit
			if(n_limit) {
				add('limit '+n_limit);
			}

			// offset
			if(n_offset) {
				add('offset '+n_offset);
			}
		},

	}, ['prefix', 'query', 'dataset', 'where', 'solution']);


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
		if(hm_prologue_prefixes.has(s_name)) {

			// prefixes are not identical
			if(hm_prologue_prefixes.get(s_name) !== s_iri) {

				// issue warning
				local.warn(`overwriting a local prefix will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing '${s_name}' prefix from <${hm_prologue_prefixes.get(s_name)}> to <${s_iri}>`);
			}
		}
		// prefix not yet defined (locally)
		else {

			// prefix already defined globally
			if(h_parent.prefix.has(s_name)) {
				
				// issue warning
				local.warn(`overriding a global prefix by using a local one with the same name will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing '${s_name}' prefix from <${h_parent.prefix.get(s_name)}> to <${s_iri}>`);
			}
		}

		// set the mapping no matter what
		hm_prologue_prefixes.set(s_name, s_iri);	
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
				return local.fail('failed to match SPARQL prefix name: '+arginfo(s_name));
			}

			// match iri regex
			let m_iriref = R_IRIREF.exec(s_iri);

			// bad iri
			if(!m_iriref) {
				return local.fail('failed to match SPARQL prefix iri ref: '+arginfo(s_iriref));
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
					return local.fail('prefix iri must be [string]. for "'+s_name+'" key it received: '+arginfo(s_iri));
				}

				//
				add_prefix_item(s_name, s_iri);
			}
		}
		// other
		else {
			return local.fail('prefix argument must be [string] or [object]. instead got: '+arginfo(z_prefix));
		}
	};


	// 
	const serialize_prefixes = () => {

		// merge global prefixes with local ones
		return merge(
			h_parent.prefix(),
			map_to_hash(hm_prologue_prefixes)
		);
	};


	// general expand
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
		// prefixed name
		else {

			// split by colon
			let [s_name, s_path] = s_iri.split(':');

			// attempt locally defined prefix
			let s_ref_base = hm_prologue_prefixes.get(s_name);

			// not defined locally
			if(!s_ref_base) {

				// try globally
				s_ref_base = h_parent.prefix.get(s_name);

				// not defined globally either
				if(!s_ref_base) {
					return local.fail('no such prefix defined "'+s_name+'"');
				}
			}

			// build full iri
			return s_ref_base+s_path;
		}
	};

	// expands subject
	const expanded_subject = (s_iri) => {

		// regular expand
		return expanded(s_iri);
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


	// expands object
	const expanded_object = (s_iri) => {

		// value
		if('"' === s_iri[0]) {

			// no type
			if('"' === s_iri[s_iri.length-1]) {
				return s_iri;
			}

			// match value metadata
			let m_value_metadata = R_VALUE_METADATA.exec(s_iri);

			// bad match
			if(!m_value_metadata) {
				return local.fail('failed to parse SPARQL literal: '+arginfo(s_iri));
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
				p_uri += '^^<'+expanded(s_type)+'>';
			}

			//
			return p_uri;
		}
		// rdf:collection
		else if('(' === s_iri[0]) {

			// just use as ttl
			return s_iri;
		}

		// regular expand
		return expanded(s_iri);
	};



	//
	const serialize_raw_triple = (a_triple) => {
		return {
			subject: expanded_subject(a_triple[0]),
			predicate: expanded_predicate(a_triple[1]),
			object: expanded_object(a_triple[2]),
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

				// concatenate each individual triple to this results list
				a_results = a_results.concat.apply(a_results, 

					// serialize this triple
					serialize_triples([s_blanknode_id, s_predicate, z_blanknode[s_predicate]])
				);
			}
		}
		// unsupported type
		else {
			local.fail('blanknode creation does not support non-object type: '+arginfo(z_blanknode));
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
				return local.fail('the subject of a triple-wannabe array must be a [string]. instead got: '+arginfo(z_group[0]));
			}

			// predicate-nested statement
			if(2 === z_group.length && 'object' === typeof z_group[1]) {

				// forward to pair serializer
				return {
					type: 'bgp',
					triples: serialize_nested_pairs(z_group),
				};
			}

			// otherwise must be a triple
			if(3 !== z_group.length) {
				return local.fail('encountered triple-wannabe array that does not have exactly three items: '+arginfo(z_group));
			}

			// predicate must be a string
			if('string' !== typeof z_group[1]) {
				return local.fail('the prediate of a triple-wannabe array must be a [string]. instead got: '+arginfo(z_group[1]));
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

			// not a triple
			if(3 !== a_triple.length) {

				// push raw SPARQL string
				return z_group;

				// return local.fail('splitting this SPARQL triple by whitespace did not yield exactly three items: '+arginfo(z_group));
			}

			// forward to actual serializer
			return {
				type: 'bgp',
				triples: serialize_triples(a_triple),
			};
		}
		// group type is object
		else if('object' === typeof z_group) {

			// special type
			if('string' === typeof z_group.type) {

				// ref type
				let s_type = z_group.type.toLowerCase();

				// unrecognized pattern type
				if(!A_PATTERN_TYPES.has(s_type)) {
					return local.fail('serializer does not recognize "'+s_type+'" type pattern block');
				}

				// work here is done
				return z_group;
			}
			// no type specified, this is actually a blanknode
			else {

				// fetch next blanknode
				let s_blanknode_id = next_blanknode();

				// prep triples array
				let a_triples = [];

				// each predicate/object pair
				for(let s_predicate in z_group) {

					// ref object
					let z_object = z_group[s_predicate];

					// serialize this triple
					let h_triple = serialize_raw_triple([s_blanknode_id, s_predicate, z_object]);

					// add it to the array
					a_triples.push(h_triple);
				}

				// bgp
				return {
					type: 'bgp',
					triples: a_triples,
				};
			}
		}
		// prefix resolver
		else if('function' === typeof z_group) {

			// apply resolver function
			return z_group.apply({

				// pass callback the means to serialize it's patterns
				serialize_pattern: function(s_type, a_patterns) {
					return {
						type: s_type,
						patterns: a_patterns.map((z_pattern) => {
							return serialize_group_graph_pattern(z_pattern);
						}),
					};
				},

				// pass callback the means to serialize a filer block
				serialize_filter: function(s_operator, a_patterns) {
					return {
						type: 'filter',
						expression: {
							type: 'operation',
							operator: s_operator,
							arguments: a_patterns.map((z_pattern) => {
								return serialize_group_graph_pattern(z_pattern);
							}),
						},
					};
				},
			});
		}
		// 
		else {
			local.fail('serializer does not recognize argument as a valid serialized SPARQL object: '+arginfo(z_group));
		}
	};


	//
	const add_from_graph = (z_graph) => {

		// add a default graph
		if('string' === typeof z_graph) {
			as_from_default.add(z_graph);
		}
		// add a list of default graphs
		else if(Array.isArray(z_graph)) {

			// each graph
			z_graph.forEach((z_item) => {
				add_from_graph(z_item);
			});
		}
		// add default/named graphs
		else if('object' === typeof z_graph) {

			// add named graph(s)
			if(z_graph.hasOwnProperty('named')) {

				// ref named value
				let z_named = z_graph.named;

				// single named graph
				if('string' === typeof z_named) {
					as_from_named.add(z_named);
				}
				// named graph array
				else if(Array.isArray(z_named)) {

					// empty array
					if(0 === z_named.length) {

						// clear named graphs
						as_from_named.clear();
					}
					// multiple named graphs
					else {

						// each item
						z_named.forEach((p_graph) => {

							// indeed a string (iri path)
							if('string' === typeof p_graph) {
								as_from_named.add(p_graph)
							}
							// not a string!
							else {
								local.error('invalid from named graph item: '+arginfo(p_graph));
							}
						});
					}
				}
				// bad value in named graph object
				else {
					local.error('from named graph value must be a [string] or [Array]; instead got: '+arginfo(z_named));
				}
			}

			// add default graph(s)
			if(z_graph.hasOwnProperty('default')) {

				// ref default value
				let z_default = z_graph.default;

				// single named graph
				if('string' === typeof z_default) {
					as_from_default.add(z_default);
				}
				// default graph array
				else if(Array.isArray(z_default)) {

					// empty array
					if(0 === z_default.length) {

						// clear default graphs
						as_from_default.clear();
					}
					// multiple default graphs
					else {

						// each item
						z_default.forEach((p_graph) => {

							// indeed a string (iri path)
							if('string' === typeof p_graph) {
								as_from_default.add(p_graph)
							}
							// not a string!
							else {
								local.error('invalid from default graph item: '+arginfo(p_graph));
							}
						});
					}
				}
				// bad value in named graph object
				else {
					local.error('from default graph value must be a [string] or [Array]; instead got: '+arginfo(z_default));
				}
			}
		}
		// bad graph value
		else {
			local.error('cannot add from graph: '+arginfo(z_graph));
		}
	};


	//
	const serialize_from_graphs = () => {

		// return plain object (hash) of default and named graphs as arrays
		return {
			default: Array.from(as_from_default),
			named: Array.from(as_from_named),
		};
	};


	//
	const add_values_combo = (z_block) => {

		// direct SPARQL block
		if('string' === typeof z_block) {

			// TODO: parse block
			local.fail('adding a VALUES block via [string] is not yet implemented');
		}
		// array
		else if(Array.isArray(z_block)) {

			// forbidden
			local.fail('.value expects each combo item to be [object]; instead got: '+arginfo(z_block));
		}
		// key/value map
		else if('object' === typeof z_block) {

			// prep combo hash
			let h_combo = {};

			// assume empty
			let b_empty = true;

			// each item
			for(let s_var in z_block) {
				let z_data = z_block[s_var];

				// not empty
				b_empty = false;

				// do not allow variable prefixes
				s_var = s_var.replace(/^[?$]/, '');

				// prep combo value
				let s_value = 'UNDEF';

				// data type is string
				if('string' === typeof z_data) {

					// direct ttl
					s_value = z_data;
				}
				// data type is hash
				else if('object' === typeof z_data) {

					// serialize data first
					s_value = turtlize(z_data);
				}
				// data type is invalid
				else {
					return local.error('VALUES clause expects data to be [string] or [object]. instead got: '+arginfo(z_data));
				}

				// set combo value
				h_combo[s_var] = s_value;
			}

			// empty object; do not add combo!
			if(b_empty) return;

			// add this combo to the values combos list
			a_values_combos.push(h_combo);
		}
		// unexpected type
		else {
			local.fail('VALUES argument must be either [string] or [object]. instead got: '+arginfo(z_block));
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

				//
				a_where_last.length = 0;

				// enable chaining
				return this;
			};
		}

		// set user data
		set(s_var, z_value) {
			hm_user_data.set(s_var, z_value);
		}

		// get user data
		get(s_var) {
			return hm_user_data.get(s_var);
		}

		// don't use BASE, ever.
		base() {

			//
			local.fail('spaz does not support using the BASE keyword in SPARQL. Instead, use a PREFIX by invoking the .prefix() method');
		}

		// limit clause
		limit(n_size) {
			if(!arguments.length) return n_limit;
			else if(assert_integer(n_size, 'limit')) {
				n_limit = n_size;
			}

			// continue chaining
			return this;
		}

		// offset clause
		offset(n_amount) {
			if(!arguments.length) return n_offset;
			else if(assert_integer(n_amount, 'offset')) {
				n_offset = n_amount;
			}

			// continue chaining
			return this;
		}


		/**
		* helpers
		**/

		// filter where
		filter(...e_exprs) {
			return this.where(
				h_parent.filter.apply(h_parent, e_exprs)
			);
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
				where: [...a_where_ggps, ...a_where_last],
			};
		}

		// 
		patterns() {
			return query_patterns({
				prefixes: hm_prologue_prefixes,
				where: [...a_where_ggps, ...a_where_last],
			});
		}

		// remove a group graph pattern from the where block by pointer
		remove_group(o_group) {
			a_where_ggps.some(function findGroup(o_pattern, i_pattern, a_container) {
				if(o_pattern === o_group) {
					a_container.splice(i_pattern, 1);
					return true;
				}
				else {
					if(a_container.patterns) {
						return a_container.patterns.some(findGroup);
					}
				}
			});
		}

		toSparql(h_options={}) {
			let s_sparql = k_query_producer.produce(h_options);
			if(h_options.meaty) {
				return s_sparql.replace(/^(\s*prefix\s*\w*:\w*\s*<[^>]+>)*\s*/, '');
			}
			return s_sparql;
		}

		sparql() {

			return this.toSparql();

			// generate the query string
			let s_query = k_query_producer.produce({
				pretty: false,
			});

			// prepare to optimize the query string
			let s_optimized = '';

			// create quoted-string finding regex
			let r_next_quote = /"(?:[^"\\]|\\.)*"/g;

			// where to start each substring to gather non-string parts of query
			let i_range_start = 0;

			// find all matches
			while(true) {

				// bookmark previous match's end
				i_range_start = r_next_quote.lastIndex;

				// find next quoted string
				let m_next_quote = r_next_quote.exec(s_query);

				// no match found; stop
				if(null === m_next_quote) break;

				// optimize non-quoted string
				s_optimized += s_query.substring(i_range_start, m_next_quote.index).replace(R_COMPRESS_SPARQL, '$1');

				// append quoted string part
				s_optimized += m_next_quote[0];
			}

			// optimize final non-quoted string
			s_optimized += s_query.substr(i_range_start).replace(R_COMPRESS_SPARQL, '$1');

			// return optimized query
			return s_optimized;
		}

		dump() {
			local.info(this.toSparql({
				pretty: true
			}));

			return this;
		}


		// general shorten
		shorten(p_iri) {

			//
			let s_best_prefix = '';
			let n_longest_url = 0;

			//
			for(let [s_prefix, p_url] of hm_prologue_prefixes) {
				if(p_iri.startsWith(p_url) && p_url.length > n_longest_url) {
					s_best_prefix = s_prefix;
					n_longest_url = p_url.length;
				}
			}

			//
			for(let [s_prefix, p_url] of h_parent.prefix.map) {
				if(p_iri.startsWith(p_url) && p_url.length > n_longest_url) {
					s_best_prefix = s_prefix;
					n_longest_url = p_url.length;
				}
			}

			//
			if(n_longest_url) {
				return s_best_prefix+':'+p_iri.substr(n_longest_url);
			}
			else {
				return '<'+p_iri+'>';
			}
		}

		// execute query shortcut
		exec(f_okay_exec) {
			h_parent.submit(this.sparql(), s_submit_type, f_okay_exec);
		}
	}


	// add methods to basic query class
	add_methods(basic_query, {

		// adds prefixes to this query's internal map
		prefix: overloader({

			// add new prefixes
			add: (...a_prefixes) => {
				a_prefixes.forEach(add_prologue_prefix);
			},

			// clear local prefixes
			clear: () => {
				hm_prologue_prefixes.clear();
			},

			// fetch prefixes
			fetch: {

				// return only local prefixes as hash
				soft: () => {
					return map_to_hash(hm_prologue_prefixes);
				},

				// return both local and global prefixes as hash
				hard: serialize_prefixes,
			},

		}),

		// specify graph(s) to query from
		from: overloader({

			// add graphs
			add: (...a_graphs) => {
				a_graphs.forEach(add_from_graph);
			},

			// clear all from graphs
			clear: () => {

				// clear default graphs
				as_from_default.clear();

				// clear named graphs
				as_from_named.clear();
			},

			// fetch from graphs
			fetch: {

				// return all graphs (default and named) as list
				soft: () => {
					return Array.from(as_from_default).concat(Array.from(as_from_named));
				},

				// return graphs as hash
				hard: () => {
					return serialize_from_graphs();
				},
			},
		}),

		// where clause
		where: overloader({

			// add group graph patterns
			add: (...a_args) => {

				// each arg
				a_args.forEach((z_arg) => {

					//
					let h_ggp = serialize_group_graph_pattern(z_arg);

					//
					let h_previous = a_where_ggps[a_where_ggps.length-1];

					// previous ggp exists & is ALSO basic graph pattern
					if('bgp' === h_ggp.type && h_previous && h_previous.type === h_ggp.type) {

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
						// filters
						else if(h_ggp.expression) {

							// append new ggp
							a_where_ggps.push(h_ggp);
						}
						// uh-oh
						else {
							local.warn('not sure what to do with "'+h_ggp.type+'" block because it doesn\'t have triples or patterns to merge. this is probably my fault');
						}
					}
					// previous ggp is non-existent or different type
					else {

						// append new ggp
						a_where_ggps.push(h_ggp);
					}
				});
			},

			// clear all patterns
			clear: () => {
				a_where_ggps.length = 0;
				a_where_last.length = 0;
			},

			// fetch all patterns
			fetch: () => {
				return [...a_where_ggps, ...a_where_last];
			},

			// methods specific to where block
			custom: {

				// find & replace all occurences of an n3 string
				replace: function(z_find, z_replace) {

					// find is hash
					if('object' === typeof z_find) {

						// each item in hash
						for(let z_item_find in z_find) {

							// replace key with value
							this.replace(z_item_find, z_find[z_item_find]);
						}
					}
					// replace is string
					else if('string' === typeof z_replace) {

						// find is string
						if('string' === typeof z_find) {

							// each pattern
							a_where_ggps.forEach(function replace(h_pattern) {
								if(h_pattern.triples) {
									h_pattern.triples.forEach((h_triple) => {
										if(z_find === h_triple.subject) h_triple.subject = z_replace;
										if(z_find === h_triple.predicate) h_triple.predicate = z_replace;
										if(z_find === h_triple.object) h_triple.object = z_replace;
									});
								}
								else if(h_pattern.patterns) {
									h_pattern.patterns.forEach(replace);
								}
								else {
									debugger;
									local.fail('cannot understand');
								}
							});
						}
						// find is regex
						else if(z_find instanceof RegExp) {
							local.fail('finding regexes not yet implemented by `q.where.replace`');
						}
						// invalid type for find arg
						else {
							local.fail('invalid find argument. expecting [string] or [RegExp]; instead got: '+arginfo(z_find));
						}
					}
					// replace is function
					else if('function' === typeof z_replace) {
						local.fail('using a function to replace things is not yet implemented by `q.where.replace`');
					}
					// invalid type for replace arg
					else {
						local.fail('invalid replace argument. expecting [string] or [function]; instead got: '+arginfo(z_replace));
					}
				},
			},
		}),

		// values clause
		values: overloader({

			// add values data
			add: (...a_args) => {

				// first arg is a string
				if('string' === typeof a_args[0]) {

					// ref it as var
					let s_var = a_args[0];

					// and 2nd arg is an Array
					if(Array.isArray(a_args[1])) {

						// clear current values
						a_values_combos.length = 0;

						// each value
						a_args[1].forEach((s_value) => {

							// create combo & add it
							add_values_combo({
								[s_var]: s_value,
							});
						});

						// exit
						return;
					}
				}

				// each argument
				a_args.forEach((z_arg) => {

					// argument is list
					if(Array.isArray(z_arg)) {

						// each item in list
						z_arg.forEach((h_combo) => {
							add_values_combo(h_combo);
						});
					}
					// argument is hash
					else if('object' === typeof z_arg) {
						add_values_combo(z_arg);
					}
					// unacceptable
					else {
						local.fail(`.values only accepts [object] and [array] arguments. invalid argument ignored: ${arginfo(z_arg)}`);
					}
				});
			},

			// clear all values
			clear: () => {
				a_values_combos.length = 0;
			},

			// fetch plain list of values
			fetch: () => {
				return a_values_combos;
			},
		}),


	});


	// clause conditioner [group, having, order]
	(() => {

		// set which clauses map to which private fields
		let h_condition_clauses = {
			group: as_group_conditions,
			having: as_having_conditions,
			order: as_order_conditions,
		};

		// process hash map
		Object.keys(h_condition_clauses).forEach((s_method) => {

			// ref condition set
			let as_these_conditions = h_condition_clauses[s_method];

			// prepare add condition function
			let add_this_condition = (s_condition) => {

				// strong type string
				if('string' === typeof s_condition) {
					as_these_conditions.add(s_condition);
				}
				// non-string
				else {
					local.error(s_method+' clause expects a [string] condition. instead got: '+arginfo(s_condition));
				}
			};

			// extend basic query class prototype with new method (must use `function` keyword! so that `this` is contextual)
			basic_query.prototype[s_method] = overloader({

				// add conditions
				add: (...a_conditions) => {
					a_conditions.forEach(add_this_condition);
				},

				// clear all conditions
				clear: () => {

					// clear conditions
					as_these_conditions.clear();
				},

				// fetch conditions
				fetch: () => {

					// simple convert set => array
					return Array.from(as_these_conditions);
				},
			});

		});
	})();


	// ask query
	if('ask' === s_query_type) {

		// define query-specific clause for producer
		k_query_producer.set('query', function(add) {

			// ASK keyword, all done!
			add('ask');
		});

		// done!
		return new (class extends basic_query {
			
			// results method
			answer(f_okay_answer) {

				// submit a SPARQL query expecting content of type: sparql-results
				h_parent.submit(this.sparql(), 'table', (h_response) => {

					// forward the boolean response value to callback listener
					f_okay_answer.call(this, h_response['boolean']);
				});
			}

		})(s_query_type);
	}
	// select query
	else if('select' === s_query_type) {

		// private fields for select query class
		let a_select_variables = new Set();
		let h_select_expressions = new Map();

		// filter results
		let a_results_filters = [];

		// load query directly from hash
		if(h_init.query) {

			// ref query
			let h_query = h_init.query;

			// select variables
			if(h_query.variables) {
				h_query.variables.forEach(z_field => {

					// simple variable
					if('string' === typeof z_field) {
						a_select_variables.add(z_field);
					}
					// expression
					else {

						// add variable
						a_select_variables.add(z_field.variable);

						// create expression string
						let s_expr = (function build_expr(z_expr) {
							if('string' === typeof z_expr) {
								return z_expr.replace(/\^\^(.+)$/, '^^<$1>');
							}
							let s_ = '';
							switch(z_expr.type) {
								case 'operation':
									return z_expr.arguments.map(build_expr).join(z_expr.operator);
								case 'aggregate':
									return z_expr.aggregation+'('+z_expr.expression+(z_expr.separator? '; separator="'+z_expr.separator+'"': '')+')';
								default:
									local.fail('init loader unrecognized expr type: `'+z_expr.type+'`');
							}
						})(z_field.expression);

						// set expression
						h_select_expressions.set(z_field.variable, s_expr);
					}
				});
			}
		}

		// define select clause producer
		k_query_producer.set('query', function(add) {

			// select keyword
			add.open('select');

			// no variables
			if(!a_select_variables.size) {
				add('*', true);
			}
			// yes variables
			else {

				// each variable/expression in select clause
				a_select_variables.forEach((s_var) => {

					// variable is alias for expression
					if(h_select_expressions.has(s_var)) {
						add(`(${h_select_expressions.get(s_var)} as ${s_var})`, add.ugly);
					}
					// plain variable
					else {
						add(`${s_var}`, add.ugly);
					}
				});
			}

			// decrease indentation
			add.close();
		});


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
						local.fail('"'+s_key+'" is an invalid name for a SPARQL variable');
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
						local.fail('"'+z_expression+'" is either an invalid name for a SPARQL variable, or is an invalid expression to use in a SELECT clause');
					}
				}
			}
			// argument pass as other
			else {
				return local.fail('must pass [string] to select expression. instead got: '+arginfo(z_expression));
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
						local.fail('select does not work on: '+arginfo(z_arg0));
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

			// results method
			rows(f_okay_rows) {

				// submit a SPARQL query expecting content of type: sparql-results
				h_parent.submit(this.sparql(), 'table', (h_response) => {

					// ref results
					let a_results = h_response.results.bindings;

					// filter results through each filter function
					a_results_filters.forEach((f_filter) => {

						// apply filter to each row in results
						a_results.forEach(f_filter);
					});

					// forward the boolean response value to callback listener
					f_okay_rows.call(this, a_results, h_response.head.vars, h_response);
				});
			}


			/**
			** custom select functions
			**/

			// aggregate function
			collect(s_item_variable, s_collection_variable) {

				// create proxy variable to store n3 version of string
				let s_proxy_variable = '?_n3_'+s_item_variable.substr(1);

				// replace function call with group_concat
				add_select_expression({
					[s_collection_variable]: `group_concat(${s_proxy_variable}; separator='\\n')`,
				});

				// in the 'make sure this happens last' where block section...
				// bind special mechanism to serialize object to n3 as proxy variable
				a_where_last.push({
					type: 'bind',
					variable: s_proxy_variable,
					expression: `
						if(isBlank(${s_item_variable}),
							concat('_:', struuid()),
						if(isIri(${s_item_variable}),
							concat('<', str(${s_item_variable}), '>'),
						if(isLiteral(${s_item_variable}),
							concat('"',
								replace(
									replace(str(${s_item_variable}), '"', '\\\\\\\\"'),
									'\\n', '\\\\\\\\n'
								), '"',
								if(lang(${s_item_variable}) = '',
									concat('^^<', str(datatype(${s_item_variable})), '>'),
									concat('@', lang(${s_item_variable}))
								)
							),
						concat('?', struuid()) )))
						as ?_n3_placeWkt`,
				});

				// post results filter
				a_results_filters.push((h_row) => {

					// extract sparql-results variable name
					let s_collection_variable_name = s_collection_variable.substr(1);

					// split group concat'd field
					let a_values = h_row[s_collection_variable_name].value.split(/\|(?!\\)/g);

					// split the group concat field by separator; map each n3 value to transformation
					h_row[s_collection_variable_name] = a_values.map((s_value) => {

						// replace escape sequences
						s_value = s_value.replace(/\|\u0000/g, '|');

						// transform n3 string into hash
						return h_parent.rabbit(s_value);
					});
				});
			}


		})(s_query_type);

	}
	// describe query
	else if('describe' === s_query_type) {

		// override submit type
		s_submit_type = 'graph';

		// describe targets
		let a_describe_targets = new Set();

		//
		const add_describe_target = (s_target) => {

			// 
			a_describe_targets.add(s_target);
		};


		// define describe clause producer
		k_query_producer.set('query', function(add) {

			// describe keyword; increase indentation
			add.open('describe');

			// no targets
			if(!a_describe_targets.size) {

				//
				return local.fail('nothing to describe!');
			}

			// each target in describe clause
			a_describe_targets.forEach((s_target) => {

				// add target; keep all targets on one line
				add(s_target, true);
			});

			// decrease indentation
			add.close();
		});

		// done!
		let describe_query = class extends basic_query {

			// results method
			browse(f_ready) {

				//
				let s_sparql = this.sparql();

				// submit a SPARQL query expecting a graph
				h_parent.submit(s_sparql, 'graph', (h_response) => {

					// send graph data to callback
					f_ready.apply(this, [

						// send callback normal json-ld
						h_response,

						// include sparql string that was sent to engine
						s_sparql,
					]);
				});

				// continue chaining
				return this;
			}
		};

		// add methods to describe query
		add_methods(describe_query, {

			// describe target(s)
			describe: overloader({

				// add new targets
				add: (...a_targets) => {
					a_targets.forEach(add_describe_target);
				},

				// clear targets
				clear: () => {

					// clear targets
					a_describe_targets.clear();
				},

				// returns describe targets as array
				fetch: () => {
					return Array.from(a_describe_targets);
				},
			}),
		});

		// create & return new describe query
		return new describe_query(s_query_type);
	}
	// insert query
	else if('insert' === s_query_type) {

		// override submit type
		s_submit_type = 'update';

		//
		let a_insert_quad_patterns = [];
		let s_into_graph = '';

		// remove dataset & solution
		k_query_producer.remove('dataset');
		k_query_producer.remove('solution');

		// insert preamble
		k_query_producer.before('query', {

			// with graph
			with(add) {
				if(s_into_graph) {
					add(`with ${s_into_graph}`);
				}
			},
		}, ['with']);

		// define insert clause producer
		k_query_producer.set('query', function(add) {

			// open quad block
			add.open('insert {', ' .');

			// each pattern
			a_insert_quad_patterns.forEach((a_n3_strs) => {
				add(a_n3_strs.join(' '));
			});

			// close quad block
			add.close('}');
		});

		// class
		let insert_query = class extends basic_query {

			// inserter
			insert(...a_quads) {

				// each quad
				a_quads.forEach((z_quad) => {

					// quad is array
					if(Array.isArray(z_quad)) {

						// push to insert block
						a_insert_quad_patterns.push(z_quad);
					}
					// invalid type
					else {
						local.fail('invalid quad argument: '+arginfo(z_quad));
					}
				});

				// enable chaining
				return this;
			}

			// into graph
			into(...a_graphs) {
				if(1 !== a_graphs.length) local.fail('cannot insert into multiple graphs simultaneously');
				s_into_graph = a_graphs[0];

				// enable chaining
				return this;
			}

			// results method
			then(f_ready) {

				//
				let s_sparql = this.sparql();

				// submit a SPARQL query expecting a graph
				h_parent.submit(s_sparql, 'update', (s_response) => {

					// simply callback
					f_ready.call(this, s_response);
				});

				// continue chaining
				return this;
			}
		};

		//
		return new insert_query(s_query_type);
	}
	// insert-data query
	else if('insert-data' === s_query_type) {

		// override submit type
		s_submit_type = 'update';

		// default graph name
		let s_into_graph = '';

		// 
		let h_into_graphs = {
			'': [],
		};

		// remove step from query producer
		k_query_producer.remove('where');

		// define insert clause producer
		k_query_producer.set('query', function(add) {

			// open data block
			add.open('insert data {');

			// each graph
			for(let s_graph_iri in h_into_graphs) {

				// ref graph's triples list
				let a_graph_triples = h_into_graphs[s_graph_iri];

				// empty list; skip it
				if(!a_graph_triples.length) continue;

				// open graph block
				add.open(`graph ${s_graph_iri} {`, ' .');

				//
				a_graph_triples.forEach((h_triple) => {

					// add triple
					add(`${h_triple.subject} ${h_triple.predicate} ${h_triple.object}`);
				});

				// close graph block
				add.close('}');
			}

			// close data block
			add.close('}');
		});

		// done!
		let insert_data_query = class extends basic_query {

			// into graph
			into(...a_graphs) {

				// assert only one graph of type string
				if(1 !== a_graphs.length || 'string' !== typeof a_graphs[0]) {
					local.fail(`.into expectes exactly one [string] argument; instead got: ${arginfo(a_graphs)}`);
				}

				// update into graph
				s_into_graph = a_graphs[0];

				// graph hasn't been used before
				if(!h_into_graphs[s_into_graph]) {

					// create list to store triples that will get inserted into this graph
					h_into_graphs[s_into_graph] = [];
				}

				// enable chaining
				return this;
			}

			// data to insert
			data(...a_ttls) {

				// ref graph this data will be inserted into
				let a_graph_triples = h_into_graphs[s_into_graph];

				// 
				a_ttls.forEach((z_ttl) => {

					// ttl is array 
					if(Array.isArray(z_ttl)) {
						a_graph_triples.push({
							subject: z_ttl[0],
							predicate: z_ttl[1],
							object: z_ttl[2],
						});
					}
					// ttl is blanknode
					else if('object' === typeof z_ttl) {

						//
						let s_blanknode_id = next_blanknode();

						//
						for(let s_predicate in z_ttl) {

							//
							a_graph_triples.push({
								subject: s_blanknode_id,
								predicate: s_predicate,
								object: z_ttl[s_predicate],
							});
						}
					}
					// 
					else {
						local.fail('.data only supports [object] or [array]');
					}
				});

				// enable chaining
				return this;
			}

			// results method
			then(f_ready) {

				//
				let s_sparql = this.sparql();

				// submit a SPARQL query expecting a graph
				h_parent.submit(s_sparql, 'update', (s_response) => {

					// simply callback
					f_ready.call(this, s_response);
				});

				// continue chaining
				return this;
			}
		};

		// // add methods to insert-data query
		// add_methods(insert_data_query, {

		// });

		// create & return new insert-data query
		return new insert_data_query(s_query_type);
	}

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
const local = function() {

	return __construct.apply(this, arguments);

	// // called with `new`
	// if(this !== __namespace) {
	// 	return __construct.apply(this, arguments);
	// }
	// // called directly
	// else {
	// 	return local.fail('not allowed to call '+local+' without `new` operator');
	// }
};

/**
* public static:
**/
{

	// 
	local.toString = function() {
		return __class_name+'()';
	};

	// prefix output messages to console with class's tag
	require('./log-tag.js').extend(local, __class_name);
}

export default local;
