

// libraries
import arginfo from 'arginfo';
import classer from 'classer';
import rapunzel from 'rapunzel';


/**
* private static:
**/

const S_SEPARATE_PAIR = ' ;';
const S_SEPARATE_LIST = ',';
const S_TERMINATE_STATEMENT = ' .';

const P_XSD_IRI = 'http://www.w3.org/2001/XMLSchema#';


//
const destruct_blanknode_hash = (add, h_object) => {

	// open blanknode on same line
	add.open(' [', '', true);

	// each pair
	Object.keys(h_object).forEach((s_predicate, i_predicate, a_keys) => {
		// destruct object in any format, forward preceeding n3
		destruct_object_any(add, s_predicate, h_object[s_predicate]);

		// not last item
		if(i_predicate !== a_keys.length-1) {
			add(S_SEPARATE_PAIR, true);
		}
	});

	// close blanknode
	add.close(']');
};


//
const destruct_object_list = (add, a_list) => {

	// each item in object list
	a_list.forEach((z_item, i_item) => {
		// commit destruct of object
		destruct_object_any(add, '', z_item, true);

		// not last item
		if(i_item !== a_list.length-1) {
			// insert separator
			add(S_SEPARATE_LIST, true);
		}
	});
};


//
const destruct_object_any = (add, s_n3, z_object, b_same_line=false) => {

	// raw string (object)
	if('string' === typeof z_object) {
		// commit as is
		return add(s_n3+' '+z_object, b_same_line);
	}
	// array (object-list)
	else if(Array.isArray(z_object)) {
		// commit preceeding n3
		add(s_n3, b_same_line);

		// map to destruct and finalize
		return destruct_object_list(add, z_object);
	}
	// hash (blanknode-object)
	else if(Object === z_object.constructor) {
		// commmit preceeding n3
		add(s_n3, b_same_line);

		// destruct blanknode-hash
		destruct_blanknode_hash(add, z_object);
	}
	// other (object value)
	else {
		// commit as datatype-less value
		return add(s_n3+' '+add.$$.val(z_object));
	}
	// // 3rd element is invalid
	// else {
	// 	throw 'third element of fragments array must be [string], [array] or [hash] since it represents the object of a triple; instead got '+arginfo(z_third);
	// }
};


//
const destruct_triple_array = (add, a_fragments) => {

	// not enough elements, skip entitiy
	if(a_fragments.length <= 1) return false;

	// ref 1st element
	let z_first= a_fragments[0];

	// 1st element is raw string (subject)
	if('string' === typeof z_first) {
		let s_n3 = z_first;

		// ref 2nd element
		let z_second = a_fragments[1];

		// 2nd element is raw string (predicate)
		if('string' === typeof z_second) {
			// destruct object in any format, forward preceeding n3
			destruct_object_any(add, s_n3, a_fragments[2]);
		}
		// 2nd element is hash (predicate-object pairs)
		else if(Object === z_second.constructor) {
			// ref pairs
			let a_pairs = Object.keys(z_second);

			// empty hash; skip entity
			if(!a_pairs.length) return false;

			// commit preceeding n3
			add(s_n3);

			// open dictionary-style indent
			add.open('', '', true);

			// each pair
			a_pairs.forEach((s_predicate, i_predicate, a_keys) => {
				// destruct object in any format, forward preceeding n3
				destruct_object_any(add, s_predicate, z_second[s_predicate]);

				// not last item
				if(i_predicate !== a_keys.length-1) {
					add(S_SEPARATE_PAIR, true);
				}
			});

			// close indent
			add.close('');
		}
		// invalid 2nd element
		else {
			throw 'second element of fragments array must be [string] or [object] since it represents the predicate or predicate-object pairs of triple(s); instead got: '+arginfo(z_second);
		}
	}
	// invalid subject
	else {
		throw 'first element of fragments array must be [string] since it represents the subject of a triple; instead got: '+arginfo(z_first);
	}
	return true;
};


/**
* class:
**/
const local = classer('N3_Document', function(h_config) {

	/**
	* private:
	**/

	//
	let s_disclaimer = 'This document was generated programatically';
	let a_body = [];
	let hm_prefixes = h_config.prefixes || {};

	// help buildling ttl string
	let k_producer = rapunzel({

		// put disclaimer comment at beginning of document
		disclaimer(add) {

			// disclaimer is active
			if(s_disclaimer) {
				add('####\n# ${s_disclaimer}\n####', false, true);
			}
		},

		// prefixes
		prefixes(add) {

			// each prefix
			for(let [s_prefix, p_uri] of hm_prefixes) {
				add(`@prefix ${s_prefix}: <${p_uri}>`);
			}

			// newline
			add.blank();
		},

		// produce body of document
		body(add) {

			// forward spaz object with add function
			add.$$ = h_config.parent;

			// each piece
			a_body.forEach((z_piece) => {
				// assume something gets added to document
				let b_added = true;

				// piece type is raw string
				if('string' === typeof z_piece) {
					add(z_piece, false, /[.,;]\s*$/.test(z_piece));
				}
				// piece type is array
				else if(Array.isArray(z_piece)) {
					b_added = destruct_triple_array(add, z_piece);
				}
				// piece type is hash
				else if('object' === typeof z_piece) {
					// prescribed pattern
					if(z_piece.hasOwnProperty('type')) {

					}
					// blanknode-hash
					else {
						destruct_blanknode_hash(add, z_piece);
					}
				}
				// piece type is other
				else {
					throw 'invalid n3 piece type. expecting [string], [array] or [object]; instead got: '+arginfo(z_piece);
				}

				// something was indeed added to document
				if(b_added) {
					// make newline
					add.blank();
				}
			});
		},
	}, ['disclaimer', 'prefixes', 'body']);


	/**
	* public:
	**/
	return classer.operator(function() {

		// operator() call
	}, {

		// prefixes
		prefixes(_hm_prefixes) {
			// overwrite prefixes
			hm_prefixes = _hm_prefixes;
		},

		// add statements
		add(...a_args) {
			// simply push to body
			a_body.push(...a_args);
		},

		// output document
		output(h_options={}) {
			// disclaimer
			if(h_options.hasOwnProperty('disclaimer')) {
				s_disclaimer = h_options.disclaimer;
			}

			// produce ttl string
			return k_producer.produce({
				close: S_TERMINATE_STATEMENT,
			});
		},
	});
}, {

/**
* public static:
**/
	
});

export default local;
