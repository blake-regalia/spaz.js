// native imports
import util from 'util';

// libraries
import rmprop from 'rmprop';
import array_unique from 'array-unique';

// local modules
import overloader from './overloader';

// debugging helpers
import arginfo from 'arginfo';

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
		switch(h_pattern.type) {

			// basic graph pattern
			case 'bgp':

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
				break;

			// subquery
			case 'query':

				//
				break;
		}
	});

	// ------------------------------

	//
	const groups = function*(h_group, a_types, s_graph='') {
		let s_latent_graph = '';

		switch(h_group.type) {
			case 'graph':
				s_latent_graph = h_group.graph;
			case 'group':
			case 'union':
			case 'exists':
			case 'notexists':
				for(let i_group in h_group.patterns) {
					yield *groups(h_group.patterns[i_group], a_types, s_latent_graph);
				}

			case 'bgp':
			case 'query':
			case 'values':
				if(!a_types || a_types.includes(h_group.type)) {
					yield [s_graph, h_group];
				}
				break;

			default:
				local.fail('group not yet caught: '+h_group.type);
				break;
		}
	};

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
	const bgp_closure = function(h_bgp, as_targets) {

		//
		let as_triples = new Set();

		//
		h_bgp.triples.forEach((h_triple) => {

			//
			if(as_targets.has(h_triple.subject)) {
				as_triples.add(h_triple);
			}

			if(as_targets.has(h_triple.predicate)) {
				as_triples.add(h_triple);
			}

			if(as_targets.has(h_triple.object)) {
				as_triples.add(h_triple);
			}
		});

		//
		return {
			type: 'bgp',
			triples: Array.from(as_triples),
		};
	};


	//
	const node_tree = function(s_node_id, h_forest) {

		// find this tree
		let h_tree = h_forest[s_node_id];

		// no tree!
		if(!h_tree) return s_node_id;

		// each branch in tree
		for(let s_predicate in h_tree) {

			// transform each leaf by pointing it to another tree
			h_tree[s_predicate] = h_tree[s_predicate].map((s_object) => {

				// only recurse on blanknodes; TODO: what about variables? 
				if(s_object.startsWith('_:')) {
					return node_tree(s_object, h_forest);
				}
				else {
					return s_object;
				}
			});
		}

		// return tree;
		return h_tree;
	};


	// 
	let operator = {

		// groups in a depth-first manner
		groups: function*(a_types) {

			// each top-level group
			for(let i_group in a_where) {
				let h_group = a_where[i_group];

				//
				yield *groups(h_group, a_types);
			}
		},

		// subqueries
		subqueries: function*() {

			// yield groups of subquery type
			yield *operator.groups(['query']);
		},

		// depth-first iteration
		depth_first: function*() {

			// each top level node
			for(let s_node_id of as_top_nodes) {

				// yield depth first triples
				yield *depth_first(h_graph[s_node_id]);
			}
		},

		// // depth-last iteration
		// depth_last: function*() {

		// 	// each top level node
		// 	for(let s_node_id of as_top_nodes) {

		// 		// yield depth first triples
		// 		yield *depth_last(h_graph[s_node_id]);
		// 	}
		// },

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

		// obtains all triples that constrain any of the subject, predicate or object in the given triple
		constrained_by: function(h_triple) {

			// create list of targets to constrain from triple
			let as_targets = new Set([h_triple.subject, h_triple.predicate, h_triple.object]);

			// prep to store all patterns necessary for constraint
			let a_patterns = [];

			// each group in where block
			for(let [s_graph, h_group] of operator.groups()) {

				// graphs not yet supported
				if(s_graph) {
					local.fail('cannot constrain groups within GRAPH blocks');
				}

				// what is the group type?
				switch(h_group.type) {

					// basic graph pattern
					case 'bgp':

						// do bgp closure keeping only triples that constrain targets
						a_patterns.push(
							bgp_closure(h_group, as_targets)
						);
						break;

					// values block
					case 'values':

						// ref variables
						let a_vars = Object.keys(h_group.values[0]);

						debugger;

						// at least one of the variables is in targets
						if(a_vars.some((s_variable) => as_targets.has(s_variable))) {

							// keep entire values block
							a_patterns.push(h_group);

							// constrain all other variables
							if(a_vars.length > 1) {
								local.fail('cannot constrain multiple variable in VALUES block');
							}
						}
						break;

					// something else
					default:
						local.fail('cannot constrain '+h_group.type.toUpperCase()+' block');
						break;
				}

				debugger;
			}

			//
			return a_patterns;
		},

		// filter only triples that are closed by the given thing
		closure: function(s_thing) {

			// 
			return closure(s_thing, {
				visits: new Set(),
				triples: [],
			});
		},

		// create a tree to describe all properties of a subject
		tree: function(s_node_id) {

			// get statement forest
			let h_forest = operator.bgp_forest();

			// build node tree
			return node_tree(s_node_id, h_forest);
		},

		// create a tree of all statements in a bgp
		bgp_forest: function() {

			// prep hash for each node by id
			let h_forest = {};

			// 
			for(let s_subject in h_graph) {

				// ref triples list
				let a_triples = h_graph[s_subject];

				// each triple
				a_triples.forEach((h_triple) => {

					// ref node root
					let h_root = h_forest[s_subject];

					// node root does not yet exist
					if(!h_root) {

						// create node root
						h_root = h_forest[s_subject] = {};
					}

					// ref predicate
					let s_predicate = h_triple.predicate;

					// ref node branch
					let h_branch = h_root[s_predicate];

					// node branch does not yet exit
					if(!h_branch) {

						// create node branch
						h_branch = h_root[s_predicate] = [];
					}

					// push node leaf to node branch
					h_branch.push(h_triple.object);
				});
			}

			// return forest
			return h_forest;
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
}

export default local;
