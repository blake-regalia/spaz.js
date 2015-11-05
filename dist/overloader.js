'use strict';

//
module.exports = function (h_handler) {

	// interface function
	var f_interface = function f_interface() {
		for (var _len = arguments.length, a_args = Array(_len), _key = 0; _key < _len; _key++) {
			a_args[_key] = arguments[_key];
		}

		// ref args length and 0th arg
		var n_args = a_args.length;
		var z_arg0 = a_args[0];

		// single argument is an array (reset)
		if (n_args === 1 && Array.isArray(z_arg0)) {
			h_handler.reset(z_arg0);
		}
		// no arguments OR single argument is a boolean (fetch)
		else if (n_args === 0 || n_args === 1 && 'boolean' === typeof z_arg0) {

				// no soft/hard options
				if ('function' === typeof h_handler.fetch) {
					return h_handler.fetch();
				}
				// fetch soft
				else if (!n_args || false === z_arg0) {
						return h_handler.fetch.soft();
					}
					// fetch hard
					else {
							return h_handler.fetch.hard();
						}
			}
			// add
			else {
					h_handler.add(a_args);
				}

		// chain
		return this;
	};

	// extend method to allow certain access to underlying map
	if (h_handler.map) {

		// ref map
		var h_map = h_handler.map;

		// alias some method(s)
		f_interface.has = h_map.has.bind(h_map);
		f_interface.get = h_map.get.bind(h_map);
		f_interface.forEach = h_map.forEach.bind(h_map);
	}

	// extend method to allow certain access to underlying set
	else if (h_handler.set) {

			// ref set
			var h_set = h_handler.set;

			// alias getter method(s)
			f_interface.has = h_set.has;
		}

	// provide `clear` method to user
	if (h_handler.reset) {
		f_interface.clear = function () {
			return h_handler.reset([]);
		};
	}

	//
	return f_interface;
};