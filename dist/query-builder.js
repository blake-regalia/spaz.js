// native imports
'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

// libraries

var _arginfo = require('arginfo');

var _arginfo2 = _interopRequireDefault(_arginfo);

var _merge = require('merge');

var _merge2 = _interopRequireDefault(_merge);

var _graphy = require('graphy');

var _graphy2 = _interopRequireDefault(_graphy);

var _rapunzel = require('rapunzel');

var _rapunzel2 = _interopRequireDefault(_rapunzel);

// local modules

var _overloader = require('./overloader');

var _overloader2 = _interopRequireDefault(_overloader);

var _queryPatterns = require('./query-patterns');

var _queryPatterns2 = _interopRequireDefault(_queryPatterns);

/**
* private static:
**/

// meta class setup
var __class_name = 'QueryBuilder';

// class constants

// the following regular expressions were optimized for javascript from (http://www.w3.org/TR/sparql11-query/#sparqlGrammar)

// symbols
var S_PN_CHARS_BASE = '[A-Za-z\\ux00C0-\\ux00D6\\ux00D8-\\ux00F6\\ux00F8-\\ux02FF\\ux0370-\\ux037D\\ux037F-\\ux1FFF\\ux200C-\\ux200D\\ux2070-\\ux218F\\ux2C00-\\ux2FEF\\ux3001-\\uxD7FF\\uxF900-\\uxFDCF\\uxFDF0-\\uxFFFD\\ux10000-\\uxEFFFF]';
var S_PN_CHARS_U = S_PN_CHARS_BASE.slice(0, -1) + '_]';
var S_VARNAME_X = '0-9\\u00B7\\u0300-\\u036F\\u203F\\u2040';
var S_PN_CHARS = S_PN_CHARS_U.slice(0, -1) + S_VARNAME_X + '\\-]';
var S_PN_PREFIX = S_PN_CHARS_BASE + '(?:' + S_PN_CHARS.slice(0, -1) + '\\.]*' + S_PN_CHARS + ')?';
var S_PLX = '%[0-9A-Fa-f]{2}|\\\\[_~.\\-!$&\'()|*+,;=/?#@%]';
var S_PN_LOCAL = S_PN_CHARS_U + '|[.0-9]|' + S_PLX + '(?:(?:' + S_PN_CHARS + '|[.:]|' + S_PLX + ')*(?:' + S_PN_CHARS + '|[:]|' + S_PLX + '))?';
var S_PNAME_LN = '(' + S_PN_PREFIX + ')?:(' + S_PN_LOCAL + ')?';

// patterns
var S_VARNAME = S_PN_CHARS_U.slice(0, -1) + '0-9]' + S_PN_CHARS_U.slice(0, -1) + S_VARNAME_X + ']*';

// helpers
var S_VAR = '(?:[\\?\\$]?)(' + S_VARNAME + ')';

// productions
var R_VAR = new RegExp('^' + S_VAR + '$');
var R_EXPRESSION = new RegExp('^(.*)\\s+[Aa][Ss]\\s+' + S_VAR + '$');
var R_PREFIX = new RegExp('^(' + S_PN_PREFIX + ')?:$');
var R_PREFIXED_NAME = new RegExp('^' + S_PNAME_LN + '$');
var R_IRIREF = /^<([^\s>]+)>$/;

var R_VALUE_METADATA = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)(?:@([A-Za-z]+(?:-[A-Za-z0-9]+)*)|(?:\^\^([^]+)))?$/;

var R_COMPRESS_SPARQL = /\s+(?!\w*:|(?:in|from|named|where)\b)|\.\s*(})|([>])\s+(?=:_)/g;

//
var A_PATTERN_TYPES = new Set(['bgp', 'minus', 'filter', 'optional']);

//
var assert_integer = function assert_integer(z_int, s_who) {

	// numeric
	if ('number' === typeof z_int) {

		// integer
		if (0 === z_int % 1) {
			return true;
		}
		// non-integer
		else {
				local.error(s_who + ' requires an integer. instead got ' + z_int);
			}
	}
	// not a number
	else {
			local.error(s_who + ' requires a number. instead got ' + (0, _arginfo2['default'])(z_int));
		}

	// default
	return false;
};

//
var map_to_hash = function map_to_hash(h_map) {

	// create plain object (hash)
	var h_hash = {};

	// iterate keys of map
	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = h_map[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var _step$value = _slicedToArray(_step.value, 2);

			var s_key = _step$value[0];
			var z_value = _step$value[1];

			// push each key/value pair to hahs
			h_hash[s_key] = z_value;
		}

		//
	} catch (err) {
		_didIteratorError = true;
		_iteratorError = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion && _iterator['return']) {
				_iterator['return']();
			}
		} finally {
			if (_didIteratorError) {
				throw _iteratorError;
			}
		}
	}

	return h_hash;
};

//
var add_methods = function add_methods(d_class, h_methods) {

	// process hash map
	Object.keys(h_methods).forEach(function (s_method) {

		// add method to class' prototype
		d_class.prototype[s_method] = h_methods[s_method];
	});
};

// inspried by: http://www.w3.org/TeamSubmission/n3/
var H_PREDICATE_ALIASES = new Map([['a', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'], ['=', 'http://www.w3.org/2002/07/owl#sameAs'], ['=>', 'http://www.w3.org/2000/10/swap/log#implies']]);

// creates a pattern handler for simple types

// ['<=', 'http://www.w3.org/2000/10/swap/log#implies'], // not supported
var simple_pattern = function simple_pattern(s_type) {

	// return pattern handler
	return function (add, h_gp) {

		// open clause
		add.open(s_type + (add.pretty ? ' ' : '') + '{');

		// each pattern
		h_gp.patterns.forEach(function (h_pattern) {

			// pass query producing torch to next pattern
			produce_pattern(add, h_pattern);
		});

		// close block
		add.close('}');
	};
};

//
var sparql_entity = function sparql_entity(s_item) {

	//
	switch (s_item[0]) {
		case '?': // variable
		case '$': // variable
		case '"':
			// literal
			return s_item;

		case '_':
			// blanknode
			if (':' !== s_item[1]) {
				// iri ref
				return '<' + s_item + '>';
			}
			return s_item;

		default:
			// iri ref
			return '<' + s_item + '>';
	}
};

//
var stringify_expression = function stringify_expression(add, z_expression) {

	// SPARQL-ready expression
	if ('string' === typeof z_expression) {
		return add(z_expression, true);
	}
	// JSON object
	else if ('object' === typeof z_expression) {

			// depending on expression type
			switch (z_expression.type) {

				case 'operation':

					// ref operator
					var s_operator = z_expression.operator;

					// ref args
					var z_args = z_expression.args;

					//
					switch (s_operator) {

						// infix operators
						case '>':case '<':case '>=':case '<=':
						case '&&':case '||':case '=':case '!=':
						case '+':case '-':case '*':case '/':

							// to each argument...
							z_args.forEach(function (z_arg, i_arg) {

								// pass the torch
								stringify_expression(add, z_arg);

								// not the last arg
								if (i_arg < z_args.length - 1) {

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
						case 'in':case 'not in':

							// stringify lhs
							stringify_expression(add, z_args[0]);

							// open list
							add(' (', true);

							// stringify rhs
							z_args[1].forEach(function (z_arg, i_arg, a_list) {

								// pass the torch
								stringify_expression(add, z_arg);

								// not the last list item
								if (i_arg < a_list.length - 1) {

									// join by comma
									add(', ', true);
								}
							});

							// close list
							add(')', true);
							return;

						// exists/not exists
						case 'exists':case 'not exists':

							// open block
							add.open(s_operator + (add.pretty ? ' ' : '') + '{', '', true);

							// each pattern..
							z_args.forEach(function (h_gp) {

								// pass torch to pattern producer
								produce_pattern(add, h_gp);
							});

							// close block
							add.close('}');
							return;

						//
						default:
							local.fail('expression cannot stringify unrecognized operator: ' + s_operator);
							return;
					}
					return;
			}
		}
		//
		else {
				local.fail('filter expects all expressions to be either [string] or [object], instead got: ' + (0, _arginfo2['default'])(z_expression));
			}
};

//
var H_PATTERNS = {

	// basic graph pattern
	bgp: function bgp(add, h_gp) {

		//
		var s_terminate = (add.pretty ? ' ' : '') + '.';

		// each triple in pattern
		h_gp.triples.map(function (h_triple) {

			//
			add(sparql_entity(h_triple.subject) + ' ' + sparql_entity(h_triple.predicate) + ' ' + sparql_entity(h_triple.object) + (h_triple.datatype ? '^^<' + h_triple.datatype + '>' : '') + s_terminate);
		});
	},

	// group block
	group: simple_pattern(''),

	// minus block
	minus: simple_pattern('minus'),

	// optional block
	optional: simple_pattern('optional'),

	//
	union: function union(add, h_gp) {

		// each pattern
		h_gp.patterns.forEach(function (h_pattern, i_pattern) {

			// open group/union block
			add.open((0 === i_pattern ? '' : 'union ') + '{');

			// pass query production torch to next pattern
			produce_pattern(add, h_pattern);

			// close group block
			add.close('}');
		});
	},

	//
	filter: function filter(add, h_gp) {

		// ref expression
		var z_expression = h_gp.expression;

		// expression is a pattern
		var b_pattern = 'object' === typeof z_expression && ['exists', 'not exists'].includes(z_expression.operator);

		// open filter
		add('filter' + (add.pretty ? ' ' : '') + (b_pattern ? '' : '(') + ' ');

		// pass query producing torch to stringify expression function
		stringify_expression(add, h_gp.expression);

		// close filter (if we need it)
		if (!b_pattern) {
			add(')', true);
		}
	}
};

//
var produce_pattern = function produce_pattern(add, h_gp) {

	// ref graph pattern type
	var s_type = h_gp.type;

	// lookup pattern
	if (!H_PATTERNS[s_type]) {
		local.fail('no such pattern type: "' + s_type + '"; in ' + (0, _arginfo2['default'])(h_gp));
	}

	// lookup pattern and apply producer
	H_PATTERNS[s_type](add, h_gp);
};

/**
* @class QueryBuilder
* using closure for private methods and fields
**/
var __construct = function __construct(h_init) {

	/**
 * private:
 **/

	// set parent
	var h_parent = h_init.parent;

	// set query type
	var s_query_type = h_init.type.toLowerCase();

	// prefixes
	var h_prologue_prefixes = new Map();

	// dataset clause [from]
	var a_from_default = new Set();
	var a_from_named = new Set();

	// where clause
	var a_where_ggps = [];

	// group, having, order clauses
	var a_group_conditions = new Set();
	var a_having_conditions = new Set();
	var a_order_conditions = new Set();

	// values clause
	var h_values_data = new Map();

	// load query directly from hash
	if (h_init.query) {

		// ref query
		var h_query = h_init.query;

		// prefixes
		if (h_query.prefixes) {

			// load each prefix into map
			for (var s_prefix in h_query.prefixes) {
				h_prologue_prefixes.set(s_prefix, h_query.prefixes[s_prefix]);
			}
		}

		// from graphs
		if (h_query.from) {

			// ref from
			var h_from = h_query.from;

			// default
			if (h_from['default']) {
				h_from['default'].forEach(function (p_graph) {
					return a_from_default.add('<' + p_graph + '>');
				});
			}
			// named
			if (h_from.named) {
				h_from.named.forEach(function (p_graph) {
					return a_from_named.add('<' + p_graph + '>');
				});
			}
		}

		// where clauses
		if (h_query.where) {
			a_where_ggps = h_query.where;
		}

		// TODO: everything else later
	}

	//
	var k_query_producer = (0, _rapunzel2['default'])({

		//
		prefix: function prefix(add) {

			// merge global and local prefixes
			var h_prefixes = new Map();
			var f_add_here = function f_add_here(p_uri, s_prefix) {
				h_prefixes.set(s_prefix, p_uri);
			};
			h_parent.prefixes.forEach(f_add_here);
			h_prologue_prefixes.forEach(f_add_here);

			// add each prefix item
			h_prefixes.forEach(function (p_uri, s_prefix) {
				add('prefix ' + s_prefix + ': <' + p_uri + '>');
			});
		},

		//
		dataset: function dataset(add) {

			//
			a_from_default.forEach(function (s_graph_iri) {
				add('from ' + s_graph_iri);
			});
			a_from_named.forEach(function (s_graph_iri) {
				add('from named ' + s_graph_iri);
			});
		},

		//
		where: function where(add) {

			// open where block
			add.open((add.pretty ? 'where ' : '') + '{');

			// recursively transform serialized object form to query string
			a_where_ggps.forEach(function (h_gp) {

				//
				produce_pattern(add, h_gp);
			});

			// close where block
			add.close('}');
		},

		solution: function solution(add) {

			//
		}

	}, ['prefix', 'query', 'dataset', 'where', 'solution']);

	//
	var i_global_blanknode = 0;

	//
	var next_blanknode = function next_blanknode() {
		// while(i_global_blanknode)
		return '_:b' + i_global_blanknode++;
	};

	//
	var add_prefix_item = function add_prefix_item(s_name, s_iri) {

		// prefix already defined locally
		if (h_prologue_prefixes.has(s_name)) {

			// prefixes are not identical
			if (h_prologue_prefixes.get(s_name) !== s_iri) {

				// issue warning
				local.warn('overwriting a local prefix will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing \'' + s_name + '\' prefix from <' + h_prologue_prefixes.get(s_name) + '> to <' + s_iri + '>');
			}
		}
		// prefix not yet defined (locally)
		else {

				// prefix already defined globally
				if (h_parent.prefix.has(s_name)) {

					// issue warning
					local.warn('overriding a global prefix by using a local one with the same name will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing \'' + s_name + '\' prefix from <' + h_parent.prefix.get(s_name) + '> to <' + s_iri + '>');
				}
			}

		// set the mapping no matter what
		h_prologue_prefixes.set(s_name, s_iri);
	};

	//
	var add_prologue_prefix = function add_prologue_prefix(z_prefix) {

		// SPARQL string prefix
		if ('string' === typeof z_prefix) {

			// split prefix name from iri

			var _z_prefix$trim$split = z_prefix.trim().split(/\s+/);

			var _z_prefix$trim$split2 = _slicedToArray(_z_prefix$trim$split, 2);

			var s_name = _z_prefix$trim$split2[0];
			var s_iri = _z_prefix$trim$split2[1];

			// match prefix regex
			var m_name = R_PREFIX.exec(s_name);

			// bad prefix name
			if (!m_name) {
				return local.fail('failed to match SPARQL prefix name: ' + (0, _arginfo2['default'])(s_name));
			}

			// match iri regex
			var m_iriref = R_IRIREF.exec(s_iri);

			// bad iri
			if (!m_iriref) {
				return local.fail('failed to match SPARQL prefix iri ref: ' + (0, _arginfo2['default'])(s_iriref));
			}

			//
			add_prefix_item(m_name[1] || '', m_iriref[1]);
		}
		// hash
		else if ('object' === typeof z_prefix) {

				// each item
				for (var s_name in z_prefix) {

					// ref iri
					var s_iri = z_prefix[s_name];

					// assert string
					if ('string' !== typeof s_iri) {
						return local.fail('prefix iri must be [string]. for "' + s_name + '" key it received: ' + (0, _arginfo2['default'])(s_iri));
					}

					//
					add_prefix_item(s_name, s_iri);
				}
			}
			// other
			else {
					return local.fail('prefix argument must be [string] or [object]. instead got: ' + (0, _arginfo2['default'])(z_prefix));
				}
	};

	//
	var serialize_prefixes = function serialize_prefixes() {

		// merge global prefixes with local ones
		return (0, _merge2['default'])(h_parent.prefix(), map_to_hash(h_prologue_prefixes));
	};

	//
	var expanded = function expanded(s_iri) {

		// variable or blanknode
		if ('?' === s_iri[0] || '_:' === s_iri.substr(0, 2)) {
			return s_iri;
		}
		// full uri
		else if (R_IRIREF.test(s_iri)) {

				// trim angle brackets
				return s_iri.substring(1, s_iri.length - 1);
			}
			// value
			else if ('"' === s_iri[0]) {

					// no type
					if ('"' === s_iri[s_iri.length - 1]) {
						return s_iri;
					}

					// match value metadata
					var m_value_metadata = R_VALUE_METADATA.exec(s_iri);

					// bad match
					if (!m_value_metadata) {
						return local.fail('failed to parse SPARQL literal: ' + (0, _arginfo2['default'])(s_iri));
					}

					// destruct match

					var _m_value_metadata = _slicedToArray(m_value_metadata, 4);

					var _s_value = _m_value_metadata[1];
					var s_language = _m_value_metadata[2];
					var s_type = _m_value_metadata[3];

					// prepare final uri
					var p_uri = _s_value;

					// language tag was specified
					if (s_language) {
						p_uri += '@' + s_language;
					}
					// type was specified (do not enclose url with angle brackets since sparqljs treats these as full irirefs)
					else if (s_type) {
							p_uri += '^^<' + expanded(s_type) + '>';
						}

					//
					return p_uri;
				}
				// prefixed name
				else {
						var _s_iri$split = s_iri.split(':');

						var _s_iri$split2 = _slicedToArray(_s_iri$split, 2);

						var s_name = _s_iri$split2[0];
						var s_path = _s_iri$split2[1];

						// attempt locally defined prefix
						var s_ref_base = h_prologue_prefixes.get(s_name);

						// not defined locally
						if (!s_ref_base) {

							// try globally
							s_ref_base = h_parent.prefix.get(s_name);

							// not defined globally either
							if (!s_ref_base) {
								return local.fail('no such prefix defined "' + s_name + '"');
							}
						}

						// build full iri
						return s_ref_base + s_path;
					}
	};

	// expands predicate
	var expanded_predicate = function expanded_predicate(s_iri) {

		// shortcut keyword
		var p_expanded_keyword = H_PREDICATE_ALIASES.get(s_iri);
		if (p_expanded_keyword) {
			return p_expanded_keyword;
		}

		// regular expand
		return expanded(s_iri);
	};

	//
	var serialize_raw_triple = function serialize_raw_triple(a_triple) {
		return {
			subject: expanded(a_triple[0]),
			predicate: expanded_predicate(a_triple[1]),
			object: expanded(a_triple[2])
		};
	};

	//
	var serialize_triples = function serialize_triples(a_triple) {

		// ref object of triple
		var z_object = a_triple[2];

		// object is a string (easy!)
		if ('string' === typeof z_object) {
			return [serialize_raw_triple(a_triple)];
		}
		// object is hash
		else if ('object' === typeof z_object) {
				return serialize_blanknode(a_triple);
			}
	};

	//
	var serialize_blanknode = function serialize_blanknode(a_triple) {

		// acquire new blanknode id
		var s_blanknode_id = next_blanknode();

		// prepare to store results and create root triple
		var a_results = [serialize_raw_triple([a_triple[0], a_triple[1], s_blanknode_id])];

		// ref object of triple
		var z_blanknode = a_triple[2];

		// create all subsequent triples
		if ('object' === typeof z_blanknode) {

			// each predicate/object pair
			for (var s_predicate in z_blanknode) {

				// concatenate each individual triple to this results list
				a_results = a_results.concat.apply(a_results,

				// serialize this triple
				serialize_triples([s_blanknode_id, s_predicate, z_blanknode[s_predicate]]));
			}
		}
		// unsupported type
		else {
				local.fail('blanknode creation does not support non-object type: ' + (0, _arginfo2['default'])(z_blanknode));
			}

		//
		return a_results;
	};

	//
	var serialize_nested_pairs = function serialize_nested_pairs(a_root) {

		// ref subject
		var s_subject = a_root[0];

		// ref predicate/object pairs
		var h_pairs = a_root[1];

		// prepare to store results
		var a_results = [];

		// each item in predicate/object pair
		for (var s_predicate in h_pairs) {

			// serialize this triple (append each item to existing triple group)
			a_results = a_results.concat.apply(a_results, serialize_triples([s_subject, s_predicate, h_pairs[s_predicate]]));
		}

		// return triples as array
		return a_results;
	};

	// sanitizes input from user in order to create serialized group graph pattern
	var serialize_group_graph_pattern = function serialize_group_graph_pattern(z_group) {

		// triple via array
		if (Array.isArray(z_group)) {

			// subject must be a string
			if ('string' !== typeof z_group[0]) {
				return local.fail('the subject of a triple-wannabe array must be a [string]. instead got: ' + (0, _arginfo2['default'])(z_group[0]));
			}

			// predicate-nested statement
			if (2 === z_group.length && 'object' === typeof z_group[1]) {

				// forward to pair serializer
				return {
					type: 'bgp',
					triples: serialize_nested_pairs(z_group)
				};
			}

			// otherwise must be a triple
			if (3 !== z_group.length) {
				return local.fail('encountered triple-wannabe array that does not have exactly three items: ' + (0, _arginfo2['default'])(z_group));
			}

			// predicate must be a string
			if ('string' !== typeof z_group[1]) {
				return local.fail('the prediate of a triple-wannabe array must be a [string]. instead got: ' + (0, _arginfo2['default'])(z_group[1]));
			}

			// forward to actual serializer
			return {
				type: 'bgp',
				triples: serialize_triples(z_group)
			};
		}
		// triple via SPARQL string
		else if ('string' === typeof z_group) {

				// split the string by whitespace
				var a_triple = z_group.trim().split(/\s+/);

				// must be a triple
				if (3 !== a_triple.length) {
					return local.fail('splitting this SPARQL triple by whitespace did not yield exactly three items: ' + (0, _arginfo2['default'])(z_group));
				}

				// forward to actual serializer
				return {
					type: 'bgp',
					triples: serialize_triples(a_triple)
				};
			}
			// special type
			else if ('object' === typeof z_group && 'string' === typeof z_group.type) {

					// ref type
					var s_type = z_group.type.toLowerCase();

					// unrecognized pattern type
					if (!A_PATTERN_TYPES.has(s_type)) {
						return local.fail('serializer does not recognize "' + s_type + '" type pattern block');
					}

					// work here is done
					return z_group;
				}
				// prefix resolver
				else if ('function' === typeof z_group) {

						// apply resolver function
						return z_group.apply({

							// pass callback the means to serialize it's patterns
							serialize_pattern: function serialize_pattern(s_type, a_patterns) {
								return {
									type: s_type,
									patterns: a_patterns.map(function (z_pattern) {
										return serialize_group_graph_pattern(z_pattern);
									})
								};
							},

							// pass callback the means to serialize a filer block
							serialize_filter: function serialize_filter(s_operator, a_patterns) {
								return {
									type: 'filter',
									expression: {
										type: 'operation',
										operator: s_operator,
										args: a_patterns.map(function (z_pattern) {
											return serialize_group_graph_pattern(z_pattern);
										})
									}
								};
							}
						});
					}
					//
					else {
							local.fail('serializer does not recognize argument as a valid serialized SPARQL object: ' + (0, _arginfo2['default'])(z_group));
						}
	};

	//
	var clear_from_graphs = function clear_from_graphs() {

		// clear default graphs
		a_from_default.clear();

		// clear named graphs
		a_from_named.clear();
	};

	//
	var add_from_graph = function add_from_graph(z_graph) {

		// add a default graph
		if ('string' === typeof z_graph) {
			a_from_default.add(z_graph);
		}
		// add default/named graphs
		else if ('object' === typeof z_graph) {

				// add named graph(s)
				if (z_graph.hasOwnProperty('named')) {

					// ref named value
					var z_named = z_graph.named;

					// single named graph
					if ('string' === typeof z_named) {
						a_from_named.add(z_named);
					}
					// named graph array
					else if (Array.isArray(z_named)) {

							// empty array
							if (0 === z_named.length) {

								// clear named graphs
								a_from_named.clear();
							}
							// multiple named graphs
							else {

									// each item
									z_named.forEach(function (p_graph) {

										// indeed a string (iri path)
										if ('string' === typeof p_graph) {
											a_from_named.add(p_graph);
										}
										// not a string!
										else {
												local.error('invalid from named graph item: ' + (0, _arginfo2['default'])(p_graph));
											}
									});
								}
						}
						// bad value in named graph object
						else {
								local.error('from named graph value must be a [string] or [Array]; instead got: ' + (0, _arginfo2['default'])(z_named));
							}
				}

				// add default graph(s)
				if (z_graph.hasOwnProperty('default')) {

					// ref default value
					var z_default = z_graph['default'];

					// single named graph
					if ('string' === typeof z_default) {
						a_from_default.add(z_default);
					}
					// default graph array
					else if (Array.isArray(z_default)) {

							// empty array
							if (0 === z_default.length) {

								// clear default graphs
								a_from_default.clear();
							}
							// multiple default graphs
							else {

									// each item
									z_default.forEach(function (p_graph) {

										// indeed a string (iri path)
										if ('string' === typeof p_graph) {
											a_from_default.add(p_graph);
										}
										// not a string!
										else {
												local.error('invalid from default graph item: ' + (0, _arginfo2['default'])(p_graph));
											}
									});
								}
						}
						// bad value in named graph object
						else {
								local.error('from default graph value must be a [string] or [Array]; instead got: ' + (0, _arginfo2['default'])(z_default));
							}
				}
			}
			// bad graph value
			else {
					local.error('cannot add from graph: ' + (0, _arginfo2['default'])(z_graph));
				}
	};

	//
	var serialize_from_graphs = function serialize_from_graphs() {

		// return plain object (hash) of default and named graphs as arrays
		return {
			'default': Array.from(a_from_default),
			named: Array.from(a_from_named)
		};
	};

	//
	var add_values_data = function add_values_data(z_block) {

		// direct SPARQL block
		if ('string' === typeof z_block) {}

		// TODO: parse block

		// key/value map
		else if ('object' === typeof z_block) {
				var _loop = function (_ref) {
					_ref2 = _slicedToArray(_ref, 2);
					var s_var = _ref2[0];
					var z_data = _ref2[1];

					// prepare ref to set of values for this var
					var a_data = undefined;

					// map indeed has this key
					if (h_values_data.has(s_var)) {

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
					if (Array.isArray(z_data)) {

						// append each item to the set
						z_data.forEach(function (s_value) {

							// assert type
							if ('string' === typeof s_value) {
								a_data.add(s_value);
							}
							// non-string
							else {
									local.error('values clause expects data to be [string]. instead got: ' + (0, _arginfo2['default'])(s_value));
								}
						});
					}
					// item is string
					else if ('string' === typeof z_block) {

							// append to set
							a_data.add(s_value);
						}
				};

				// each item
				for (var _ref in z_block) {
					var _ref2;

					_loop(_ref);
				}
			}
			// unexpected type
			else {
					local.fail('values argument must be either [string] or [object]. instead got: ' + (0, _arginfo2['default'])(z_block));
				}
	};

	// all queries extend this class

	var basic_query = (function () {

		//

		function basic_query(s_type) {
			var _this = this;

			_classCallCheck(this, basic_query);

			// set query type
			this.query_type = s_type;

			// add `.clear` method to `where`
			this.where.clear = function () {

				// allow user to clear all graph patterns
				a_where_ggps.length = 0;

				// enable chaining
				return _this;
			};
		}

		// add methods to basic query class

		// don't use BASE, ever.

		_createClass(basic_query, [{
			key: 'base',
			value: function base() {

				//
				local.fail('spaz does not support using the BASE keyword in SPARQL. Instead, use a PREFIX by invoking the .prefix() method');
			}

			// specifiy where clause
		}, {
			key: 'where',
			value: function where() {
				for (var _len = arguments.length, a_groups = Array(_len), _key = 0; _key < _len; _key++) {
					a_groups[_key] = arguments[_key];
				}

				// empty-args getter
				if (0 === a_groups.length) {
					return a_where_ggps;
				}

				//
				a_groups.forEach(function (z_group) {

					//
					var h_ggp = serialize_group_graph_pattern(z_group);

					//
					var h_previous = a_where_ggps[a_where_ggps.length - 1];

					// previous ggp exists & is of same type
					if (h_previous && h_previous.type === h_ggp.type) {

						// triples
						if (Array.isArray(h_ggp.triples)) {

							// append triples onto existing previous group
							h_previous.triples = h_previous.triples.concat.apply(h_previous.triples, h_ggp.triples);
						}
						// patterns
						else if (h_ggp.patterns) {

								// append patterns onto existing previous group
								h_previous.patterns = h_previous.patterns.concat.apply(h_previous.patterns, h_ggp.patterns);
							}
							// filters
							else if (h_ggp.expression) {

									// append new ggp
									a_where_ggps.push(h_ggp);
								}
								// uh-oh
								else {
										local.warn('not sure what to do with "' + h_ggp.type + '" block because it doesn\'t have triples or patterns to merge. this is probably my fault');
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
		}, {
			key: 'limit',
			value: function limit(n_size) {
				if (assert_integer(n_size, 'limit')) {
					n_limit = n_size;
				}
			}

			// offset clause
		}, {
			key: 'offset',
			value: function offset(n_amount) {
				if (assert_integer(n_amount, 'offset')) {
					n_offset = n_amount;
				}
			}

			// values clause
		}, {
			key: 'values',
			value: function values() {}

			/**
   * helpers
   **/

			// filter where
		}, {
			key: 'filter',
			value: function filter() {
				for (var _len2 = arguments.length, e_exprs = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
					e_exprs[_key2] = arguments[_key2];
				}

				return this.where(h_parent.filter.apply(h_parent, e_exprs));
			}
		}, {
			key: 'toString',
			value: function toString() {
				return this.query_type + ' query';
			}

			// dummy abstract method
		}, {
			key: 'serialize_variables',
			value: function serialize_variables() {
				return [];
			}

			//
		}, {
			key: 'serialize',
			value: function serialize() {

				// empty-args getter
				return {
					type: 'query',
					queryType: s_query_type.toUpperCase(),
					prefixes: serialize_prefixes(),
					variables: this.serialize_variables(),
					from: serialize_from_graphs(),
					where: a_where_ggps
				};
			}

			//
		}, {
			key: 'patterns',
			value: function patterns() {
				return (0, _queryPatterns2['default'])({
					prefixes: h_prologue_prefixes,
					where: a_where_ggps
				});
			}
		}, {
			key: 'toSparql',
			value: function toSparql(h_options) {
				return k_query_producer.produce(h_options);
			}
		}, {
			key: 'sparql',
			value: function sparql() {

				// generate the query string
				var s_query = k_query_producer.produce({
					pretty: false
				});

				// prepare to optimize the query string
				var s_optimized = '';

				// create quoted-string finding regex
				var r_next_quote = /"(?:[^"\\]|\\.)*"/g;

				// where to start each substring to gather non-string parts of query
				var i_range_start = 0;

				// find all matches
				while (true) {

					// bookmark previous match's end
					i_range_start = r_next_quote.lastIndex;

					// find next quoted string
					var m_next_quote = r_next_quote.exec(s_query);

					// no match found; stop
					if (null === m_next_quote) break;

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
		}, {
			key: 'dump',
			value: function dump() {
				local.info(this.toSparql({
					pretty: true
				}));

				return this;
			}
		}]);

		return basic_query;
	})();

	add_methods(basic_query, {

		// adds prefixes to this query's internal map
		prefix: (0, _overloader2['default'])({

			// reset local prefixes, then add new ones
			reset: function reset(a_items) {

				// clear local prefixes
				h_prologue_prefixes.clear();

				// apply each item in the array
				a_items.forEach(add_prologue_prefix);
			},

			// returns set of prefixes
			fetch: {

				// return only local prefixes as hash
				soft: function soft() {
					return map_to_hash(h_prologue_prefixes);
				},

				// return both local and global prefixes as hash
				hard: serialize_prefixes
			},

			// add new prefixes
			add: function add(a_prefixes) {
				a_prefixes.forEach(add_prologue_prefix);
			}
		}),

		// specify graph(s) to query from
		from: (0, _overloader2['default'])({

			reset: function reset(a_items) {

				// clear all from graphs
				clear_from_graphs();

				// apply each item in the array
				a_items.forEach(add_from_graph);
			},

			fetch: {

				// return all graphs (default and named) as list
				soft: function soft() {
					return Array.from(a_from_default).concat(Array.from(a_from_named));
				},

				// return graphs as hash
				hard: function hard() {
					return serialize_from_graphs();
				}
			},

			// add graphs
			add: function add(a_graphs) {
				a_graphs.forEach(add_from_graph);
			}
		}),

		// values clause
		values: (0, _overloader2['default'])({

			reset: function reset(a_items) {

				// clear values
				h_values_data.clear();

				// apply each item in array
				a_items.forEach(add_values_data);
			},

			// simply convert map => hash
			fetch: function fetch() {
				return map_to_hash(h_values_data);
			},

			// add values data
			add: function add(a_values) {
				a_values.forEach(add_values_data);
			}
		})
	});

	// clause conditioner [group, having, order]
	(function () {

		// set which clauses map to which private fields
		var h_condition_clauses = {
			group: a_group_conditions,
			having: a_having_conditions,
			order: a_order_conditions
		};

		// process hash map
		Object.keys(h_condition_clauses).forEach(function (s_method) {

			// ref condition set
			var a_these_conditions = h_condition_clauses[s_method];

			// prepare add condition function
			var add_this_condition = function add_this_condition(s_condition) {

				// strong type string
				if ('string' === typeof s_condition) {
					a_these_conditions.add(s_condition);
				}
				// non-string
				else {
						local.error(s_method + ' clause expects a [string] condition. instead got: ' + (0, _arginfo2['default'])(s_condition));
					}
			};

			// extend basic query class prototype with new method (must use `function` keyword! so that `this` is contextual)
			basic_query.prototype[s_method] = (0, _overloader2['default'])({

				reset: function reset(a_items) {

					// clear conditions
					a_these_conditions.clear();

					// apply each item in the array
					a_items.forEach(add_this_condition);
				},

				fetch: function fetch() {

					// simple convert set => array
					return Array.from(a_these_conditions);
				},

				// add conditions
				add: function add(a_conditions) {
					a_conditions.forEach(add_this_condition);
				}
			});
		});
	})();

	// ask query
	if ('ask' === s_query_type) {

		// define query-specific clause for producer
		k_query_producer.set('query', function (add) {

			// ASK keyword, all done!
			add('ask');
		});

		// done!
		return new ((function (_basic_query) {
			_inherits(_class, _basic_query);

			function _class() {
				_classCallCheck(this, _class);

				_get(Object.getPrototypeOf(_class.prototype), 'constructor', this).apply(this, arguments);
			}

			_createClass(_class, [{
				key: 'answer',

				// results method
				value: function answer(f_okay_answer) {

					// submit a SPARQL query expecting content of type: sparql-results
					h_parent.submit(this.sparql(), 'table', function (h_response) {

						// forward the boolean response value to callback listener
						f_okay_answer(h_response['boolean']);
					});
				}
			}]);

			return _class;
		})(basic_query))(s_query_type);
	}
	// select query
	else if ('select' === s_query_type) {
			var _ret2 = (function () {

				// private fields for select query class
				var a_select_variables = new Set();
				var h_select_expressions = new Map();

				// load query directly from hash
				if (h_init.query) {

					// ref query
					var h_query = h_init.query;

					// select variables
					if (h_query.variables) {
						h_query.variables.forEach(function (z_field) {

							// simple variable
							if ('string' === typeof z_field) {
								a_select_variables.add(z_field);
							}
							// expression
							else {

									// add variable
									a_select_variables.add(z_field.variable);

									// create expression string
									var s_expr = (function build_expr(z_expr) {
										if ('string' === typeof z_expr) {
											return z_expr.replace(/\^\^(.+)$/, '^^<$1>');
										}
										var s_ = '';
										switch (z_expr.type) {
											case 'operation':
												return z_expr.args.map(build_expr).join(z_expr.operator);
											default:
												local.fail('init loader unrecognized expr type: `' + z_expr.type + '`');
										}
									})(z_field.expression);

									// set expression
									h_select_expressions.set(z_field.variable, s_expr);
								}
						});
					}
				}

				// define select clause producer
				k_query_producer.set('query', function (add) {

					// select keyword
					add.open('select');

					// no variables
					if (!a_select_variables.size) {
						add('*', true);
					}
					// yes variables
					else {

							// each variable/expression in select clause
							a_select_variables.forEach(function (s_var) {

								// variable is alias for expression
								if (h_select_expressions.has(s_var)) {
									add(h_select_expressions.get(s_var) + ' as ' + s_var, add.ugly);
								}
								// plain variable
								else {
										add('' + s_var, add.ugly);
									}
							});
						}

					// decrease indentation
					add.close();
				});

				//
				var clear_select_expressions = function clear_select_expressions() {

					// clear variables set
					a_select_variables.clear();

					// clear expressions map
					h_select_expressions.clear();
				};

				//
				var add_select_expression = function add_select_expression(z_expression) {

					// argument passed as hash
					if ('object' === typeof z_expression) {

						// iterate hash
						for (var s_key in z_expression) {

							// match variable key
							var m_var = R_VAR.exec(s_key);
							if (m_var) {

								// prepend variable with '?' character
								var s_var = '?' + m_var[1];

								// add variable to list
								a_select_variables.add(s_var);

								// set mapping for corresponding expression
								h_select_expressions.set(s_var, z_expression[s_key]);
							}
							// key doesn't match
							else {
									local.fail('"' + s_key + '" is an invalid name for a SPARQL variable');
								}
						}
					}
					// argument passed as string
					else if ('string' === typeof z_expression) {

							// first try to match simple variable regex
							var m_var = R_VAR.exec(z_expression);

							// simple variable match
							if (m_var) {

								// destructure capture groups from match

								var _m_var = _slicedToArray(m_var, 2);

								var s_var = _m_var[1];

								// prepend variable with '?' character
								s_var = '?' + s_var;

								// an expression already exists that is aliasing variable
								if (h_select_expressions.has(s_var)) {

									// remove that expression
									h_select_expressions['delete'](s_var);
								}

								// add simple variable to set
								a_select_variables.add(s_var);
							}
							// either expression or invalid variable name
							else {

									// try match expression regex
									var m_expression = R_EXPRESSION.exec(z_expression);

									// expression match
									if (m_expression) {

										// destructure capture groups from match

										var _m_expression = _slicedToArray(m_expression, 3);

										var s_expr = _m_expression[1];
										var s_var = _m_expression[2];

										// prepend variable with '?' character
										s_var = '?' + s_var;

										// update select variable/expression
										a_select_variables.add(s_var);
										h_select_expressions.set(s_var, s_expr);
									}
									// invalid variable/expression
									else {
											local.fail('"' + z_expression + '" is either an invalid name for a SPARQL variable, or is an invalid expression to use in a SELECT clause');
										}
								}
						}
						// argument pass as other
						else {
								return local.fail('must pass [string] to select expression. instead got: ' + (0, _arginfo2['default'])(z_expression));
							}
				};

				//
				var serialize_select_expressions = function serialize_select_expressions() {

					// create array
					var a_serial = [];

					// iterate variables to create keys for hash
					var _iteratorNormalCompletion2 = true;
					var _didIteratorError2 = false;
					var _iteratorError2 = undefined;

					try {
						for (var _iterator2 = a_select_variables[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
							var s_var = _step2.value;

							// this variable has a corresponding expression
							if (h_select_expressions.has(s_var)) {

								// set key/value pair in plain object
								a_serial.push({
									expression: h_select_expressions.get(s_var),
									variable: s_var
								});
							}
							// simple variable
							else {

									// set dummy value for simple variable as key
									a_serial.push(s_var);
								}
						}

						//
					} catch (err) {
						_didIteratorError2 = true;
						_iteratorError2 = err;
					} finally {
						try {
							if (!_iteratorNormalCompletion2 && _iterator2['return']) {
								_iterator2['return']();
							}
						} finally {
							if (_didIteratorError2) {
								throw _iteratorError2;
							}
						}
					}

					return a_serial;
				};

				//
				return {
					v: new ((function (_basic_query2) {
						_inherits(_class2, _basic_query2);

						function _class2() {
							_classCallCheck(this, _class2);

							_get(Object.getPrototypeOf(_class2.prototype), 'constructor', this).apply(this, arguments);
						}

						_createClass(_class2, [{
							key: 'select',

							// sets the expressions used for select query
							value: function select() {
								for (var _len3 = arguments.length, z_select = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
									z_select[_key3] = arguments[_key3];
								}

								// ref args length and 0th arg
								var n_args = z_select.length;
								var z_arg0 = z_select[0];

								// single argument
								if (n_args === 1) {

									// clear current selection and select all fields instead
									if ('*' === z_arg0) {
										clear_select_expressions();
									}
									// replace current selection
									else if (Array.isArray(z_arg0)) {

											// clear current selection
											clear_select_expressions();

											// apply method to each item
											z_arg0.forEach(add_select_expression);
										}
										// append to current selection
										else if ('string' === typeof z_arg0 || 'object' === typeof z_arg0) {
												add_select_expression(z_arg0);
											}
											// fetch current select expression as hash
											else if (true === z_arg0) {
													return serialize_select_expressions();
												}
												// fetch current variable list as an array
												else if (false === z_arg0) {
														return Array.from(a_select_variables);
													}
													//
													else {
															local.fail('select does not work on: ' + (0, _arginfo2['default'])(z_arg0));
														}
								}
								// no args: fetch current variable list as an array
								else if (!n_args) {
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
						}, {
							key: 'distinct',
							value: function distinct() {
								var b_use_distinct = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

								b_select_distinct = b_use_distinct ? true : false;
								return this;
							}

							// sets reduced on or off (use of REDUCED keyword in select clause)
						}, {
							key: 'reduced',
							value: function reduced() {
								var b_use_reduced = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

								b_select_reduced = b_use_reduced ? true : false;
								return this;
							}

							//
						}, {
							key: 'serialize_variables',
							value: function serialize_variables() {
								return serialize_select_expressions();
							}
						}]);

						return _class2;
					})(basic_query))(s_query_type)
				};
			})();

			if (typeof _ret2 === 'object') return _ret2.v;
		}
		// describe query
		else if ('describe' === s_query_type) {
				var _ret3 = (function () {

					// describe targets
					var a_describe_targets = new Set();

					//
					var add_describe_target = function add_describe_target(s_target) {

						//
						a_describe_targets.add(s_target);
					};

					// define describe clause producer
					k_query_producer.set('query', function (add) {

						// describe keyword; increase indentation
						add.open('describe');

						// no targets
						if (!a_describe_targets.size) {

							//
							return local.fail('nothing to describe!');
						}

						// each target in describe clause
						a_describe_targets.forEach(function (s_target) {

							// add target; keep all targets on one line
							add(s_target, true);
						});

						// decrease indentation
						add.close();
					});

					// done!
					var describe_query = (function (_basic_query3) {
						_inherits(describe_query, _basic_query3);

						function describe_query() {
							_classCallCheck(this, describe_query);

							_get(Object.getPrototypeOf(describe_query.prototype), 'constructor', this).apply(this, arguments);
						}

						_createClass(describe_query, [{
							key: 'browse',

							// results method
							value: function browse(s_namespace, f_ready) {
								var _this2 = this;

								//
								var s_sparql = this.sparql();

								// submit a SPARQL query expecting a graph
								h_parent.submit(s_sparql, 'graph', function (h_response) {

									// send graph data to callback
									f_ready.apply(_this2, [

									// pipe the json-ld object to graphy
									(0, _graphy2['default'])(h_response).network(s_namespace),

									// send callback normal json-ld
									h_response,

									// include sparql string that was sent to engine
									s_sparql]);
								});

								// continue chaining
								return this;
							}
						}]);

						return describe_query;
					})(basic_query);

					// add methods to describe query
					add_methods(describe_query, {

						// describe target(s)
						describe: (0, _overloader2['default'])({

							// reset targets, then add new ones
							reset: function reset(a_targets) {

								// clear targets
								a_describe_targets.clear();

								// apply each target
								a_targets.forEach(add_describe_target);
							},

							// returns describe targets as array
							fetch: function fetch() {
								return Array.from(a_describe_targets);
							},

							// add new targets
							add: function add(a_targets) {
								a_targets.forEach(add_describe_target);
							}
						})
					});

					// create & return new describe query
					return {
						v: new describe_query(s_query_type)
					};
				})();

				if (typeof _ret3 === 'object') return _ret3.v;
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
var local = function local() {

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
	local.toString = function () {
		return __class_name + '()';
	};

	// prefix output messages to console with class's tag
	require('./log-tag.js').extend(local, __class_name);
}

exports['default'] = local;
module.exports = exports['default'];

// split by colon