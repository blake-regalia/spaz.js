'use strict';

// native imports
let util = require('util');

// third party libraries
let extend = require('extend');

// local modules
const query_builder = require('./query-builder.js');


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





/**
* @class Spaz
* using closure for private methods and fields
**/
const __construct = function(h_config) {

	/**
	* private:
	**/


	/**
	* public operator() ():
	**/
	const operator = function() {

	};

	/**
	* public:
	**/
	return extend(operator, {

		// expression builder helper functions
		triple: '',


		// query builder
		build(s_type) {
			switch(s_type) {
				case 'ask':
				case 'select':
					return new query_builder({
						type: s_type,
					});
				case 'insert':
				case 'update':
				default:
					return exports.fail('cannot build "'+s_type+'". That alias is not recognized');
			}
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