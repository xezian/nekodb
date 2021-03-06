const path = require('path')
const merge = require('merge').recursive
const DataStore = require('nedb')

const Cursor = require('./cursor')
const Defer = require('./defer')
const processUpdates = require('./updates')

function NeDBClient (config) {
	this.collections = {}
	this.filepath = config.filepath
	this.inMemory = config.inMemory
	this.autocompactionInterval = config.autocompactionInterval
	if (this.filepath === undefined && this.inMemory === undefined) {
		throw new Error('Did not specify a storage medium')
	}
}

// count, countDocuments, and estimatedDocumentCount all use NeDB's .count method

NeDBClient.prototype.count = function (collection, query) {
	const db = this.collections[collection]
	return new Promise(function (resolve, reject) {
		db.count(query, function (err, count) {
			if (err) {
				return reject(err)
			}
			resolve(count)
		})
	})

}

NeDBClient.prototype.countDocuments = function (collection, query) {
	const db = this.collections[collection]
	return new Promise(function (resolve, reject) {
		db.count(query, function (err, count) {
			if (err) {
				return reject(err)
			}
			resolve(count)
		})
	})

}

NeDBClient.prototype.estimatedDocumentCount = function (collection, query) {
	const db = this.collections[collection]
	return new Promise(function (resolve, reject) {
		db.count(query, function (err, count) {
			if (err) {
				return reject(err)
			}
			resolve(count)
		})
	})
}

NeDBClient.prototype.createCollection = function (name) {
	const config = {autoload: true}
	if (this.filepath !== undefined) {
		config.filename = path.join(this.filepath, name + '.db')
	} else if (this.inMemory) {
		config.inMemoryOnly = true
	}
	this.collections[name] = new DataStore(config)

	if (this.autocompactionInterval !== undefined) {
		this.collections[name].persistence.setAutocompactionInterval(this.autoCompactionInterval)
	}
}

NeDBClient.prototype.createIndex = function (collection, fieldName, options) {
	const db = this.collections[collection]
	options.fieldName = fieldName
	db.ensureIndex(options)
	return Promise.resolve()
}

NeDBClient.prototype.cursorToArray = function (cursor) {
	return new Promise((resolve, reject) => {
		cursor.cursor.exec((err, docs) => {
			if (err) {
				return reject(err)
			}
			resolve(docs)
		})
	})
}

NeDBClient.prototype.close = function (cb) {
	console.warn('NeDB does not support the close operation, this method actually does nothing')
	if (cb) {
		cb()
	}
	return Promise.resolve()
}

NeDBClient.prototype.deleteMany = function (collection, query) {
	const db = this.collections[collection]
	return new Promise(function (resolve, reject) {
		db.remove(query, {multi: true}, function (err, numRemoved) {
			if (err) {
				return reject(err)
			}
			resolve(numRemoved)
		})
	})
}

NeDBClient.prototype.deleteOne = function (collection, query) {
	const db = this.collections[collection]
	return new Promise(function (resolve, reject) {
		db.remove(query, {}, function (err, numRemoved) {
			if (err) {
				return reject(err)
			}
			resolve(numRemoved)
		})
	})
}

NeDBClient.prototype.find = function (collection, query, projection, model) {
	const db = this.collections[collection]
	return new Cursor(db.find(query, projection), this, model, projection)
}

NeDBClient.prototype.findOne = function (collection, query, projection, model) {
	const db = this.collections[collection]
	return new Defer(new Promise(function (resolve, reject) {
		db.findOne(query, projection, function (err, found) {
			if (err) {
				return reject(err)
			}
			resolve(found)
		})
	}), model, projection)
}


NeDBClient.prototype.save = function (collection, document) {
	const db = this.collections[collection]
	return new Promise(function (resolve, reject) {
		if (document.__original) {
			db.insert(document, function (err, inserted) {
				if (err) {
					return reject(err)
				}
				return resolve(inserted)
			})
		} else {
			const updates = {}
			for (const field in document._updates) {
				const value = document._updates[field]
				const update = processUpdates(field, value, false)
				merge(updates, update)
			}
			db.update({_id: document._id}, updates, {upsert: false}, function (err, numAffected, affectedDocuments) {
				if (err) {
					return reject(err)
				}
				const writeResult = {}
				writeResult.nModified = numAffected
				return resolve(writeResult)
			})
		}
	})
}


// does not do validation! danger zone!
// uncomment it to use. this is our dirty little secret

//NeDBClient.prototype.UPDATE = function (collection, query, update) {
	//const db = this.collections[collection]
	//return new Promise(function (resolve, reject) {
		//db.update(query, update, function (err, updated) {
			//if (err) {
				//return reject(err)
			//}
			//resolve(updated)
		//})
	//});
//}

NeDBClient.prototype.ObjectID = String

module.exports = NeDBClient
