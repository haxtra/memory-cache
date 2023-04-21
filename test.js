if(typeof describe == 'undefined'){
	console.error('Use Mocha to run this test')
	process.exit(1)
}

const Equal = require('assert').equal
const Cache = require('./index.js')
const debug = obj => console.log(require('node:util').inspect(obj, {depth:null, colors:true, compact:false, numericSeparator:true}))

const cache = new Cache()

// mock time function so we can test time sensitive funcs
const testTime = 1893456000
cache._timeNow = () => testTime

// mock cache state
const state = {
	key1: {
		payload: 'v1',
		expires: false,				// never expires
		created: testTime - 3600,	// created an hour ago
		tags: false,
	},
	key2: {
		payload: 'v2',
		expires: testTime + 3600, 	// expires in one hour
		created: testTime - 3600,	// created an hour ago
		tags: ['foo', 'bar'],
	},
	key3: {
		payload: 'v3',
		expires: testTime - 3600, 	// expired an hour ago
		created: testTime - 7200,	// created two hours ago
		tags: ['bar'],
	},
	key4: {
		payload: 'v4',
		expires: testTime + 3600, 	// expires in one hour
		created: testTime - 3600,	// created an hour ago
		tags: ['foo', 'bar'],
	},

	// expired
	key5: {
		payload: 'v5',
		expires: testTime - 3600, 	// expired an hour ago
		created: testTime - 7200,	// created two hours ago
		tags: ['moo'],
	},

	// events
	key6: {
		payload: 'v6',
		created: testTime,
		tags: ['on.boom'],
	},

	key7: {
		payload: 'v7',
		created: testTime,
		tags: ['on.boom'],
	},
}

let r;

describe('memory-cache', function(){

	describe('units', function(){

		it('timeNow', function(){
			Equal(cache._timeNow() > 1672531200, true)
		})

		describe('paramArray', function(){

			it('string', function(){
				r = cache._paramArray(' foo   bar  baz')
				Equal(r.length, 3)
				Equal(r[0], 'foo')
				Equal(r[1], 'bar')
				Equal(r[2], 'baz')
			})

			it('string multi', function(){
				r = cache._paramArray('foo bar')
				Equal(Array.isArray(r), true)
				Equal(r[0], 'foo')
				Equal(r[1], 'bar')
			})

			it('array', function(){
				r = cache._paramArray(['foobar'])
				Equal(Array.isArray(r), true)
				Equal(r[0], 'foobar')
			})
		})

		describe('defaultOrNull', function(){

			it('default', function(){
				Equal(cache._defaultOrNull({default:'foo'}), 'foo')
			})

			it('null', function(){
				Equal(cache._defaultOrNull({nada:true}), null)
			})
		})

		describe('tag inclusion', function(){

			it('itemHasAnyTag', function(){
				Equal(cache._itemHasAnyTag({tags:['foo']}, ['foo','bar']), true)
				Equal(cache._itemHasAnyTag({tags:['zzz','xxx']}, ['foo','nox']), false)
			})

			it('itemHasAllTags', function(){
				Equal(cache._itemHasAllTags({tags:['foo','bar']}, ['foo','bar']), true)
				Equal(cache._itemHasAllTags({tags:['foo','bar']}, ['foo','nox']), false)
			})
		})
	})

	describe('library', function(){

		describe('import', function(){
			it('import state', function(){
				cache.import(state)
				Equal(cache.$.key1.payload, 'v1')
			})
		})

		describe('get', function(){

			it('invalid', function(){
				Equal(cache.get('noSuchKey'), null)
			})

			it('invalid default', function(){
				Equal(cache.get('noSuchKey', {default:'def'}), 'def')
			})

			it('no expiry', function(){
				Equal(cache.get('key1'), 'v1')
			})

			it('with expiry', function(){
				Equal(cache.get('key2'), 'v2')
			})

			it('expired', function(){
				Equal(cache.get('key3'), null)
			})

			it('expired, forced', function(){
				Equal(cache.get('key3', {force:true}), 'v3')
			})

			it('maxAge meet', function(){
				Equal(cache.get('key1', {maxAge:7200}), 'v1')
			})

			it('maxAge exeeded', function(){
				Equal(cache.get('key1', {maxAge:1800}), null)
			})

			it('maxAge exeeded default', function(){
				Equal(cache.get('key1', {maxAge:1800, default:'def'}), 'def')
			})

			it('meta', function(){
				r = cache.getMeta('key2')
				Equal(r.payload, 'v2')
				Equal(r.created, 1893452400)
			})
		})

		describe('set', function(){

			it('update old', function(){
				Equal(cache.set('key4', 'V4', {tags:'foo'}), true)
			})

			it('create new for expiration', function(){
				Equal(cache.set('key8', 'V8', {expireIn:1000}), true)
			})

			it('create new for tags', function(){
				Equal(cache.set('key9', 'V9', {tags:'moo'}), true)
			})

			it('create new for event', function(){
				Equal(cache.set('key10', 'V10', {tags:'foo bar on.boom'}), true)
			})
		})

		describe('get updated', function(){

			it('old key', function(){
				Equal(cache.get('key4'), 'V4')
				Equal(cache.$['key4'].expires, false)
				Equal(cache.$['key4'].created, testTime)
			})

			it('exp item', function(){
				Equal(cache.get('key8'), 'V8')
				Equal(cache.$['key8'].expires, testTime + 1000)
				Equal(cache.$['key8'].created, testTime)
			})

			it('tag item', function(){
				Equal(cache.get('key9'), 'V9')
				Equal(cache.$['key9'].expires, false)
				Equal(cache.$['key9'].tags[0], 'moo')
			})
		})

		describe('tagging', function(){

			it('get :any', function(){
				Equal(Object.keys(cache.getTagged('foo')).length, 3)
				Equal(Object.keys(cache.getTagged(['bar'])).length, 3)
				Equal(Object.keys(cache.getTagged(' foo   on.boom  ')).length, 5)
				Equal(Object.keys(cache.getTagged(['notag'])).length, 0)
			})

			it('get :all', function(){
				Equal(Object.keys(cache.getTagged('foo bar', {all:true})).length, 2)
				Equal(Object.keys(cache.getTagged(['foo','bar'], {all:true})).length, 2)
			})

			it('with meta', function(){
				r = cache.getTagged('foo bar on.boom', {meta:true, all:true})
				Equal(r.key10.payload, 'V10')
				Equal(r.key10.tags[2], 'on.boom')
				Equal(r.key10.expires, false)
			})
		})

		describe('aux', function(){

			it('count :withExpired', function(){
				Equal(cache.count(), 10)
			})

			it('tags :withExpired', function(){
				r = cache.tags()
				Equal(r.bar, 3)
				Equal(r.foo, 3)
				Equal(r.moo, 2)
				Equal(r['on.boom'], 3)
			})

			it('count :valid', function(){
				Equal(cache.count(true), 8)
			})

			it('tags :valid', function(){
				r = cache.tags(true)
				Equal(r.moo, 1)
			})

			it('keys', function(){
				r = cache.keys()
				Equal(r.length, 8)
				Equal(r[0], 'key1')
				Equal(r[4], 'key7')
			})
		})

		describe('deletion', function(){

			it('delete by key', function(){
				Equal(cache.delete('key4'), true)
				Equal(cache.delete('key4'), false)
				Equal(cache.get('key4'), null)
			})

			it('delete by tag :any', function(){
				Equal(cache.deleteTagged('moo'), 1)
				Equal(cache.get('key9'), null)
			})

			it('delete by tag :all', function(){
				Equal(cache.deleteTagged('foo bar nono', {all:true}), 0)
				Equal(cache.deleteTagged('foo bar', {all:true}), 2)
				Equal(cache.get('key2'), null)
				Equal(cache.get('key10'), null)
			})

			it('delete by trigger', function(){
				Equal(cache.trigger('on.boom'), 2)
				Equal(cache.get('key6'), null)
				Equal(cache.get('key7'), null)
				Equal(cache.get('key10'), null)
			})
		})

		describe('garbage collection', function(){

			it('delete expired', function(){
				Equal(cache.$['key1'].payload, 'v1')
				cache.$['key1'].expires = 111
				Equal(cache.deleteExpired(), 1)
				Equal(cache.$['key1'], undefined)
			})
		})

		describe('clear', function(){

			it('clear cache', function(){
				cache.clear()
				Equal(Object.keys(cache.$).length, 0)
			})
		})
	})
})
