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
const __class_name = 'QueryPatterns';

//
const restruct = () => {

};


/**
* @class QueryPatterns
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

			// each triple in basic graph pattern
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
		depth_first: function*() {

			// each top level node
			for(let s_node_id of as_top_nodes) {

				// yield depth first triples
				yield *depth_first(h_graph[s_node_id]);
			}
		}
	};
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
