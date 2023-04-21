"use strict"

class MemoryCache {

	constructor(opts={}){
		/** Create new cache instance
				:opts.state    (obj) initial state, an object from cache.export() function
				:opts.gc       (int) garbage collection interval when running auto gc, in seconds
				:opts.logger   (func) logging function, ie. console.log
		**/

		// config
		this.config = {
			gc: opts.gc || 600,
		}

		// internal store
		this.$ = opts.state || Object.create(null)

		// garbage collection timer
		this.gcTimer = null

		// external logger
		this.logger = opts.logger || null
	}

	//
	// 	Helpers
	//

	_timeNow(){
		/** Return current unix time **/
		return Date.now() / 1000 | 0
	}

	_paramArray(input){
		/** Standarize input for functions that accept tags as their input.
				:input 		(str|arr) array of tags or space delimited string
				@return 	(arr)
		**/

		if(typeof input == 'string')
			// trim whitespace, split
			return input.replace(/\s+/g, ' ').trim().split(' ')
		else if(Array.isArray(input))
			return input
		else
			throw new Error('[memory-cache] invalid input, must be string or an array')
	}

	_defaultOrNull(opts){
		return opts.default !== undefined ? opts.default : null
	}

	_itemHasAllTags(item, tags){
		/** Check if passed item has all tags specified **/
		for(const tag of tags)
			if(!item.tags.includes(tag))
				return false
		return true
	}

	_itemHasAnyTag(item, tags){
		/** Check if passed item has any tag specified **/
		for(const tag of tags)
			if(item.tags.includes(tag))
				return true
		return false
	}

	//
	// 	Setters, Getters & Deleters
	//

	set(key, payload, opts={}){
		/** Set cache item
				:key            (str) item's key
				:payload        (str) object to cache
				:opts.expireIn  (int) time to live in seconds
			  	:opts.expireAt  (int) unix timestamp as to when invalidate the item
				:opts.tags      (str|arr) tags for this entry, array or string
				@return         (bool) true
		**/
		const now = this._timeNow()

		this.$[key] = {
			key: key,
			payload: payload,
			tags: (opts.tags ? this._paramArray(opts.tags) : false),
			expires: (opts.expireIn ? now + opts.expireIn : (opts.expireAt || false)),
			created: now,
		}

		this.log(`[cache-set] ${key} (${opts.expireIn ? opts.expireIn + 's' : (opts.expireAt ? 'until ' + opts.expireAt : 'forever')})`)

		return true
	}

	get(key, opts={}){
		/** Get items from the cache if conditions are met, otherwise null or default
				:key            (str) item's key
		 		:opts.default   (any) default value to return on miss
		 		:opts.maxAge    (int) max data age in seconds
		 		:opts.force     (bool) return cache item whether expired or not
			  	@return         (any|null)
		**/

		// what's the time, muzzy?
		const now = this._timeNow()

		// get cached item
		const item = this.$[key]

		// cache exists?
		if(item === undefined){
			this.log(`[cache-miss] ${key} (invalid)`)
			return this._defaultOrNull(opts)
		}

		// forced?
		if(opts.force){
			this.log(`[cache-fetch] ${key} (forced)`)
			return item.payload
		}

		// do we request specific maxAge?
		// maxAge overrides original expiry times
		if(opts.maxAge) {
			if(opts.maxAge > now - item.created){
				// still fresh
				this.log(`[cache-fetch] ${key} (maxAge:met)`)
				return item.payload
			} else {
				// stale
				this.log(`[cache-miss] ${key} (maxAge:stale)`)
				return this._defaultOrNull(opts)
			}
		}

		// go with standard expires
		if(item.expires === false){
			// fresh forever
			this.log(`[cache-fetch] ${key} (forever)`)
			return item.payload
		} else if(item.expires && item.expires > now){
			// still fresh
			this.log(`[cache-fetch] ${key} (fresh)`)
			return item.payload
		} else {
			// expired, delete
			this.log(`[cache-miss] ${key} (expired)`)
			return this._defaultOrNull(opts)
		}
	}

	getMeta(key) {
		/** Return internal cache container for given key, without expiry check **/
		return this.$[key] || null
	}

	delete(keys){
		/** Remove cached items by the key
				:keys      (str|arr) keys to remove from cache
				@return    (int) number of removed items
		**/

		keys = this._paramArray(keys)

		let count = 0

		for(const key of keys){

			if(!this.$[key])
				continue;

			delete this.$[key]
			count += 1

			this.log(`[cache-delete] key ${key}`)
		}

		return count
	}

	clear(){
		/** Reset cache to blank state **/
		this.$ = Object.create(null)
	}

	//
	// 	Aux
	//

	keys(validOnly){
		/** Return list of keys of all currently cached items **/

		if(validOnly)
			this.deleteExpired()

		return Object.keys(this.$)
	}

	tags(validOnly){
		/** Return breakdown of tags used by cache items
				:validOnly     (bool) count only valid items
				@return        (obj) obj of {tag:count} key-value pairs
		**/

		if(validOnly)
			this.deleteExpired()

		const tags = {}

		for(const key in this.$){
			if(!this.$[key].tags)
				continue;
			for(const tag of this.$[key].tags){
				if(tags[tag])
					tags[tag] ++
				else
					tags[tag] = 1
			}
		}
		return tags
	}

	count(validOnly) {
		/** Return count of stored cache items **/

		if(validOnly)
			this.deleteExpired()

		return this.keys().length
	}

	//
	// 	Tags
	//

	_validCheck(item, opts) {

	}

	getTagged(tags, opts={}) {
		/** Get array of cached items that have given tags. Does not perform expiration check, only .get does.
				:tags 		(arr|str) array of tags or space separated string
				:opts.all   (bool) result will contain items that have all tags, else any
				:opts.meta  (bool) return with metadata, inc tags, expiration times, etc
				@return 	(obj)
		**/

		tags = this._paramArray(tags)

		const items = {}

		for(const key of this.keys()){

			const item = this.$[key]

			if(!item.tags)
				continue;

			// any or all?
			if(opts.all) {
				// all!
				if(!this._itemHasAllTags(item, tags))
					continue;
			} else {
				// any!
				if(!this._itemHasAnyTag(item, tags))
					continue;
			}

			// still here, so a match
			if(opts.meta)
				items[key] = item
			else
				items[key] = item.payload
		}

		return items
	}

	_deleteItemsTagged(tags, allTags) {
		/** Remove items with given tags
				:tags		(arr) array of tags to match
				:allTags	(bool) remove only if all tags match, else any
		**/

		// TODO-REFACTOR: this should be somehow merged with the above

		tags = this._paramArray(tags)

		let removed = 0

		// iterate entire cache
		for(const key of this.keys()){

			// go directly to cache store, expiration is irrelevant
			const item = this.$[key]

			if(!item.tags)
				continue;

			// any or all?
			if(allTags) {
				// all!
				if(!this._itemHasAllTags(item, tags))
					continue;
			} else {
				// any!
				if(!this._itemHasAnyTag(item, tags))
					continue;
			}

			// still here, so a match
			delete this.$[key]
			removed ++
		}

		return [tags, removed]
	}

	deleteTagged(tags, opts={}){
		/** Remove items tagged with given keys **/
		const [tagsArr, removed] = this._deleteItemsTagged(tags, opts.all)
		if(this.log)
			this.log(`[cache-tag-delete] ${tagsArr.join(', ')} (${removed} item${removed == 1 ? '' : 's'} removed)`)
		return removed
	}

	//
	// 	Events
	//

	trigger(tags, opts={}){
		/** Remove items tagged with given keys **/
		const [tagsArr, removed] = this._deleteItemsTagged(tags, opts.all)
		if(this.log)
			this.log(`[cache-trigger] ${tagsArr.join(', ')} (${removed} item${removed == 1 ? '' : 's'} ejected)`)
		return removed
	}

	//
	// 	Garbage collection
	//

	deleteExpired(){
		/** Remove expired items from the cache **/

		// measure time taken by gc collection
		const bgn = Date.now()

		let expired = 0
		const now = this._timeNow()

		for(const key of this.keys()){

			const cached = this.$[key]

			if(cached.expires && now > cached.expires){
				// remove
				delete this.$[key]
				expired ++
			}
		}

		this.log(`[cache-gc] removed ${expired} expired key${expired == 1 ? '' : 's'} in ${Date.now() - bgn}ms`)

		// return number of expired items
		return expired
	}

	gcStart(){
		/** Set interval timer that cleans cache from expired items **/

		// stop current timer, if running
		this.gcStop()

		// setup new one
		const interval = this.config.gc
		this.gcTimer = setInterval(this.deleteExpired.bind(this), interval * 1000)
		this.log(`[cache-gc] started scheduled garbage collection (${interval}s interval)`)
	}

	gcStop(){
		/** Stop running garbage collection timer **/

		if(this.gcTimer){
			clearInterval(this.gcTimer)
			this.gcTimer = null
			this.log(`[cache-gc] stopped auto garbage collection`)
			return true
		} else {
			return false
		}
	}

	gcStatus(){
		/** Check if garbage collection is running **/
		return !!this.gcTimer
	}

	//
	// 	Instances
	//

	spawn(opts) {
		/** Create new cache instance **/
		return new MemoryCache(opts)
	}

	dispose() {
		/** Prepare instance for garbage collection **/

		this.$ = null
		this.gcStop()
	}

	//
	// 	Export & Import
	//

	export(opts={}){
		/** Export cache state, as json or obj
			[!] will throw if cache values are not serializable
				:opts.persistent (bool) export only /forever/ items (without expire date)
				:opts.expired    (bool) include expired items (export everything)
				:opts.object     (bool) return as obj, json otherwise
				@return          (obj|json)
		**/

		let toExport;

		if(opts.persistent){
			// pick items without expire value
			toExport = {}
			for(const key in this.$)
				if(!this.$[key].expires)
					toExport[key] = this.$[key]
		} else if(opts.expired){
			// just copy everything
			toExport = this.$
		} else {
			// force gc beforehand
			this.deleteExpired()
			toExport = this.$
		}

		if(opts.object)
			// make crude copy
			return JSON.parse(JSON.stringify(toExport))
		else
			// return as json
			return JSON.stringify(toExport)
	}

	import(obj){
		/** Import cache state from json or object
				:obj 		(obj|json)
		**/

		// don't validate anything if type is correct, just bomb if it's invalid
		if(typeof obj === 'string')
			this.$ = JSON.parse(obj)
		else if(typeof obj === 'object')
			this.$ = obj
		else
			throw new Error('[memory-cache] invalid import type, only JSON and object are supported')

		this.log(`[cache] cache imported`)

		return true
	}

	//
	// 	Logging
	//

	log(msg){
		/** Log cache events, only if logger has been attached **/

		if(this.logger)
			this.logger(msg)
	}
}

module.exports = MemoryCache
