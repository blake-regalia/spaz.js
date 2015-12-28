// native imports
import util from 'util';

// libraries
import arginfo from 'arginfo';
import extend from 'extend';
import sparqljs from 'sparqljs';
import request from 'request';
import rapunzel from 'rapunzel';

// local modules
import overloader from './overloader';
import query_builder from './query-builder';

//
const sparql_parser = sparqljs.Parser;

// colored output
require(__dirname+'/console-color.js');


/**
* private static:
**/

// meta class setup
const __class_name = 'Spaz';


// class constants

// inspried by: http://www.w3.org/TeamSubmission/n3/
const H_PREDICATE_ALIASES = new Map([
	['a', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'],
	['=', 'http://www.w3.org/2002/07/owl#sameAs'],
	['=>', 'http://www.w3.org/2000/10/swap/log#implies'],
	// ['<=', 'http://www.w3.org/2000/10/swap/log#implies'], // not supported
]);


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
const P_XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#';

const R_TTL_LITERAL = /^"((?:[^"\\]|\\.)*)"(?:\^\^([^]+))?$/;

//
const A_VALID_TABLE_HTTP_METHODS = ['get', 'post'];
const A_VALID_GRAPH_HTTP_METHODS = ['get', 'post'];
const A_VALID_UPDATE_HTTP_METHODS = ['post','put'];

//
const setup_remote = (h_engine) => {

	// prepare http method to use for table-result queries
	let s_table_method = A_VALID_TABLE_HTTP_METHODS[0];

	// prepare http method to use for graph-result queries
	let s_graph_method = A_VALID_GRAPH_HTTP_METHODS[0];

	// prepare http method to use for update queries
	let s_update_method = A_VALID_UPDATE_HTTP_METHODS[0];

	// prepare results parser
	let f_parser = (s_body) => {
		return new Promise((f_resolve, f_reject) => {
			try {
				f_resolve(
					JSON.parse(s_body)
				);
			}
			catch(e) {
				f_reject('response body could not be parsed: '+e);
			}
		});
	};


	// engine gives method option
	if(h_engine.http_methods) {

		// ref http methods
		let h_http_methods = h_engine.http_methods;

		// http method to use for table-result queries
		if(h_http_methods.table) {

			// invalid http method for table-result queries
			if(!A_VALID_TABLE_HTTP_METHODS.includes(h_http_methods.table)) {
				return local.fail('invalid HTTP method to use for table-result queries: '+h_http_methods.table);
			}

			// set http method for table-result queries
			s_table_method = h_http_methods.table;
		}

		// http method to use for graph-result queries
		if(h_http_methods.graph) {

			// ref http method
			let s_method = h_http_methods.graph.toLowerCase();

			// invalid http method for table-result queries
			if(!A_VALID_GRAPH_HTTP_METHODS.includes(s_method)) {
				return local.fail('invalid HTTP method to use for graph-result queries: '+s_method);
			}

			// set http method for graph-result queries
			s_graph_method = s_method;
		}

		// http method to use for update queries
		if(h_http_methods.update) {

			// ref http method
			let s_method = h_http_methods.update.toLowerCase();

			// invalid http method for table-result queries
			if(!A_VALID_UPDATE_HTTP_METHODS.includes(s_method)) {
				return local.fail('invalid HTTP method to use for update queries: '+s_method);
			}

			// set http method for graph-result queries
			s_update_method = s_method;
		}
	}

	// engine interface function
	let k_engine = (s_sparql, s_type) => {

		// prepare http method
		let s_method;

		// prepare http accept header
		let s_accept;

		// prepare http path (default to query)
		let s_path = '/query';

		// prepare http parameter for sparql string
		let s_sparql_parameter = 'query';

		// tabular result query (ASK, SELECT)
		if('table' === s_type) {
			s_method = s_table_method;
			s_accept = 'application/sparql-results+json';
		}
		// graph result query (DESCRIBE)
		else if('graph' === s_type) {
			s_method = s_graph_method;
			s_accept = 'application/ld+json';
		}
		// update action
		else if('update' === s_type) {
			s_method = s_update_method;
			s_accept = 'text/plain';
			s_path = '/update';
			s_sparql_parameter = 'update';
		}
		// invalid execution type
		else {
			return local.fail('invalid SPARQL execution type: '+s_type);
		}

		// prepare request options
		let h_request = {
			method: s_method,
			url: h_engine.url+s_path,
			headers: {
				Accept: s_accept,
			},
		};

		// set data
		let h_data = {
			[s_sparql_parameter]: s_sparql,
		};

		// GET method
		if('get' === s_method) {

			// set query string
			h_request.qs = h_data;
		}
		// POST method
		else if('post' === s_method) {

			// set form data
			h_request.form = h_data;
		}

		//
		return new Promise((f_resolve, f_reject) => {

			// wrap rejector with http request info
			let f_reject_http = (s_msg) => {
				delete h_request.form;
				f_reject(s_msg+'\nrequest: '+arginfo(h_request)+'\nquery: '+s_sparql);
			};

			// submit request
			request(h_request, (h_err, d_http_message, s_body) => {

				// 
				if(h_err) {
					return f_reject_http(h_err);
				}

				// not okay response
				if(200 !== d_http_message.statusCode) {
					return f_reject_http('Bad HTTP response from host: '+d_http_message.statusCode+' - '+d_http_message.statusMessage);
				}

				// get content type
				let s_content_type = d_http_message.headers['content-type'].split(';')[0];

				// response is JSON
				if(s_content_type.endsWith('json')) {

					// parse body
					f_parser(s_body)
						// success
						.then((h_json) => {

							// forward to callback
							f_resolve(h_json);
						})
						// parse error
						.catch((e) => {

							// decide how to handle errors
							f_reject(e);
						});
				}
				// response is other
				else {

					// acceptable
					if('update' === s_type) {
						f_resolve(s_body);
					}
					// unacceptable
					else {
						f_reject('expected response to be JSON; instead got Content-Type: "'+s_content_type+'"');
					}
				}
			});
		});
	};

	//
	return k_engine;
};


// engine setup router
const setup_engine = (h_engine) => {

	// remote engine type
	if('remote' === h_engine.type) {
		return setup_remote(h_engine);
	}

	//
	local.fail('unknown engine type "'+h_engine.type+'": '+arginfo(h_engine));
};



/**
* @class Spaz
* using closure for private methods and fields
**/
const __construct = function(h_config) {

	/**
	* private:
	**/


	// prefixes
	let hm_prologue_prefixes = new Map([

		// defaults
		['xsd', 'http://www.w3.org/2001/XMLSchema#'],
		['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
		['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
		['owl', 'http://www.w3.org/2002/07/owl#'],
	]);

	//
	const add_prefix_item = (s_name, s_iri, b_allow_override=false) => {

		// prefix already defined
		if(!b_allow_override && hm_prologue_prefixes.has(s_name)) {

			// prefixes are not identical
			if(hm_prologue_prefixes.get(s_name) !== s_iri) {

				// issue warning
				local.warn(`overwriting a global prefix will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing '${s_name}' prefix from <${hm_prologue_prefixes.get(s_name)}> to <${s_iri}>`);
			}
		}
		// prefix not yet defined
		else {
			hm_prologue_prefixes.set(s_name, s_iri);
		}
	};

	//
	const add_prologue_prefix = (z_prefix, b_init=false) => {

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
			let m_iri = R_IRI.exec(s_iri);

			// bad iri
			if(!m_iri) {
				return local.fail('failed to match SPARQL prefix iri: '+arginfo(s_iri));
			}

			//
			add_prefix_item(m_name[1], m_iri[1], b_init);
		}
		// hash
		else if('object' === typeof z_prefix) {

			//
			let f_add_hash = (h_prefix) => {

				// each item
				for(let s_name in h_prefix) {

					// ref iri
					let s_iri = h_prefix[s_name];

					// assert string
					if('string' !== typeof s_iri) {
						return local.fail('prefix iri must be [string]. for "'+s_name+'" key it received: '+arginfo(s_iri));
					}

					//
					add_prefix_item(s_name, s_iri, b_init);
				}
			};

			// array
			if(Array.isArray(z_prefix)) {
				z_prefix.forEach((h_prefix) => {
					f_add_hash(h_prefix);
				});
			}
			// single hash
			else {
				f_add_hash(z_prefix);
			}
		}
		// other
		else {
			return local.fail('prefix argument must be [string] or [object]. instead got: '+arginfo(z_prefix));
		}
	};


	//
	let k_engine;

	// initialization
	(() => {

		// config
		if(h_config) {

			// prefixes
			if(h_config.prefixes) {
				add_prologue_prefix(h_config.prefixes, true);
			}

			// engine
			if(h_config.engine) {

				// ref config engine hash
				let h_config_engine = h_config.engine;

				// prepare engine hash
				let h_engine = {};

				// remote engine
				if(h_config_engine.endpoint) {

					// set remote engine type
					h_engine.type = 'remote';

					// ref endpoint
					let z_endpoint = h_config_engine.endpoint;

					// endpoint type is string
					if('string' === typeof z_endpoint) {
						h_engine.url = z_endpoint;
					}
					// endpoint type is object
					else if('object' === typeof z_endpoint) {

						// not yet supported
						return local.fail('endpoint hash argument not yet supported');
					}
					// invalid type
					else {

						// not yet supported
						return local.fail(`unexpected 'engine.endpoint' value type: ${arginfo(z_endpoint)}`);
					}

					// set http methods
					if(h_config_engine.http_methods) {

						// ref methods
						let z_http_methods = h_config_engine.http_methods;

						// http methods type is string
						if('string' === typeof z_http_methods) {

							// ref method
							let s_method = z_http_methods.toLowerCase();

							// shortcut sets table and graph methods at once
							if(['get', 'post'].includes(s_method)) {
								h_engine.http_methods = {
									table: s_method,
									graph: s_method,
								};
							}
							// invalid shortcut name
							else {
								local.fail('no such HTTP method shortcut named "'+s_method+'"');
							}
						}
						// http methods type is object
						else if('object' === typeof z_http_methods) {

							// set directly
							h_engine.http_methods = z_http_methods;
						}
						// unknown type
						else {
							local.fail(`unexpected 'engine.http_methods' value type: ${arginfo(z_http_methods)}`);
						}
					}
				}

				// prepare descriptive hash for setting up endpoint
				k_engine = setup_engine(h_engine);
			}
		}
	})();

	/**
	* public operator() ():
	**/

	// parse a SPARQL string and return a query-builder
	let operator = function(z_query) {

		// assume SPARQL hash
		let h_query = z_query;

		// SPARQL string
		if('string' === typeof z_query) {

			// prepare to inject prefixes
			let s_injected_prefixes = '';

			// build prefix strings
			for(let [s_prefix, p_iri] of hm_prologue_prefixes) {
				s_injected_prefixes += `prefix ${s_prefix}: <${p_iri}>`;
			}

			//
			h_query = (new sparql_parser()).parse(s_injected_prefixes+z_query);
		}

		//
		return query_builder({
			parent: operator,
			type: h_query.queryType,
			query: h_query,
		});
	};

	// simple group patterns
	['group', 'union', 'minus', 'optional'].forEach((s_pattern_type) => {
		operator[s_pattern_type] = function(...a_patterns) {
			return function() {
				return this.serialize_pattern(s_pattern_type, a_patterns);
			};
		};
	});


	const spo_hash = (z_group) => {
		if(Array.isArray(z_group)) {
			return {
				subject: z_group[0],
				predicate: z_group[1],
				object: z_group[2],
			};
		}
		else {
			local.fail('unsupported group type: '+arginfo(z_group));
		}
	};

	/**
	* public:
	**/
	operator = extend(operator, {


		// adds prefixes to this instance's internal map
		prefix: overloader({

			// add new prefixes
			add: (...a_prefixes) => {
				a_prefixes.forEach(add_prologue_prefix);
			},

			// clear global prefixes, then add new ones
			clear: () => {

				// clear global prefixes
				hm_prologue_prefixes.clear();
			},

			// returns global prefixes as hash
			fetch: () => {
				return map_to_hash(hm_prologue_prefixes);
			},

			// allow getter access to underlying map
			map: hm_prologue_prefixes,
		}),


		/**
		* immediate query constructor shortcuts
		**/

		silently: {
			drop: {
				graph: (s_graph, f_okay) => {
					operator.submit(`drop silent graph <${operator.expand(s_graph)}>`, 'update', f_okay || ()=>{});
				},
			},
		},

		/**
		* query-builder constructor shortcuts
		**/

		// new ASK query
		ask(...a_args) {

			// create new query builder
			let q_query = query_builder({
				parent: operator,
				type: 'ask',
			});

			// args were given
			if(a_args.length) {

				// forward arguments
				return q_query.where(...a_args);
			}

			// return query builder
			return q_query;
		},

		// new SELECT query
		select(...a_args) {

			// create new query builder
			let q_query = query_builder({
				parent: operator,
				type: 'select',
			});

			// args were given
			if(a_args.length) {

				// forward arguments
				return q_query.select(...a_args);
			}

			// return query builder
			return q_query;
		},

		// new DESCRIBE query
		describe(...a_args) {

			// create new query builder
			let q_query = query_builder({
				parent: operator,
				type: 'describe',
			});

			// args were given
			if(a_args.length) {

				// forward arguments
				return q_query.describe(...a_args);
			}

			// return query builder
			return q_query;
		},

		// new INSERT query
		insert: Object.defineProperties((...a_quads) => {

			///
			let q_query = query_builder({
				parent: operator,
				type: 'insert',
			});

			// args were given
			if(a_quads.length) {

				// forward arguments
				return q_query.insert(...a_quads);
			}

			// return query builder
			return q_query;
		}, {

			// new INSERT DATA query
			into: {
				enumerable: true,
				value: (...a_args) => {

					// create new query builder
					let q_query = query_builder({
						parent: operator,
						type: 'insert-data',
					});

					// args were given
					if(a_args.length) {

						// forward arguments
						return q_query.into(...a_args);
					}

					// return query builder
					return q_query;
				},
			},
		}),

		// query builder
		build(s_type) {
			switch(s_type) {
				case 'ask':
				case 'select':
					return query_builder({
						parent: operator,
						type: s_type,
					});
				case 'insert':
				case 'update':
				default:
					return exports.fail('cannot build "'+s_type+'". That alias is not recognized');
			}
		},


		/**
		* query-builder WHERE helpers
		**/

		// basic graph pattern
		bgp(a_triples) {
			return {
				type: 'bgp',
				triples: a_triples,
			};
		},

		// minus block
		minus(...a_triples) {
			return {
				type: 'minus',
				patterns: [
					{
						type: 'bgp',
						triples: a_triples.map(spo_hash),
					}
				]
			};
		},

		// rdf:collection
		list(a_items) {

			// empty list
			if(!a_items.length) {
				return operator.expand('rdf:nil');
			}
			// non-empty list
			else {
				return '('+a_items.map(operator.turtle).join(' ')+')';
			}
		},

		// alias
		collection: operator.list,

		// iri
		iri(z_thing) {

			// 
			if('string' === typeof z_thing) {
				return '<'+z_thing+'>';
			}
			else if('object' === typeof z_thing) {
				if('iri' === z_thing.type) {
					return '<'+(z_thing.value || z_thing.iri)+'>';
				}
				else {
					local.fail('invalid iri [object]: '+arginfo(z_thing));
				}
			}
			else {
				local.fail('invalid iri: '+arginfo(z_thing));
			}
		},

		// triple
		triple(...a_args) {

			//
			if('string' === typeof a_args[0]) {
				return ['<'+a_args[0]+'>', '<'+a_args[1]+'>', '<'+a_args[2]+'>'];
			}
			else {
				local.fail('invalid use of $$.triple');
			}
		},

		// add bind statement
		bind(s_expr, s_var) {

			//
			return {
				type: 'bind',
				variable: s_var,
				expression: s_expr,
			};
		},

		// construct a literal
		val(z_value, s_type) {

			// prep value string; default to input arg `value`
			let s_value = z_value;

			// no explicit type given
			if('undefined' === typeof s_type) {

				// boolean
				if('boolean' === typeof z_value) {
					s_type = P_XSD_NAMESPACE+'boolean';
				}
				// numeric
				else if('number' === typeof z_value) {

					// integer
					if(Number.isInteger(z_value)) {
						s_type = P_XSD_NAMESPACE+'integer';
					}
					// non-finite / NaN
					else if(isNaN(z_value) || !isFinite(z_value)) {
						return local.fail('cannot create numeric value for non-finite / NaN type: '+arginfo(z_value));
					}
					// float
					else {
						s_type = P_XSD_NAMESPACE+'decimal';
					}
				}
				// string
				else if('string' === typeof z_value) {

					// escape double quote chars
					s_value = z_value.replace(/"/g, '\\"');

					// set string type
					s_type = P_XSD_NAMESPACE+'string';
				}
				// hash
				else if('object' === typeof z_value) {

					// set value from hash; escape double quote chars
					s_value = z_value.value.replace(/"/g, '\\"');

					// set type from hash
					s_type = z_value.datatype;
				}
				// unsupported type
				else {
					return local.fail('.val method does not support this type of value: '+arginfo(z_value));
				}
			}
			// bad type
			else if('string' !== typeof s_type) {
				return local.fail('cannot use non-string to describe type of val: '+arginfo(s_type));
			}

			//
			return '"'+s_value+'"^^<'+s_type+'>';
		},

		// create a filter block
		filter(...a_exprs) {

			//
			let s_expression = a_exprs.map((z_expr) => {

				// SPARQL string
				if('string' === typeof z_expr) {

					// simple concatenation
					return z_expr;
				}
				// array indicates special meaning
				else if(Array.isArray(z_expr)) {

					// ref last arg
					let z_val = z_expr[z_expr.length-1];

					// 
					if('object' === typeof z_val) {

						// regex
						if(z_val instanceof RegExp) {

							// must be two args
							if(2 !== z_expr.length) {
								local.fail('filter with regular expression must have exactly 2 arguments. instead got '+z_expr.length+': '+arginfo(z_expr));
							}

							// ref test arg
							let s_test = z_expr[0];

							// `test` arg needs to be a string
							if('string' !== typeof s_test) {
								local.fail('filter with regular expression expects [string] for `test` argument. instead got: '+arginfo(s_test));
							}

							return `regex(${s_test},"${z_val.source.replace(/"/g, '\\"')}","${z_val.flags}")`;

							//
							// return {
							// 	type: 'operation',
							// 	operator: 'regex',
							// 	args: [s_test, z_val.source, z_val.flags],
							// };
						}
					}
				}
			}).join(' ');

			//
			return {
				type: 'filter',
				expression: s_expression,
			};
		},

		// filter exists
		exists(...a_groups) {

			//
			return function() {
				return this.serialize_filter('exists', a_groups);
			};
		},

		// semantic chaining for operations preceeded by 'not'
		not: {

			// 'not exists'
			exists(...a_groups) {

				// post-serialization
				return function() {
					return this.serialize_filter('not exists', a_groups);
				};
			},
		},

		//
		sub(h_sub) {

			//
			local.warn('the `sub` function is not yet fully supported');

			//
			return function() {
				return {
					type: 'query',
					queryType: 'SELECT',
					variables: h_sub.select,
					where: this.serialize_pattern('where', h_sub.where),
				};
			};
		},


		/**
		* general helper methods
		**/

		// general expand
		expand(s_iri) {

			// split by colon
			let [s_name, s_path] = s_iri.split(':');

			// attempt globally defined prefix
			let s_ref_base = hm_prologue_prefixes.get(s_name);

			// not defined globally
			if(!s_ref_base) {
				return local.fail('no such prefix defined "'+s_name+'"');
			}

			// build full iri
			return s_ref_base+s_path;
		},

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
			if(n_longest_url) {

				// compute suffix
				let s_suffix = p_iri.substr(n_longest_url);

				// make sure it is a valid suffix
				if(/^[a-zA-z_][a-zA-z_0-9\-]*$/.test(s_suffix)) {
					return s_best_prefix+':'+s_suffix;
				}
			}

			// when all else fails
			return '<'+p_iri+'>';
		},

		// converts hash into ttl-style string; does nothing on [string], casts [boolean], [number] to [string]
		turtle(z_thing) {

			// ref thing type
			let s_type = typeof z_thing;

			// 
			switch(s_type) {
				case 'string':
				case 'number':
				case 'boolean':
					return z_thing+'';

				case 'undefined':
					return 'UNDEF';

				case 'object':
					switch(z_thing.type) {
						case 'variable':
							return '?'+z_thing.name;

						case 'bnode':
							return z_thing.id;

						case 'iri':
							return '<'+z_thing.iri+'>';

						case 'literal':
						case 'typed-literal':
							return '"'+z_thing.value.replace(/"/g, '\\"')+'"'+(z_thing.datatype? '^^<'+z_thing.datatype+'>': '');

						default:
							local.fail('invalid turtle type "'+z_thing.type+'" from: '+arginfo(z_thing));
					}
			}
		},

		// converts n3 string into a hash
		rabbit(s_thing) {
			if('?' === s_thing[0]) {
				return {
					type: 'variable',
					name: s_thing.substr(1),
					value: s_thing,
				};
			}
			else if(s_thing.startsWith('_:')) {
				return {
					type: 'bnode',
					id: s_thing,
				};
			}
			else if('"' === s_thing[0]) {
				let m_literal = R_TTL_LITERAL.exec(s_thing);
				return {
					type: 'literal',
					value: m_literal[1],
					datatype: m_literal[2].replace(/^<|>$/g, ''),
				};
			}
			else {
				return {
					type: 'iri',
					iri: s_thing.replace(/^<|>$/g, ''),
				};
			}
		},

		// tests if entity is an iri
		isIri(z_entity) {
			return (
				'string' === typeof z_entity
				&& '?' !== z_entity[0]
				&& '"' !== z_entity[0]
				&& !z_entity.startsWith('_:')
			);
		},

		// tests is entity is blanknode
		isBlanknode(z_entity) {
			return (
				'string' === typeof z_entity
				&& z_entity.startsWith('_:')
			);
		},

		//
		isNamedPredicate(s_predicate) {
			return ('?' !== s_predicate[0] && !H_PREDICATE_ALIASES.has(s_predicate));
		},

		// execution methods
		submit(s_sparql, s_type, f_okay) {

			// no sparql engine!
			if(!k_engine) return local.fail('cannot execute query; no SPARQL engine was specified!');

			// execute query!
			k_engine(s_sparql, s_type)
				// engine responded
				.then((h_json) => {

					// escape the grips of the promise
					setImmediate(() => {

						// forward json to callback
						f_okay(h_json);
					});
				})
				// error
				.catch((s_msg) => {
					local.fail('SPARQL engine failure:\n'+s_msg);
				});
		},


		//
		stringify(z_thing) {

			//
			let stringify_thing = function(add, z_item) {

				// ref thing type
				let s_type = typeof z_item;

				// string
				if('string' === s_type) {
					add(`'${z_item.replace(/'/g, '\\\'')}'`, true);
				}
				// array
				else if(Array.isArray(z_item)) {
					add.open('[ ', ',', true);
					for(let i_item in z_item) {
						add('');
						stringify_thing(add, z_item[i_item]);
					}
					add.close(']');
				}
				// object / function
				else if('object' === s_type || 'function' === s_type) {

					add.open('{', ',', true);
					for(let s_property in z_item) {
						add(`'${s_property.replace(/'/g, '\\\'')}': `);
						stringify_thing(add, z_item[s_property]);
					}
					add.close('}');
				}
			};

			let k_code = rapunzel({
				body(add) {
					return stringify_thing(add, z_thing);
				},
			}, ['body']);

			//
			return k_code.produce({
				indent: '    ',
			});
		}
	});

	// alias prefix
	operator.prefixes = operator.prefix;


	// 
	return operator;
};


/**
* public static operator() ():
**/
const local = function() {

	return __construct.apply(this, arguments);
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
