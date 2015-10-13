/**
* class Sparql
**/
(function() {

	/**
	* private static:
	**/
	var __class = 'Sparql';

	var __namespace, __exportee, __name;

	// node
	if(typeof module !== 'undefined' && module.exports) {
		__namespace = global;
		__exportee = module;
		__name = 'exports';
	}

	// browser
	else {
		__namespace = __exportee = window;
		__name = __class;
	}


	var H_SPARQL_CHARS = {
		'[': 1,
		':': 1,
		'(': 1,
		'?': 1,
	};

	var d_global_instance = false;

	// consructs function to get/put/delete entries from hash
	var hash_gpd = function(h_source, f_update) {

		// update or noop
		f_update = f_update || function(){};

		// construct gpd
		return function(z_id, z_value) {

			// solo argument
			if(arguments.length == 1) {

				// get
				if(typeof z_id == 'string') {
					return h_source[z_id];
				}
				// put entries from hash
				else if(typeof z_id == 'object') {
					for(var e in z_id) {
						h_source[e] = z_id[e];
					}
					f_update();
				}
			}
			// delete
			else if(!z_value) {
				delete h_source[z_id];
				f_update();
			}
			// put
			else {
				h_source[s_id] = z_value;
				f_update();
			}
		};
	};


	// converts thing alias to proper identifier if not already specified
	var rdf_thing = function(s_thing) {
		if(H_SPARQL_CHARS[s_thing[0]]) return s_thing;
		else if(s_thing.indexOf(':') != -1) return s_thing;
		else if(s_thing == 'a') return s_thing;
		else return ':'+s_thing;
	};

	// converts variable alias to proper identifier if not already specified
	var rdf_var = function(s_var) {
		if(H_SPARQL_CHARS[s_var[0]]) return s_var;
		else if(s_var.indexOf(':') != -1) return s_var;
		else return '?'+s_var;
	};

	// converts string to proper identifier if not already specified
	var rdf_lit = function(s_str) {
		if(H_SPARQL_CHARS[s_str[0]]) return s_str;
		else if(s_str.indexOf(':') != -1) return s_str;
		else if(/^(?:[0-9]|(?:\-|\.|\-\.)[0-9])/.test(s_str)) return s_str;
		else return JSON.stringify(s_str);
	};

	// converts query hash to sparql string
	var to_sparql = function(sq_prefixes) {
		var s_select = this.select || '*';
		var sq_select = 'SELECT '+s_select+' WHERE {';
		var sq_where = this.where;
		var sq_tail = this.tail;
		var sq_group = this.group? ' GROUP BY '+this.group: '';
		var sq_order = this.order? ' ORDER BY '+this.order: '';
		var sq_limit_offset = this.limit;
		var sq_close = '\n}';
		return ''
			+sq_prefixes
			+sq_select
			+sq_where
			+sq_tail
			+sq_close
			+sq_group
			+sq_order
			+sq_limit_offset;
	};


	var __construct = function() {
		
		/**
		* private:
		**/
		var h_prefixes = [];
		var sq_prefixes = '';

		var s_endpoint_url = '';
		var r_var_substitue = /^\?([\w_\-]+)\s*=\s*(:[\w_\-]+)\s*$/;

		// submits a query 
		var submit_query = function(s_query, f_okay) {
			$.ajax({
				url: s_endpoint_url+'query',
				method: 'GET',
				data: {
					query: s_query,
				},
				dataType: 'json',
				success: function(h_res) {
					f_okay && f_okay(h_res);
				},
			});
		};

		// query-builder
		var qb = function(h_query) {
			var a_vars = null;
			var f_to_sparql = to_sparql.bind(h_query, sq_prefixes);
			var f_exec = function(f_okay) {
				var s_query = f_to_sparql().replace(/[\n\t]+/g, ' ');
				submit_query(s_query, f_okay);
			};
			var with_vars = function(f_callback) {
				if(!a_vars) {
					a_vars = [];
					var r_vars=/(\?[^\?\.\;\s]+)/g, h_vars={}, m_vars;
					while((m_vars=r_vars.exec(h_query.where))!=null) {
						var s_var = m_vars[1];
						if(!h_vars[s_var]) {
							h_vars[s_var] = 1;
							a_vars.push(s_var);
						}
					}
				}
				return f_callback && f_callback.apply({}, [a_vars]);
			};
			var d_self = {
				select: function(z_select, b_reset) {
					if(b_reset) h_query.select = '';
					if(typeof z_select == 'string') {
						h_query.select += z_select+' ';
					}
					else if(typeof z_select == 'function') {
						h_query.select += with_vars(z_select)+' ';
					}
					return d_self;
				},
				exclude: function(s_vars) {
					var a_vars = s_vars.split(/\s+/g);
					if(!h_query.select) {
						var f_exp = exports.all_variables_except(a_vars);
						h_query.select = with_vars(exports.all_variables_except(a_vars));
					}
					else {
						var r_var = /^\\??(.*)$/;
						for(var i=0; i<a_vars.length; i++) {
							var s_var = r_var.exec(a_vars[i])[1];
							var r_replace = new RegExp('\\s*\\?'+s_var+'\\b');
							h_query.select = h_query.select.replace(r_replace,'');
							h_query.group = h_query.group.replace(r_replace,'');
						}
					}
					return d_self;
				},
				concat: function(s_what, s_as, s_join) {
					s_join = s_join || ',';
					h_query.select += '(group_concat('+s_what+';separator="'+s_join+'") as '+s_as+') ';
					h_query.treated_vars.lists[s_as.substr(1)] = s_join;
					return d_self;
				},
				limit: function(s_limit) {
					h_query.limit += ' LIMIT '+s_limit;
					return d_self;
				},
				offset: function(s_offset) {
					h_query.limit += ' OFFSET '+s_offset;
					return d_self;
				},
				order: function(s_order) {
					h_query.order += s_order;
					return d_self;
				},
				filter: function(s_filter) {
					var m_var_substitue;
					if((m_var_substitue=r_var_substitue.exec(s_filter)) !== null) {
						var r_var = new RegExp('\\?'+m_var_substitue[1]+'\\b', 'g');
						h_query.where = h_query.where.replace(r_var, m_var_substitue[2]);
						h_query.treated_vars.subs[m_var_substitue[1]] = m_var_substitue[2];
					}
					else {
						h_query.tail += '\nFILTER ('+s_filter+') .';
					}
					return d_self;
				},
				join_lists: function(h_items, s_delim) {
					var a_exclude = [];
					for(var e in h_items) {
						var s_a = rdf_var(e);
						var s_b = rdf_var(h_items[e]);
						a_exclude.push(s_a);
						d_self.concat(s_a, s_b, s_delim);
					}
					var s_vars = with_vars(exports.all_variables_except(a_exclude));
					h_query.select += s_vars;
					h_query.group += s_vars;
					return d_self;
				},
				toString: f_to_sparql,
				clone: function() {
					return qb({
						treated_vars: h_query.treated_vars,
						select: h_query.select,
						where: h_query.where,
						tail: h_query.tail,
						group: h_query.group,
						order: h_query.order,
						limit: h_query.limit,
					});
				},
				dump: function(f_dump) {
					f_dump = f_dump || console.log.bind(console);
					f_dump(f_to_sparql());
				},
				exec: f_exec,
				results: function(f_okay) {
					f_exec(function(h_res) {
						f_okay && f_okay(h_res.results.bindings);
					});
				},
				all: function(f_all) {
					f_exec(function(h_res) {
						if(!f_all) return;
						var a_rows = h_res.results.bindings;
						var a_res = [];
						for(var i=0,l=a_rows.length; i<l; i++) {
							var h_row = a_rows[i];
							var h_this = {};
							for(var e in h_row) h_this[e] = h_row[e].value;
							a_res.push(h_this);
						}
						f_all.apply({}, [a_res, h_query.treated_vars]);
					});
				},
				first: function(f_first) {
					f_exec(function(h_res) {
						if(!f_first) return;
						var a_rows = h_res.results.bindings;
						var h_row = a_rows[0];
						var h_this = {};
						for(var e in h_row) h_this[e] = h_row[e].value;
						f_first.apply(h_this, [h_row, h_query.treated_vars]);
					});
				},
				each: function(f_each, f_okay) {
					f_exec(function(h_res) {
						if(!f_each) return;
						var a_rows = h_res.results.bindings;
						for(var i=0,l=a_rows.length; i<l; i++) {
							var h_row = a_rows[i];
							var h_this = {};
							for(var e in h_row) h_this[e] = h_row[e].value;
							f_each.apply(h_this, [i, h_row, h_query.treated_vars]);
						}
						f_okay && f_okay();
					});
				},
				export: function() {
					for(var e in h_query) {
						if(typeof h_query[e] == 'string') {
							h_query[e] = h_query[e].replace(/[\n\t]+/g,' ');
						}
					}
					return h_query;
				},
			};
			return d_self;
		};

		var S_OPERATOR_CHARS = '<>';

		var build_from_ph = function(h_predicates, _) {

			//
			var s_out = '';
			var s_tail = '';

			// increment tab
			_ += '\t';

			// track not-first predicate
			var b_nfp = false;

			//
			for(var s_rp in h_predicates) {

				// not-first predicate
				if(b_nfp) s_out += ' ;';
				else b_nfp = true;

				// 
				var z_object = h_predicates[s_rp];
				var s_rpi = rdf_thing(s_rp);

				// string literal
				if(typeof z_object == 'string') {

					// default identifier token
					if(z_object == '?') {
						s_out += _+s_rpi+' ?'+s_rp;
					}

					// lt operator
					else if(S_OPERATOR_CHARS.indexOf(z_object[0]) != -1) {
						switch(z_object[0]) {
							case '<': case '>':
								s_tail += '\n\tFILTER (?'+s_rp+' '+z_object+') .'
								break;
						}
						s_out += _+s_rpi+' ?'+s_rp;
					}

					// custom target
					else {
						s_out += _+s_rpi+' '+rdf_lit(z_object);
					}
				}

				// number literal
				else if(typeof z_object == 'number') {
					s_out += _+s_rpi+' '+z_object;
				}

				// function
				else if(typeof z_object == 'function') {

					// comparison function


					// call function
					var z_cf = z_object.apply({});

					// returned a string
					if(typeof z_cf == 'string') {

					}
				}

				// regex literal
				else if(z_object instanceof RegExp) {

					// prepare string of flags
					var s_flags = ''
						+(z_object.global?'g':'')
						+(z_object.ignoreCase?'i':'')
						+(z_object.multiline?'m':'');

					// build output
					s_out += _+s_rpi+' ?'+s_rp;
					s_tail += '\n\tFILTER regex(?'+s_rp+', '+JSON.stringify(z_object.source)+', "'+s_flags+'") .';
				}

				// objects are in hash (instance objects)
				else if(typeof z_object == 'object') {

					// open instance
					// s_out += _+s_rpi+' [';

					var a_write = build_from_ph(z_object, _);
					s_out += _+s_rpi+' ['+a_write[0]+_+']';
					s_tail += a_write[1];

					// close instance
					// s_out += _+']';
				}
			}

			// decrement tab
			_ = _.substr(0, _.length-1);

			return [s_out, s_tail];
		};


		// constructs sparql query string from hash
		var query_hash = function(h_subjects, b_raw) {

			// initiliaze output
			var s_out = '';

			// add slot for tail
			var s_tail = '';

			// newline + indent
			var _ = '\n\t'+(b_raw? '\t':'');

			// root nodes must be subjects
			for(var s_rs in h_subjects) {

				//
				var z_predicates = h_subjects[s_rs];

				// declaring optional block
				if(s_rs == '?') {

					// these are subjects actually
					var h_write = query_hash(z_predicates, true);
					s_out += _+'OPTIONAL {'+h_write.where+_+'}';
					s_tail += h_write.tail;
				}

				// regular query hash
				else {

					var s_rsi = rdf_var(s_rs);

					// this is subject
					s_out += _+s_rsi;

					// predicates are in hash
					if(typeof z_predicates == 'object') {

						// recurse
						var a_write = build_from_ph(z_predicates, _);
						s_out += a_write[0]+' .';
						s_tail += a_write[1];
					}
				}
			}

			var h_raw = {
				treated_vars: {subs:{},lists:{}},
				select: '',
				where: s_out,
				tail: s_tail,
				group: '',
				order: '',
				limit: '',
			};

			return (b_raw? h_raw: qb(h_raw));
		};


		// executes raw sparql query from string
		var query_string = function(s_query) {

			// execute function
			var f_exec = function(f_okay) {
				submit_query(s_query, f_okay);
			};

			var d_self = {
				exec: f_exec,
				results: function(f_okay) {
					f_exec(function(h_res) {
						f_okay && f_okay(h_res.results.bindings);
					});
				},
				each: function(f_each, f_okay) {
					f_exec(function(h_res) {
						if(!f_each) return;
						var a_rows = h_res.results.bindings;
						for(var i=0,l=a_rows.length; i<l; i++) {
							var h_row = a_rows[i];
							var h_this = {};
							for(var e in h_row) h_this[e] = h_row[e].value;
							f_each.apply(h_this, [i, h_row]);
						}
						f_okay && f_okay();
					});
				},
			};

			return d_self;
		};

		
		/**
		* public operator() ();
		**/
		var operator = function(z_query) {
			
			// hash query
			if(typeof z_query == 'object') {
				return query_hash(z_query);
			}
			// string
			else if(typeof z_query == 'string') {

				if(z_query[0] == ':' || z_query[0] == '?') {
					return qb({
						select: '',
						where: '\n'+z_query,
						tail: '',
						group: '',
						order: '',
						limit: '',
					});
				}

				return query_string(z_query);
			}
		};
		
		
		/**
		* public:
		**/

			// remote controlled prefixes
			operator['prefix'] = hash_gpd(h_prefixes, function() {
				sq_prefixes = '';
				for(var e in h_prefixes) {
					sq_prefixes += 'PREFIX '+e+' '+h_prefixes[e]+'\n';
				}
			});

			// define endpoint url
			operator['endpoint'] = function(s_url) {
				if(!arguments.length) return s_endpoint_url;
				else s_endpoint_url = s_url;
			};

			// load a compiled object
			operator['load'] = function(h_query) {
				return qb(h_query);
			};

			operator[''] = function() {
				
			};
		
		
		return operator;	
	};


	/**
	* public static operator() ()
	**/
	var exports = __exportee[__name] = function() {
		if(this !== __namespace) {
			var instance = __construct.apply(this, arguments);
			return instance;
		}
		else {
			if(arguments.length) {
				return d_global_instance.apply(this, arguments);
			}
			return d_global_instance;
		}
	};

	
	/**
	* public static:
	**/
	{
		//
		exports['toString'] = function() {
			return __class+'()';
		};
	}
		
	// wrap public static declarations in an iiaf
	(function() {

		// output a message to the console prefixed with this class's tag
		var debug = function(channel) {
			return function() {
				var args = Array.prototype.slice.call(arguments);
				args.unshift(__class+':');
				console[channel].apply(console, args);
			};
		};
		
		// open the various output channels
		exports['log'] = debug('log');
		exports['info'] = debug('info');
		exports['warn'] = debug('warn');
		exports['error'] = debug('error');
	})();
		

	// wrap global instance calls in iiaf
	(function() {
		var global_instance = function(s_method) {
			return function() {
				return d_global_instance && d_global_instance[s_method].apply(this, arguments);
			};
		};

		// various global transcends
		exports['prefix'] = global_instance('prefix');
		exports['endpoint'] = global_instance('endpoint');
		exports['load'] = global_instance('load');
	})();


		// static reference pointer for query building
		exports['all_variables_except'] = function(a_exclude) {
			return function(a_vars) {
				if(!a_exclude || !a_exclude.length) return a_vars.join(' ');
				var a_out = [];
				for(var i=0; i<a_vars.length; i++) {
					var s_var = a_vars[i];
					if(a_exclude.indexOf(s_var) == -1) a_out.push(s_var);
				}
				return a_out.join(' ');
			};
		};


		// configure
		exports['config'] = function(h_config) {

			// mode setting
			if(h_config.hasOwnProperty('mode')) {

				// global mode
				if(h_config.mode == 'global') {

					// create global instance
					d_global_instance = new exports();

					// export alias to namespace
					var d_static = exports.bind(__namespace);

					// an alias was given
					if(h_config.alias) {
						__namespace[h_config.alias] = d_static;
					}

					// along with exportsd methods
					for(var e in exports) {
						d_static[e] = exports[e];
					}
				}
			}
		};


})();