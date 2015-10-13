'use strict';

const spaz = require('../');
const should = require('should');

let $$ = new spaz();

let q = $$.build('select');


describe('.from()', () => {

	it('supports choosing multiple default graphs', () => {
		q.from('a','b','c')
			.from().should.deepEqual(['a','b','c']);
	});

	it('clears graphs w/ empty array', () => {
		let h_graphs = q.from([]).from(true);
		h_graphs.default.should.be.empty();
		h_graphs.named.should.be.empty();
	});

	it('does not allow duplicate default/named graphs', () => {
		q.from([])
			.from('a','b',{
				default: ['b','c'],
				named: ['a','d','e']
			})
			.from(true).should.deepEqual({
				default: ['a','b','c'],
				named: ['a','d','e'],
			});
	});

	it('supports mono-string args in long form', () => {
		q.from([])
			.from('a','b',{
				default: 'c',
				named: 'a'
			})
			.from(true).should.deepEqual({
				default: ['a','b','c'],
				named: ['a'],
			});
	});

	it('overwrites both graphs w/ array', () => {
		q.from(['x'])
			.from(true).should.deepEqual({
				default: ['x'],
				named: [],
			});
	});

	it('overwrites default graphs only w/ empty array in value', () => {
		q.from([])
			.from({
				default: 'a',
				named: 'b',
			})
			.from({
				default: [],
			})
			.from(true).should.deepEqual({
				default: [],
				named: ['b'],
			});
	});

	it('overwrites named graphs only w/ empty array in value', () => {
		q.from([])
			.from({
				default: 'a',
				named: 'b',
			})
			.from({
				named: [],
			})
			.from(true).should.deepEqual({
				default: ['a'],
				named: [],
			});
	});
});


describe('.select()', () => {

	it('supports selecting multiple variables of mix/match prefixes', () => {
		q.select('a','?b','$c')
			.select().should.deepEqual(['?a', '?b', '?c']);
	});

	it('does not allow duplicate variables in list', () => {
		q.select('a','a','b','?b','$c','?c','c','$a')
			.select().should.deepEqual(['?a', '?b', '?c']);
	});

	it('resets variable list w/ * operator', () => {
		q.select('a','b','c')
			.select('*')
			.select().should.be.empty();
	});
	
	it('clears variables list w/ empty array', () => {
		q.select('a','b','c')
			.select([])
			.select().should.be.empty();
	});

	it('overwrites variables list w/ array', () => {
		q.select('a','b','c')
			.select(['d','e','f'])
			.select().should.deepEqual(['?d', '?e', '?f']);
	});

	it('allows expression mapping', () => {
		q.select([])
			.select({
				price: '?p * (1 - ?discount)',
				'?key': '?value',
			}, '?original as ?alias')
			.select(true).should.deepEqual({
				'?price': '?p * (1 - ?discount)',
				'?key': '?value',
				'?alias': '?original',
			})
	});
});



describe('.group/having/order()', () => {

	it('allows multiple arguments', () => {
		q.group('a','b','c')
			.group().should.deepEqual(['a', 'b', 'c']);
	});

	it('clears conditions list w/ empty array', () => {
		q.group([])
			.group().should.be.empty();
	});

	it('overwrites conditions list w/ array', () => {
		q.group('a','b','c')
			.group(['d','e']).group('f')
			.group().should.deepEqual(['d', 'e', 'f']);
	});

	it('distinguishes between each method', () => {
		q.having('x')
			.having().should.deepEqual(['x']);
	})

});


q = $$.build('ask');

describe('ask query', () => {

	it('generates correct SPARQL string', () => {

		q.where(
			$$(':Thing a :Type')
		).toSparql().should.equal('ask where { :Thing a :Type }')
	});
});