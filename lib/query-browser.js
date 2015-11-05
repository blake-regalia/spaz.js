// native imports
import util from 'util';

// libraries
import arginfo from 'arginfo';
import rmprop from 'rmprop';

// local modules
import overloader from './overloader';


/**
* private static:
**/

// 
const __class_name = 'QueryBrowser';

//
const restruct = () => {

};


/**
* @class QueryBrowser
* using closure for private methods and fields
**/
const __construct = function(h_init) {

	/**
	* private:
	**/

	let h_prefixes = h_init.prefixes;
	let a_where = h_init.where;

	//
	let h_struct = rmprop({});
	let h_graph = {};
	let as_top_nodes = new Set();

	// each triple
	a_where.forEach((h_pattern) => {

		//
		if('bgp' === h_pattern.type) {

			h_pattern.triples.forEach((h_triple) => {

				// ref subject
				let s_subject = h_triple.subject;

				// first triple using this subject
				if(!h_graph[s_subject]) {

					// create list to store triples sharing this subject
					h_graph[s_subject] = [];
				}

				// group triple into buckets by same subject
				h_graph[s_subject].push(h_triple);

				// only add non-blanknodes to top-level
				if(!s_subject.startsWith('_:')) {
					as_top_nodes.add(s_subject);
				}
			});
		}
	});


	// // graph now has all triples grouped by their subject
	// for(let s_subject in h_graph) {

	// 	// get list of triples sharing this subject
	// 	let a_triples = h_graph[s_subject];

	// 	// each triple in group
	// 	a_triples.forEach((h_triple) => {

	// 		// triple points to a blanknode
	// 		if(h_triple.object.startsWith('_:')) {

	// 			// remove that blanknode from top level
	// 			as_top_nodes.delete(h_triple.object);
	// 		}
	// 	});
	// }

	//
	const objectify = (s_thing) => {

		// blanknode
		if(s_thing.startsWith('_:')) {
			return new_node(s_thing);
		}
		// variable or named thing
		else {
			return s_thing;
		}
	};

	//
	const new_node = (s_subject) => {

		// prepare a node to connect this subject to all it's triples
		let h_node = rmprop({});

		// fetch triples from graph
		let a_triples = h_graph[s_subject];

		// each triple
		a_triples.forEach((h_triple) => {

			// ref predicate uri
			let p_predicate = h_triple.predicate;

			// object already exists there
			if(h_node[p_predicate]) {

				// ref that object
				let z_object = h_node[p_predicate];

				// it is already an array
				if(Array.isArray(z_object)) {
					z_object.push(objectify(h_triple.object));
				}
				// create an array out of the node that's there
				else {
					h_node[p_predicate] = [z_object, objectify(h_triple.object)];
				}
			}
			// nothing exists there yet
			else {

				// construct object and point node to it
				h_node[p_predicate] = objectify(h_triple.object);
			}
		});

		// return handy node
		return h_node;
	};

	// as_top_nodes now only has top-level nodes; build struct
	as_top_nodes.forEach((s_subject) => {

		// assign node to its place in struct
		h_struct[s_subject] = new_node(s_subject);
	});

	//
	return h_struct;
};


/**
* public static operator() ():
**/
const local = function() {

	return __construct.apply(this, arguments);

	// // called with `new`
	// if(new.target) {
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
	local.toString = function() {
		return __class_name+'()';
	};

	// prefix output messages to console with class's tag
	require('./log-tag.js').extend(local, __class_name);
}

export default local;
