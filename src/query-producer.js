'use strict';

// native imports
let util = require('util');

// third-party includes
let arginfo = require('arginfo');


/**
* private static:
**/

// meta class setup
const __class = 'QueryProducer';
let __namespace, __exportee, __export_symbol;

// node.js
if(typeof module !== 'undefined' && module.exports) {
	__namespace = global;
	__exportee = module;
	__export_symbol = 'exports';
}


// class constants


/**
* @class QueryProducer
* using closure for private methods and fields
**/
const __construct = function(h_init_productions, a_init_steps) {

	/**
	* private:
	**/

	// steps & productions
	let a_steps = [];
	let h_productions = new Map();

	// initialize from constructor input
	(() => {

		// transfer productions from initial hash to internal map
		for(let s_step in h_init_productions) {
			h_productions.set(s_step, h_init_productions[s_step]);
		}

		// copy steps from initial array to internal array 
		a_init_steps.forEach((s_step) => {
			a_steps.push(s_step);
		});
	})();


	//
	const insert_productions = (s_step, n_offset, h_insert_productions, a_insert_step_order) => {

		// find the step to insert relative to
		let i_step_relate = a_steps.indexOf(s_step);

		// step does not exist
		if(-1 === i_step_relate) {
			debug.fail('no such step "'+s_step+'"');
		}

		// insert each production to map
		for(let s_step in h_insert_productions) {

			// ref production from hash
			let f_production = h_insert_productions[s_step];

			// production map already has same named step
			if(h_productions.has(s_step)) {
				debug.fail('production with same name already exists for "'+s_step+'"');
			}
			// given production is not a function
			else if('function' !== typeof f_production) {
				debug.fail('production must be a [function]. for key "'+s_step+'", got: '+arginfo(f_production));
			}
			// insert mapping normally
			else {
				h_productions.set(s_step, f_production);
			}
		}

		// no step order given
		if(!a_insert_step_order) {

			// create from order of keys in hash
			a_insert_step_order = Object.keys(h_insert_productions);
		}

		// insert new steps into appropriate place
		a_steps.splice.apply(a_steps, [i_step_relate+n_offset, 0].concat(a_insert_step_order));
	};


	//
	const produce_query = (h_options, h_forward) => {

		// prepare links of strings
		let a_chunks = [];

		//
		let s_newline = '';
		let s_indent_space = '';

		//
		let b_pretty = false;

		//
		if(h_options) {

			// pretty option
			if(h_options.pretty) {
				b_pretty = true;
				s_newline = '\n';
				s_indent_space = '  ';
			}
		}

		//
		let s_indent = '';

		// apply this context to each production callback
		let k_context = Object.create({
			pretty: b_pretty,
			tab_value: 0,


			// adds text chunk to query
			add: function(s_chunk, b_merge_with_previous) {

				// do not insert on new line
				if(b_merge_with_previous && a_chunks.length) {
					a_chunks.push(a_chunks.pop()+' '+s_chunk);
				}
				// new chunk
				else {
					a_chunks.push(s_indent+s_chunk);
				}
			},

			// block open helper
			open: function(s_type, b_same_line) {

				// prepare build open string
				let s_open = '';

				// open block has a type
				if(s_type) {

					// looking pretty means spaces after keywords
					s_open  = s_type+(this.pretty? ' ': '');
				}

				// open block
				this.add(
					s_open+'{',
					b_same_line
				);

				// increase indentation
				this.tabs += 1;
			},

			//
			close: function() {

				// decrease indentation
				this.tabs -= 1;

				// close block
				this.add('}');
			},
		}, {

			// lets user adjust width of indentation using += -=
			tabs: {
				get: function() {
					return this.tab_value;
				},
				set: function(n_value) {
					s_indent = s_indent_space.repeat(n_value);
					this.tab_value = n_value;
				},
			},
		});


		//
		let h_option = {};

		// synchronous each step
		a_steps.forEach((s_step) => {

			// no production!
			if(!h_productions.has(s_step)) {
				debug.fail('production not found: "'+s_step+'"');
			}

			// execute production
			let z_result = h_productions.get(s_step).apply(k_context, [k_context.add, h_option]);

			//
			if('string' === typeof z_produced) {

			}
			// //
			// else {
			// 	debug.fail('return value to production call must be string. instead got '+arginfo(z_produced));
			// }
		});

		//
		return a_chunks.join(s_newline || ' ');
	};


	//
	return new (class {

		//
		after(s_step, h_insert_productions, a_insert_step_order) {

			//
			insert_productions(s_step, 1, h_insert_productions, a_insert_step_order);
		}

		//
		before(s_step, h_insert_productions, a_insert_step_order) {

			//
			insert_productions(s_step, 0, h_insert_productions, a_insert_step_order);
		}

		//
		set(s_step, f_production) {

			// step must exist
			if(!a_steps.includes(s_step)) {
				debug.fail('no such step found: '+s_step);
			}
			// assert production is function
			else if('function' !== typeof f_production) {
				debug.fail('production must be [function]. for key "'+s_step+'", got: '+arginfo(f_production));
			}

			//
			h_productions.set(s_step, f_production);
		}

		//
		produce(h_options) {

			//
			return produce_query(h_options);
		}

	})();
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
