'use strict';

// native imports
let util = require('util');

// third party libraries
let extend = require('extend');

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
const S_VARNAME_X = '[\\u00B7\\u0300-\\u036F\\u203F\\u2040]';
const S_PN_CHARS_UD = '[A-Za-z_0-9\\ux00C0-\\ux00D6\\ux00D8-\\ux00F6\\ux00F8-\\ux02FF\\ux0370-\\ux037D\\ux037F-\\ux1FFF\\ux200C-\\ux200D\\ux2070-\\ux218F\\ux2C00-\\ux2FEF\\ux3001-\\uxD7FF\\uxF900-\\uxFDCF\\uxFDF0-\\uxFFFD\\ux10000-\\uxEFFFF]';

const S_VAR = '(?:[\\?\\$]?)('+S_PN_CHARS_UD+'(?:'+S_PN_CHARS_UD+'|'+S_VARNAME_X+')*)';
const R_VAR = new RegExp('^'+S_VAR+'$');
const R_EXPRESSION = new RegExp('^(.*)\\s+[Aa][Ss]\\s+'+S_VAR+'$');



//
const arginfo = (z_arg) => {
	return '['+(typeof z_arg)+'] '+util.inspect(z_arg);
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



/**
* @class Spaz
* using closure for private methods and fields
**/
const __construct = function(h_query) {

	/**
	* private:
	**/

	// set query type
	const s_query_type = h_query.type.toLowerCase();


	// dataset clause [from]
	let a_from_default = new Set();
	let a_from_named = new Set();

	// group, having, order clauses
	let a_group_conditions = new Set();
	let a_having_conditions = new Set();
	let a_order_conditions = new Set();

	// values clause
	let h_values_data = new Map();


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
			debug.log('constructor('+util.inspect(arguments)+')');
			this.query_type = s_type;
		}

		// specify graph(s) to query from
		from(...a_graphs) {

			// ref args length and 0th arg
			let n_args = a_graphs.length;
			let z_arg0 = a_graphs[0];

			// single argument is an array (reset all graphs)
			if(n_args === 1 && Array.isArray(z_arg0)) {

				// clear all from graphs
				clear_from_graphs();

				// apply each item in the array
				z_arg0.forEach(add_from_graph);
			}
			// no arguments OR single argument is a boolean (fetch graphs)
			else if(n_args === 0 || (n_args === 1 && 'boolean' === typeof z_arg0)) {

				// return all graphs (default and named) as list
				if(!n_args || false === z_arg0) {
					return Array.from(a_from_default).concat(Array.from(a_from_named));
				}
				// return graphs as hash
				else {
					return serialize_from_graphs();
				}
			}
			// add graphs
			else {
				a_graphs.forEach(add_from_graph);
			}

			// chaining
			return this;
		}

		// specifiy where clause
		where() {

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
			
			//
			let n_args = a_values.length;
			let z_arg0 = a_values[0];

			// single argument is array (reset values clauses)
			if(n_args === 1 && Array.isArray(z_arg0)) {

				// clear values
				h_values_data.clear();

				// apply each item in array
				z_arg0.forEach(add_values_data);
			}
			// no arguments OR single argument is a boolean (fetch values)
			else if(n_args === 0 || (n_args === 1 && 'boolean' === typeof z_arg0)) {

				// simply convert map => hash
				return map_to_hash(h_values_data);
			}
			// add values data
			else {
				a_values.forEach(add_values_data);
			}
		}

		toString() {
			return this.query_type+' query';
		}
	};


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
			basic_query.prototype[s_method] = function(...a_conditions) {

				// ref args length and 0th arg
				let n_args = a_conditions.length;
				let z_arg0 = a_conditions[0];

				// single argument is array (reset order clauses)
				if(n_args === 1 && Array.isArray(z_arg0)) {

					// clear conditions
					a_these_conditions.clear();

					// apply each item in the array
					z_arg0.forEach(add_this_condition);
				}
				// no arguments OR single argument is a boolean (fetch clauses)
				else if(n_args === 0 || (n_args === 1 && 'boolean' === typeof z_arg0)) {

					// simple convert set => array
					return Array.from(a_these_conditions);
				}
				// add conditions
				else {
					a_conditions.forEach(add_this_condition);
				}

				// chaining
				return this;
			};
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
						debug.error('"'+z_expression+'" is either an invalid name for a SPARQL variable, or is an invalid expression to use in a SELECT clause');
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

			// create plain object (hash)
			let h_serial = {};

			// iterate variables to create keys for hash
			for(var s_var of a_select_variables) {

				// this variable has a corresponding expression
				if(h_select_expressions.has(s_var)) {

					// set key/value pair in plain object
					h_serial[s_var] = h_select_expressions.get(s_var);
				}
				// simple variable
				else {

					// set dummy value for simple variable as key
					h_serial[s_var] = false;
				}
			}

			// 
			return h_serial;
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