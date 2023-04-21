# memory-cache

Memory based cache library, with two-way expiration, tags and events.


## Usage

Note: Any function that accepts an array of key/tag names, will also accept a space delimited string. This means that key/tag names should not use spaces. If that's a requirement, then use arrays only.


### Install

    npm i @haxtra/memory-cache


### Create

```js
// import
const Cache = require('@haxtra/memory-cache')

// create instance
const cache = new Cache({ // showing defaults, all optional
    state: {},      // initial state, an object from .export function
    gc: 600,        // garbage collection interval in seconds
    logger: null,   // logging function, ie. `console.log`
})
```


### Set / Update

```js
// basic set
cache.set(key, item)

// set with options, all optional
cache.set(key, item, {
    expireIn: false,  // (int) time to live in seconds
    expireAt: false,  // (int) unix timestamp when item becomes stale
    tags: false       // (arr) item's tags, string or array
})
```


### Get

```js
// basic get
cache.get(key) // returns null on miss

// get with options
cache.get(key, {
    default: null,    // value to return on miss
    maxAge: false,    // max data age in seconds
                      // - maxAge overrides `expire*` option from .set
    force: false,     // return cache item whether expired or not
})

// get internal container for given key, without expiry check
// includes tags, creation and expiration times, if any
cache.getMeta(key)
```

### Delete

```js
// delete given keys, returns number of removed items
cache.delete(str|arr)

// delete everything from the cache
cache.clear()
```


## Tags

Note: `.getTagged` does not check for expiration. If you require fresh items only, run `.deleteExpired` first.

```js
// get items tagged with...
cache.getTagged(str|arr)

// get tagged with options
cache.getTagged(str|arr, {
    all: false,       // item must have all specified tags, otherwise any
    meta: false,      // return internal container, inc tags, etc
})
```

### Delete tagged

```js
// remove items tagged with ANY tag specified
cache.deleteTagged(str|arr)

// remove items having ALL specified tags
cache.deleteTagged(str|arr, {all:true})
```


## Events

Events are conceptual, they are just tags. Tags should describe the data, while events should describe action, upon which the item is invalidated. Tags and events can be set using `tags` option on `.set`, and the convention is to prefix event names with `on.` ie. `on.update`.

A semantic function is provided to be used with events, and it's equal to `.deleteTagged`.

```js
// trigger an event that removes items with ANY specified events and tags
cache.trigger(str|arr)

// trigger an event that removes items with ALL specified events and tags
cache.trigger(str|arr, {all:true})
```


## Info

```js
// get array of keys of currently cached items
cache.keys(validOnly?) // bool

// get count of cached items
cache.count(validOnly?)

// get tag breakdown of cached items
// returns key-value object of tags and their counts
cache.tags(validOnly?)
```


## Garbage Collection

### Manual

```js
// remove all expired items, returns the number of items removed
cache.deleteExpired()
```

### Auto

Runs periodically to clear expired items. Must be started manually.

```js
// start gc
cache.gcStart()

// stop gc
cache.gcStop()

// get status
cache.gcStatus()
```


## Instances

```js
// create new cache instance, accepts the same set of options as the main function
const newCache = cache.spawn(opts?)

// destroy the cache
cache.dispose()
```


## Export / Import

Cache state can be exported and restored later on.

```js
// export as json, including items that will expire at some point (but not expired already)
cache.export()

// export as json, but only persistent items - without expiration time
cache.export({persistent:true})

// export as json, including already expired (straight copy)
cache.export({expired:true})

// export as object, above also applies
cache.export({object:true})
```

Import

```js
// either json or object
cache.import(json|object)
```


## Logger

`memory-cache` will log its events if logger is attached.

```js
// at initialization
const cache = new Cache({logger:console.log})

// at runtime
cache.logger = console.log
```

## Haxxor

```js
// internal state is available at:
cache.$
```

## License

MIT

![](https://hello.haxtra.com/gh-memory-cache)