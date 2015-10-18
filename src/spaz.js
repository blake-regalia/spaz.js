'use strict';

// native imports
let util = require('util');

// third party libraries
let extend = require('extend');

// local modules
const overloader = require(__dirname+'/overloader.js')
const query_builder = require(__dirname+'/query-builder.js');

/**
* private static:
**/

// meta class setup
const __class = 'Spaz';
let __namespace, __exportee, __export_symbol;

// node.js
if(typeof module !== 'undefined' && module.exports) {
	__namespace = global;
	__exportee = module;
	__export_symbol = 'exports';
}


// class constants


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





/**
* @class Spaz
* using closure for private methods and fields
**/
const __construct = function(h_config) {

	/**
	* private:
	**/


	// prefixes
	let h_prologue_prefixes = new Map([

		// defaults
		['xsd', 'http://www.w3.org/2001/XMLSchema#'],
		['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
		['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
		['owl', 'http://www.w3.org/2002/07/owl#'],
	]);

	//
	const add_prefix_item = (s_name, s_iri) => {

		// prefix already defined
		if(h_prologue_prefixes.has(s_name)) {

			// prefixes are not identical
			if(h_prologue_prefixes.get(s_name) !== s_iri) {

				// issue warning
				debug.warn(`overwriting a global prefix will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing '${s_name}' prefix from <${h_prologue_prefixes.get(s_name)}> to <${s_iri}>`);
			}
		}
		// prefix not yet defined
		else {
			h_prologue_prefixes.set(s_name, s_iri);
		}
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
			let m_iri = R_IRI.exec(s_iri);

			// bad iri
			if(!m_iri) {
				return debug.fail('failed to match SPARQL prefix iri: '+arginfo(s_iri));
			}

			//
			add_prefix_item(m_name[1], m_iri[1]);
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



	// initialization
	(() => {

		// config
		if(h_config) {

			// prefixes
			if(h_config.prefixes) {
				add_prologue_prefix(h_config.prefixes);
		 	}
		 }
	})();

	/**
	* public operator() ():
	**/
	const operator = function() {

	};

	// simple group patterns
	['group','union','minus','optional'].forEach((s_pattern_type) => {
		operator[s_pattern_type] = function(...a_patterns) {
			return function() {
				return this.serialize_pattern(s_pattern_type, a_patterns);
			};
		};
	});


	/**
	* public:
	**/
	return extend(operator, {

		// expression builder helper functions
		triple: '',

		// adds prefixes to this instance's internal map
		prefix: overloader({

			// reset global prefixes, then add new ones
			reset: (a_items) => {

				// clear global prefixes
				h_prologue_prefixes.clear();

				// apply each item in the array
				a_items.forEach(add_prologue_prefix);
			},

			// returns global prefixes as hash
			fetch: () => {
				return map_to_hash(h_prologue_prefixes);
			},

			// add new prefixes
			add: (a_prefixes) => {
				a_prefixes.forEach(add_prologue_prefix);
			},

			// allow getter access to underlying map
			map: h_prologue_prefixes,
		}),


		// query builder
		build(s_type) {
			switch(s_type) {
				case 'ask':
				case 'select':
					return new query_builder({
						parent: operator,
						type: s_type,
					});
				case 'insert':
				case 'update':
				default:
					return exports.fail('cannot build "'+s_type+'". That alias is not recognized');
			}
		},

		// helper
		val(z_value, s_type) {

			// no type given
			if('undefined' === typeof s_type) {

				// boolean
				if('boolean' === typeof z_value) {
					s_type = 'xsd:boolean';
				}
				// numeric
				else if('number' === typeof z_value) {

					// integer
					if(Number.isInteger(z_value)) {
						s_type = 'xsd:integer';
					}
					// 
					else if(isNaN(z_value) || !isFinite(z_value)) {
						return debug.fail('cannot create numeric value for non-finite / NaN type: '+arginfo(z_value));
					}
					// float
					else {
						s_type = 'xsd:decimal';
					}
				}
				// string
				else if('string' === typeof z_value) {

					// escape double quote chars
					z_value = z_value.replace(/"/g, '\\"');

					// set string type
					s_type = 'xsd:string';
				}
				// unsupported type
				else {
					return debug.fail('.val method does not support this type of value: '+arginfo(z_value));
				}
			}
			// bad type
			else if('string' !== typeof s_type) {
				return debug.fail('cannot use non-string to describe type of val: '+arginfo(s_type));
			}

			//
			return '"'+z_value+'"^^'+s_type;
		},

		// 
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
								debug.fail('filter with regular expression must have exactly 2 arguments. instead got '+z_expr.length+': '+arginfo(z_expr));
							}

							// ref test arg
							let s_test = z_expr[0];

							// `test` arg needs to be a string
							if('string' !== typeof s_test) {
								debug.fail('filter with regular expression expects [string] for `test` argument. instead got: '+arginfo(s_test));
							}

							return `regex(${s_test},"${z_val.source.replace(/"/g,'\\"')}","${z_val.flags}")`;

							//
							// return {
							// 	type: 'operation',
							// 	operator: 'regex',
							// 	args: [s_test, z_val.source, z_val.flags],
							// };
						}
					}
				}
			}).join('');

			//
			return {
				type: 'filter',
				expression: s_expression,
			};
		},

		//
		exists(...a_groups) {

			//
			return function() {
				return this.serialize_filter('exists', a_groups);
			};
		},

		// semantic chaining for operations preceeded by 'not'
		not: {

			// 'not exists'
			exists(...a_groups)  {

				// 
				return function() {
					return this.serialize_filter('not exists', a_groups);
				};
			},
		},

		//
		sub(h_sub) {

			//
			debug.warn('the `sub` function is not yet fully supported');

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

	});
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
}