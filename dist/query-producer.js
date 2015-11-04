'use strict';

// native imports

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

// libraries

var _arginfo = require('arginfo');

var _arginfo2 = _interopRequireDefault(_arginfo);

/**
* private static:
**/

// meta class setup
var __class = 'QueryProducer';
var __namespace = undefined,
    __exportee = undefined,
    __export_symbol = undefined;

// node.js
if (typeof module !== 'undefined' && module.exports) {
	__namespace = global;
	__exportee = module;
	__export_symbol = 'exports';
}

// class constants

/**
* @class QueryProducer
* using closure for private methods and fields
**/
var __construct = function __construct(h_init_productions, a_init_steps) {

	/**
 * private:
 **/

	// steps & productions
	var a_steps = [];
	var h_productions = new Map();

	// initialize from constructor input
	(function () {

		// transfer productions from initial hash to internal map
		for (var s_step in h_init_productions) {
			h_productions.set(s_step, h_init_productions[s_step]);
		}

		// copy steps from initial array to internal array
		a_init_steps.forEach(function (s_step) {
			a_steps.push(s_step);
		});
	})();

	//
	var insert_productions = function insert_productions(s_step, n_offset, h_insert_productions, a_insert_step_order) {

		// find the step to insert relative to
		var i_step_relate = a_steps.indexOf(s_step);

		// step does not exist
		if (-1 === i_step_relate) {
			debug.fail('no such step "' + s_step + '"');
		}

		// insert each production to map
		for (var _s_step in h_insert_productions) {

			// ref production from hash
			var f_production = h_insert_productions[_s_step];

			// production map already has same named step
			if (h_productions.has(_s_step)) {
				debug.fail('production with same name already exists for "' + _s_step + '"');
			}
			// given production is not a function
			else if ('function' !== typeof f_production) {
					debug.fail('production must be a [function]. for key "' + _s_step + '", got: ' + (0, _arginfo2['default'])(f_production));
				}
				// insert mapping normally
				else {
						h_productions.set(_s_step, f_production);
					}
		}

		// no step order given
		if (!a_insert_step_order) {

			// create from order of keys in hash
			a_insert_step_order = Object.keys(h_insert_productions);
		}

		// insert new steps into appropriate place
		a_steps.splice.apply(a_steps, [i_step_relate + n_offset, 0].concat(a_insert_step_order));
	};

	//
	var produce_query = function produce_query(h_options, h_forward) {

		// prepare links of strings
		var a_chunks = [];

		//
		var s_newline = '';
		var s_indent_space = '';

		//
		var b_pretty = false;

		//
		if (h_options) {

			// pretty option
			if (h_options.pretty) {
				b_pretty = true;
				s_newline = '\n';
				s_indent_space = '  ';
			}
		}

		//
		var s_indent = '';

		// apply this context to each production callback
		var k_context = Object.create({
			pretty: b_pretty,
			tab_value: 0,

			// adds text chunk to query
			add: function add(s_chunk, b_merge_with_previous) {

				// do not insert on new line
				if (b_merge_with_previous && a_chunks.length) {
					a_chunks.push(a_chunks.pop() + ' ' + s_chunk);
				}
				// new chunk
				else {
						a_chunks.push(s_indent + s_chunk);
					}
			},

			// block open helper
			open: function open(s_type, b_same_line) {

				// prepare build open string
				var s_open = '';

				// open block has a type
				if (s_type) {

					// looking pretty means spaces after keywords
					s_open = s_type + (this.pretty ? ' ' : '');
				}

				// open block
				this.add(s_open + '{', b_same_line);

				// increase indentation
				this.tabs += 1;
			},

			//
			close: function close() {

				// decrease indentation
				this.tabs -= 1;

				// close block
				this.add('}');
			}
		}, {

			// lets user adjust width of indentation using += -=
			tabs: {
				get: function get() {
					return this.tab_value;
				},
				set: function set(n_value) {
					s_indent = s_indent_space.repeat(n_value);
					this.tab_value = n_value;
				}
			}
		});

		//
		var h_option = {};

		// synchronous each step
		a_steps.forEach(function (s_step) {

			// no production!
			if (!h_productions.has(s_step)) {
				debug.fail('production not found: "' + s_step + '"');
			}

			// execute production
			var z_result = h_productions.get(s_step).apply(k_context, [k_context.add, h_option]);

			//
			if ('string' === typeof z_produced) {}
			// //
			// else {
			// 	debug.fail('return value to production call must be string. instead got '+arginfo(z_produced));
			// }
		});

		//
		return a_chunks.join(s_newline || ' ');
	};

	//
	return new ((function () {
		function _class() {
			_classCallCheck(this, _class);
		}

		_createClass(_class, [{
			key: 'after',

			//
			value: function after(s_step, h_insert_productions, a_insert_step_order) {

				//
				insert_productions(s_step, 1, h_insert_productions, a_insert_step_order);
			}

			//
		}, {
			key: 'before',
			value: function before(s_step, h_insert_productions, a_insert_step_order) {

				//
				insert_productions(s_step, 0, h_insert_productions, a_insert_step_order);
			}

			//
		}, {
			key: 'set',
			value: function set(s_step, f_production) {

				// step must exist
				if (!a_steps.includes(s_step)) {
					debug.fail('no such step found: ' + s_step);
				}
				// assert production is function
				else if ('function' !== typeof f_production) {
						debug.fail('production must be [function]. for key "' + s_step + '", got: ' + (0, _arginfo2['default'])(f_production));
					}

				//
				h_productions.set(s_step, f_production);
			}

			//
		}, {
			key: 'produce',
			value: function produce(h_options) {

				//
				return produce_query(h_options);
			}
		}]);

		return _class;
	})())();
};

/**
* public static operator() ():
**/
var debug = __exportee[__export_symbol] = function () {

	// called with `new`
	if (this !== __namespace) {
		return __construct.apply(this, arguments);
	}
	// called directly
	else {
			return debug.fail('not allowed to call ' + debug + ' without `new` operator');
		}
};

/**
* public static:
**/
{

	//
	debug['toString'] = function () {
		return __class + '()';
	};

	// prefix output messages to console with class's tag
	require('./log-tag.js').extend(debug, __class);
}