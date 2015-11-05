// native imports
'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

// libraries

var _arginfo = require('arginfo');

var _arginfo2 = _interopRequireDefault(_arginfo);

var _extend = require('extend');

var _extend2 = _interopRequireDefault(_extend);

var _sparqljs = require('sparqljs');

var _sparqljs2 = _interopRequireDefault(_sparqljs);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

// local modules

var _overloader = require('./overloader');

var _overloader2 = _interopRequireDefault(_overloader);

var _queryBuilder = require('./query-builder');

var _queryBuilder2 = _interopRequireDefault(_queryBuilder);

//
var sparql_parser = _sparqljs2['default'].Parser;

/**
* private static:
**/

// meta class setup
var __class_name = 'Spaz';

// class constants

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
var A_VALID_TABLE_HTTP_METHODS = ['get', 'post'];
var A_VALID_GRAPH_HTTP_METHODS = ['get', 'post'];
var A_VALID_UPDATE_HTTP_METHODS = ['put'];

//
var setup_remote = function setup_remote(h_engine) {

	// prepare http method to use for table-result queries
	var s_table_method = A_VALID_TABLE_HTTP_METHODS[0];

	// prepare http method to use for graph-result queries
	var s_graph_method = A_VALID_GRAPH_HTTP_METHODS[0];

	// prepare results parser
	var f_parser = function f_parser(s_body) {
		return new Promise(function (f_resolve, f_reject) {
			try {
				f_resolve(JSON.parse(s_body));
			} catch (e) {
				f_reject(e);
			}
		});
	};

	// engine gives method option
	if (h_engine.http_methods) {

		// ref http methods
		var h_http_methods = h_engine.http_methods;

		// http method to use for table-result queries
		if (h_http_methods.table) {

			// invalid http method for table-result queries
			if (!A_VALID_TABLE_HTTP_METHODS.includes(h_http_methods.table)) {
				return local.fail('invalid HTTP method to use for table-result queries: ' + h_http_methods.table);
			}

			// set http method for table-result queries
			s_table_method = h_http_methods.table;
		}

		// http method to use for graph-result queries
		if (h_http_methods.graph) {

			// ref http method
			var s_method = h_http_methods.graph.toLowerCase();

			// invalid http method for table-result queries
			if (!A_VALID_GRAPH_HTTP_METHODS.includes(s_method)) {
				return local.fail('invalid HTTP method to use for graph-result queries: ' + s_method);
			}

			// set http method for graph-result queries
			s_graph_method = s_method;
		}
	}

	// engine interface function
	var k_engine = function k_engine(s_sparql, s_type) {

		// prepare http method
		var s_method = undefined;

		// prepare http accept header
		var s_accept = undefined;

		// tabular result query (ASK, SELECT)
		if ('table' === s_type) {
			s_method = s_table_method;
			s_accept = 'application/sparql-results+json';
		}
		// graph result query (DESCRIBE)
		else if ('graph' === s_type) {
				s_method = s_graph_method;
				s_accept = 'application/ld+json';
			}
			// invalid execution type
			else {
					return local.fail('invalid execution type: ' + s_type);
				}

		// prepare request options
		var h_request = {
			method: s_method,
			url: h_engine.url,
			headers: {
				Accept: s_accept
			}
		};

		// set query data
		var h_query_data = {
			query: s_sparql
		};

		// GET method
		if ('get' === s_method) {

			// set query string
			h_request.qs = h_query_data;
		}
		// POST method
		else if ('post' === s_method) {

				// set form data
				h_request.form = h_query_data;
			}

		//
		return new Promise(function (f_resolve, f_reject) {

			// submit request
			(0, _request2['default'])(h_request, function (h_err, h_response, s_body) {

				//
				if (h_err) {
					return f_reject(h_err);
				}

				// parse body
				f_parser(s_body)
				// success
				.then(function (h_json) {

					// forward to callback
					f_resolve(h_json);
				})
				// parse error
				['catch'](function (e) {

					// decide how to handle errors
					f_reject(e);
					local.fail(e);
				});
			});
		});
	};

	//
	return k_engine;
};

// engine setup router
var setup_engine = function setup_engine(h_engine) {

	// remote engine type
	if ('remote' === h_engine.type) {
		return setup_remote(h_engine);
	}

	//
	local.fail('unknown engine type "' + h_engine.type + '": ' + (0, _arginfo2['default'])(h_engine));
};

/**
* @class Spaz
* using closure for private methods and fields
**/
var __construct = function __construct(h_config) {

	/**
 * private:
 **/

	// prefixes
	var h_prologue_prefixes = new Map([

	// defaults
	['xsd', 'http://www.w3.org/2001/XMLSchema#'], ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'], ['owl', 'http://www.w3.org/2002/07/owl#']]);

	//
	var add_prefix_item = function add_prefix_item(s_name, s_iri) {

		// prefix already defined
		if (h_prologue_prefixes.has(s_name)) {

			// prefixes are not identical
			if (h_prologue_prefixes.get(s_name) !== s_iri) {

				// issue warning
				local.warn('overwriting a global prefix will not change the final uris of prefixed names committed to the graph pattern prior! I hope you understand what this means...\n changing \'' + s_name + '\' prefix from <' + h_prologue_prefixes.get(s_name) + '> to <' + s_iri + '>');
			}
		}
		// prefix not yet defined
		else {
				h_prologue_prefixes.set(s_name, s_iri);
			}
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
			var m_iri = R_IRI.exec(s_iri);

			// bad iri
			if (!m_iri) {
				return local.fail('failed to match SPARQL prefix iri: ' + (0, _arginfo2['default'])(s_iri));
			}

			//
			add_prefix_item(m_name[1], m_iri[1]);
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
	var k_engine = undefined;

	// initialization
	(function () {

		// config
		if (h_config) {

			// prefixes
			if (h_config.prefixes) {
				add_prologue_prefix(h_config.prefixes);
			}

			// engine
			if (h_config.engine) {

				// ref config engine hash
				var h_config_engine = h_config.engine;

				// prepare engine hash
				var h_engine = {};

				// remote engine
				if (h_config_engine.endpoint) {

					// set remote engine type
					h_engine.type = 'remote';

					// ref endpoint
					var z_endpoint = h_config_engine.endpoint;

					// endpoint type is string
					if ('string' === typeof z_endpoint) {
						h_engine.url = z_endpoint;
					}
					// endpoint type is object
					else if ('object' === typeof z_endpoint) {

							// not yet supported
							return local.fail('endpoint hash argument not yet supported');
						}
						// invalid type
						else {

								// not yet supported
								return local.fail('unexpected \'engine.endpoint\' value type: ' + (0, _arginfo2['default'])(z_endpoint));
							}

					// set http methods
					if (h_config_engine.http_methods) {

						// ref methods
						var z_http_methods = h_config_engine.http_methods;

						// http methods type is string
						if ('string' === typeof z_http_methods) {

							// ref method
							var s_method = z_http_methods.toLowerCase();

							// shortcut sets table and graph methods at once
							if (['get', 'post'].includes(s_method)) {
								h_engine.http_methods = {
									table: s_method,
									graph: s_method
								};
							}
							// invalid shortcut name
							else {
									local.fail('no such HTTP method shortcut named "' + s_method + '"');
								}
						}
						// http methods type is object
						else if ('object' === typeof z_http_methods) {

								// set directly
								h_engine.http_methods = z_http_methods;
							}
							// unknown type
							else {
									local.fail('unexpected \'engine.http_methods\' value type: ' + (0, _arginfo2['default'])(z_http_methods));
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
	var _operator = function operator(s_sparql) {

		// prepare to inject prefixes
		var s_injected_prefixes = '';

		// build prefix strings
		var _iteratorNormalCompletion2 = true;
		var _didIteratorError2 = false;
		var _iteratorError2 = undefined;

		try {
			for (var _iterator2 = h_prologue_prefixes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
				var _step2$value = _slicedToArray(_step2.value, 2);

				var s_prefix = _step2$value[0];
				var p_iri = _step2$value[1];

				s_injected_prefixes += 'prefix ' + s_prefix + ': <' + p_iri + '>';
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

		var h_query = new sparql_parser().parse(s_injected_prefixes + s_sparql);

		//
		return new _queryBuilder2['default']({
			parent: _operator,
			type: h_query.queryType,
			query: h_query
		});
	};

	// simple group patterns
	['group', 'union', 'minus', 'optional'].forEach(function (s_pattern_type) {
		_operator[s_pattern_type] = function () {
			for (var _len = arguments.length, a_patterns = Array(_len), _key = 0; _key < _len; _key++) {
				a_patterns[_key] = arguments[_key];
			}

			return function () {
				return this.serialize_pattern(s_pattern_type, a_patterns);
			};
		};
	});

	/**
 * public:
 **/
	_operator = (0, _extend2['default'])(_operator, {

		// adds prefixes to this instance's internal map
		prefix: (0, _overloader2['default'])({

			// reset global prefixes, then add new ones
			reset: function reset(a_items) {

				// clear global prefixes
				h_prologue_prefixes.clear();

				// apply each item in the array
				a_items.forEach(add_prologue_prefix);
			},

			// returns global prefixes as hash
			fetch: function fetch() {
				return map_to_hash(h_prologue_prefixes);
			},

			// add new prefixes
			add: function add(a_prefixes) {
				a_prefixes.forEach(add_prologue_prefix);
			},

			// allow getter access to underlying map
			map: h_prologue_prefixes
		}),

		// new ASK query
		ask: function ask() {

			// create new query builder
			var q_query = new _queryBuilder2['default']({
				parent: _operator,
				type: 'ask'
			});

			// args were given

			for (var _len2 = arguments.length, a_args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
				a_args[_key2] = arguments[_key2];
			}

			if (a_args.legth) {

				// forward arguments
				return q_query.where.apply(q_query, a_args);
			}

			// return query builder
			return q_query;
		},

		// new SELECT query
		select: function select() {

			// create new query builder
			var q_query = new _queryBuilder2['default']({
				parent: _operator,
				type: 'select'
			});

			// args were given

			for (var _len3 = arguments.length, a_args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
				a_args[_key3] = arguments[_key3];
			}

			if (a_args.length) {

				// forward arguments
				return q_query.select.apply(q_query, a_args);
			}

			// return query builder
			return q_query;
		},

		// new DESCRIBE query
		describe: function describe() {

			// create new query builder
			var q_query = new _queryBuilder2['default']({
				parent: _operator,
				type: 'describe'
			});

			// args were given

			for (var _len4 = arguments.length, a_args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
				a_args[_key4] = arguments[_key4];
			}

			if (a_args.length) {

				// forward arguments
				return q_query.describe.apply(q_query, a_args);
			}

			// return query builder
			return q_query;
		},

		// query builder
		build: function build(s_type) {
			switch (s_type) {
				case 'ask':
				case 'select':
					return new _queryBuilder2['default']({
						parent: _operator,
						type: s_type
					});
				case 'insert':
				case 'update':
				default:
					return exports.fail('cannot build "' + s_type + '". That alias is not recognized');
			}
		},

		// helper
		val: function val(z_value, s_type) {

			// no type given
			if ('undefined' === typeof s_type) {

				// boolean
				if ('boolean' === typeof z_value) {
					s_type = 'xsd:boolean';
				}
				// numeric
				else if ('number' === typeof z_value) {

						// integer
						if (Number.isInteger(z_value)) {
							s_type = 'xsd:integer';
						}
						//
						else if (isNaN(z_value) || !isFinite(z_value)) {
								return local.fail('cannot create numeric value for non-finite / NaN type: ' + (0, _arginfo2['default'])(z_value));
							}
							// float
							else {
									s_type = 'xsd:decimal';
								}
					}
					// string
					else if ('string' === typeof z_value) {

							// escape double quote chars
							z_value = z_value.replace(/"/g, '\\"');

							// set string type
							s_type = 'xsd:string';
						}
						// unsupported type
						else {
								return local.fail('.val method does not support this type of value: ' + (0, _arginfo2['default'])(z_value));
							}
			}
			// bad type
			else if ('string' !== typeof s_type) {
					return local.fail('cannot use non-string to describe type of val: ' + (0, _arginfo2['default'])(s_type));
				}

			//
			return '"' + z_value + '"^^' + s_type;
		},

		//
		filter: function filter() {
			for (var _len5 = arguments.length, a_exprs = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
				a_exprs[_key5] = arguments[_key5];
			}

			//
			var s_expression = a_exprs.map(function (z_expr) {

				// SPARQL string
				if ('string' === typeof z_expr) {

					// simple concatenation
					return z_expr;
				}
				// array indicates special meaning
				else if (Array.isArray(z_expr)) {

						// ref last arg
						var z_val = z_expr[z_expr.length - 1];

						//
						if ('object' === typeof z_val) {

							// regex
							if (z_val instanceof RegExp) {

								// must be two args
								if (2 !== z_expr.length) {
									local.fail('filter with regular expression must have exactly 2 arguments. instead got ' + z_expr.length + ': ' + (0, _arginfo2['default'])(z_expr));
								}

								// ref test arg
								var s_test = z_expr[0];

								// `test` arg needs to be a string
								if ('string' !== typeof s_test) {
									local.fail('filter with regular expression expects [string] for `test` argument. instead got: ' + (0, _arginfo2['default'])(s_test));
								}

								return 'regex(' + s_test + ',"' + z_val.source.replace(/"/g, '\\"') + '","' + z_val.flags + '")';

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
				expression: s_expression
			};
		},

		//
		exists: function exists() {
			for (var _len6 = arguments.length, a_groups = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
				a_groups[_key6] = arguments[_key6];
			}

			//
			return function () {
				return this.serialize_filter('exists', a_groups);
			};
		},

		// semantic chaining for operations preceeded by 'not'
		not: {

			// 'not exists'
			exists: function exists() {
				for (var _len7 = arguments.length, a_groups = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
					a_groups[_key7] = arguments[_key7];
				}

				//
				return function () {
					return this.serialize_filter('not exists', a_groups);
				};
			}
		},

		//
		sub: function sub(h_sub) {

			//
			local.warn('the `sub` function is not yet fully supported');

			//
			return function () {
				return {
					type: 'query',
					queryType: 'SELECT',
					variables: h_sub.select,
					where: this.serialize_pattern('where', h_sub.where)
				};
			};
		},

		// helper functions

		// tests if entity is an iri
		isIri: function isIri(z_entity) {
			return 'string' === typeof z_entity && '?' !== z_entity[0] && '_:' !== z_entity.substr(0, 2);
		},

		// execution methods
		submit: function submit(s_sparql, s_type, f_okay) {

			// no sparql engine!
			if (!k_engine) return local.fail('cannot execute query; no SPARQL engine was specified!');

			// execute query!
			k_engine(s_sparql, s_type)
			// engine responded
			.then(function (h_json) {

				// forward json to callback
				f_okay(h_json);
			})
			// error
			['catch']();
		}
	});

	// alias prefix
	_operator.prefixes = _operator.prefix;

	//
	return _operator;
};

/**
* public static operator() ():
**/
var local = function local() {

	return __construct.apply(this, arguments);
};

/**
* public static:
**/
{

	//
	local['toString'] = function () {
		return __class_name + '()';
	};

	// prefix output messages to console with class's tag
	require('./log-tag.js').extend(local, __class_name);
}

exports['default'] = local;
module.exports = exports['default'];