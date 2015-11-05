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

				// append the array
				h_node[p_predicate].push(objectify(h_triple.object));
			}
			// nothing exists there yet
			else {

				// construct object and point node to a new list of it
				h_node[p_predicate] = [objectify(h_triple.object)];
			}
		});

		// define an iterator to traverse the node
		h_node[Symbol.iterator] = function*() {
			for(let s_predicate in h_node) {
				yield [s_subject, s_predicate, h_node[s_predicate]];
			}
		};

		// return handy node
		return h_node;
	};

	// as_top_nodes now only has top-level nodes; build struct
	as_top_nodes.forEach((s_subject) => {

		// assign node to its place in struct
		h_struct[s_subject] = new_node(s_subject);
	});

	// define an iterator to traverse struct
	h_struct[Symbol.iterator] = function*() {

		// each subject in struct
		for(let s_subject in h_struct) {

			local.warn('subject: '+s_subject);

			// ref node of all triples having this subject
			let h_node = h_struct[s_subject];

			// each predicate in node
			for(let s_predicate in h_node) {

				local.warn('predicate: '+s_predicate);

				// ref list of objects this predicate points to
				let a_objects = h_node[s_predicate];

				// each object in list
				for(let z_object of a_objects) {

					local.warn('object: '+z_object);

					// yield subject, predicate, object
					yield [s_subject, s_predicate, z_object];
				}
			}
		}
	};


	// ------------------------------


	//
	const depth_first = function*(h_object) {

		// each triple in this node
		for(let {subject: s_subject, predicate: s_predicate, object: s_object} of h_object) {

			// triple points to a blanknode
			if(s_object.startsWith('_:')) {

				// yield depth first triples down that path
				yield *depth_first(h_graph[s_object]);
			}

			// then yield this container triple
			yield [s_subject, s_predicate, s_object];
		}
	};

	return {

		// defines a simpler iterator
		depthFirst: function*() {

			// each top level node
			for(let s_node_id of as_top_nodes) {

				// yield depth first triples
				yield *depth_first(h_graph[s_node_id]);
			}
		}
	};

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
