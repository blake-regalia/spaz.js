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
	const depth_first = function*(h_container) {

		// each triple in this node
		for(let h_triple of h_container) {

			// destructure triple
			let {subject: s_subject, predicate: s_predicate, object: s_object} = h_triple;

			// triple points to a blanknode
			if(s_object.startsWith('_:')) {

				// yield depth first triples down that path
				yield *depth_first(h_graph[s_object]);
			}

			// then yield this container triple
			yield [h_triple, s_subject, s_predicate, s_object];
		}
	};

	//
	const closure = function(s_target, h_context) {

		// ref visits
		let as_visits = h_context.visits;

		// traverse in a depth-first manner
		for(let [h_triple, s_subject, s_object, s_predicate] of operator.depth_first()) {

			// triple has been visited already
			if(as_visits.has(h_triple)) continue;

			//
			local.warn('testing for <'+s_target+'> in: '+arginfo(h_triple));

			// otherwise; mark this triple as visited
			as_visits.add(h_triple);

			// prep to remember this triple had a match
			let b_matched = false;

			// subject matches target
			if(s_subject === s_target) {
				b_matched = true;

				// close predicate
				closure(s_predicate, h_context);

				// close object
				closure(s_subject, h_context);
			}
			// predicate matches target
			else if(s_predicate === s_target) {
				b_matched = true;

				// close subject
				closure(s_subject, h_context);

				// close object
				closure(s_subject, h_context);
			}
			// object matches target
			else if(s_object === s_target) {
				b_matched = true;

				// close subject
				closure(s_subject, h_context);

				// close predicate
				closure(s_predicate, h_context);
			}

			// push triple to list
			if(b_matched) {
				local.good('+match');
				h_context.triples.push(h_triple);
			}
		}

		local.info('final triples of closure, '+arginfo(h_context.triples));

		// return triples list
		return h_context.triples;
	};


	// 
	let operator = {

		// depth-first iteration
		depth_first: function*() {

			// each top level node
			for(let s_node_id of as_top_nodes) {

				// yield depth first triples
				yield *depth_first(h_graph[s_node_id]);
			}
		},

		// top-level iteration
		top_level: function*() {

			// each top level node
			for(let s_node_id of as_top_nodes) {

				// each triple pointed to by this subject
				for(let h_triple of h_graph[s_node_id]) {

					// destructure triple
					let {subject: s_subject, predicate: s_predicate, object: s_object} = h_triple;

					// yield top-level triples
					yield [h_triple, s_subject, s_predicate, s_object];
				}
			}
		},

		// filter only triples that are closed by the given thing
		closure: function(s_thing) {

			// 
			return closure(s_thing, {
				visits: new Set(),
				triples: [],
			});
		},
	};

	//
	return operator;
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
