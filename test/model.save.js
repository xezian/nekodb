const test = require('tape')

const ko = require('../ko')

const Instance = require('../lib/models/instance')


test('Saving a new simple model successfully', function (t) {
	const SimpleModel = ko.Model('ko_db_test_save_simple', {
		string: ko.String,
	})

	SimpleModel.create({
		string: 'ok',
	}).save().then(simple => {
		t.equal('_id' in simple, true, 'Instance assigned an _id when not specified')
		t.equal(simple.string, 'ok', 'Instance has correct field')
		return SimpleModel.count({})
	}).then(count => {
		t.equal(count, 1, 'Count incremented after creation')
		return SimpleModel.create({_id: 1, string: 'nice'}).save().then(saved => {
			return saved
		})
	}).then(simple => {
		t.deepEqual(simple, {
			_id: 1,
			string: 'nice',
		}, 'Instance uses assigned _id when specified and contains data')
		return SimpleModel.count({})
	}).then(count => {
		t.equal(count, 2, 'Count incremented after creation')
		t.end()
	}).catch(err => {
		t.error(err)
		t.end()
	})
})

test('Saving a simple model unsuccessfully', function (t) {
	const SimpleModelFail = ko.Model('ko_db_test_save_simple_fail', {
		string: ko.String[5],
		number: ko.Number,
	})

	SimpleModelFail.create({}).save().then(simple => {
		t.fail('Model creation succeeded where it should have failed')
		return SimpleModelFail.count({})
	}).catch(fields => {
		t.pass('Failed to save when fields were missing')
		t.deepEqual(fields, {
			string: undefined,
			number: undefined,
		}, 'Got back an error object that contained the invalid fields')
		//t.end()
		return SimpleModelFail.count({})
	}).then(count => {
		return SimpleModelFail.create({
			string: 'too long string',
			number: 0,
		}).save()
	}).then(simple => {
		t.fail('Model creation succeeded where it should have failed')
		return SimpleModelFail.count({})
	}).catch(fields => {
		t.pass('Failed to save when a field failed validation')
		t.deepEqual(fields, {
			string: 'too long string',
		}, 'Got back an error object that contained the invalid fields')
		//t.end()
		return SimpleModelFail.count({})
	}).then(count => {
		t.equal(count, 0, 'Did not add anything to the database')
		return SimpleModelFail.create({
			_id: '1',
			string: 'ok',
			number: 123,
		}).save()
	}).then(() => {
		return SimpleModelFail.create({
			_id: '1',
			string: 'ok',
			number: 123,
		}).save()
	}).then(model => {
		t.fail('Model creation succeeded where it should have failed')
		return SimpleModelFail.count({})
	}).catch(err => {
		t.equal(err instanceof Error, true, 'Got back an error when creating a duplicate')
		return SimpleModelFail.count({})
	}).then(count => {
		t.equal(count, 1, 'Did not add anything to the database')
		t.end()
	})
})

test('Saving a model with a reference', function (t) {
	const ReferencedModel = ko.Model('ko_db_test_save_referenced', {
		string: ko.String,
	})

	const ModelWithRef = ko.Model('ko_db_test_save_with_ref', {
		field: ko.String,
		ref: ReferencedModel,
	})

	ReferencedModel.create({
		_id: '0',
		string: 'hello',
	}).save().then(() => {
		return ModelWithRef.create({
			_id: '0',
			field: 'zzz',
			ref: '0',
		}).save()
	}).then(saved => {
		t.deepEqual(saved, {
			_id: '0',
			field: 'zzz',
			ref: '0',
		}, 'Got back the saved model')
		return ModelWithRef.count({})
	}).then(count => {
		t.equal(count, 1, 'Saved document to the database')
		return ModelWithRef.findOne({_id: '0'})
	}).then(model => {
		model.field = 'yyy'
		return model.save()
	}).then(() => {
		return ModelWithRef.findOne({_id: '0'})
	}).then(model => {
		t.equal(model.field, 'yyy', 'Document was updated')
		return ModelWithRef.findOne({_id: '0'}).join()
	}).then(model => {
		model.field = 'xxx'
		return model.save()
	}).then(model => {
		return ModelWithRef.findOne({_id: '0'})
	}).then(model => {
		t.equal(model.field, 'xxx', 'Document was saved after a join')
		return ModelWithRef.create({
			_id: '1',
			field: 'aaa',
			ref: {
				_id: '1',
				string: 'goodbye',
			},
		}).saveAll()
	}).then(model => {
		t.pass('Created reference and document together')
		return ReferencedModel.count({})
	}).then(count => {
		t.equal(count, 2, 'Saved reference to the database')
		return ModelWithRef.findOne({_id: '1'})
	}).then(model => {
		t.deepEqual(model, {
			_id: '1',
			field: 'aaa',
			ref: '1',
		}, 'Saved document to the database')
		return model.join()
	}).then(model => {
		model.ref.string = 'konnichi wa'
		return model.saveRefs()
	}).then(() => {
		return ReferencedModel.findOne({_id: '1'})
	}).then(reference => {
		t.deepEqual(reference, {
			_id: '1',
			string: 'konnichi wa',
		}, 'Updated reference')
		t.end()
	}).catch(err => {
		t.error(err)
		t.end()
	})
})

test('Saving a model with an embedded reference', function (t) {
	const EmbeddedModel = ko.Model('ko_db_test_save_embedded', {
		string: ko.String,
	})

	const EmbedModel = ko.Model('ko_db_test_save_embed', {
		ref: EmbeddedModel.embed(),
	})
	EmbedModel.create({
		ref: {
			string: 'In the database',
		},
	}).saveAll().then(doc => {
		t.pass('Created document and embedded reference together')
		t.equal(typeof doc.ref._id, 'string', 'Embedded document received an id')
		return EmbeddedModel.count({_id: doc.ref._id})
	})
	.then(count => {
		t.equal(count, 1, 'Embedded document was saved to the database')
		return EmbedModel.find({})
	})
	.then(docs => {
		t.equal(docs.length, 1, 'Document was saved to the database')
		t.deepEqual(docs[0], {
			_id: docs[0]._id,
			ref: {
				_id: docs[0].ref._id,
				string: 'In the database',
			},
		}, 'Document was saved to the database')
		docs[0].ref.string = 'New value'
		return docs[0].saveRefs()
	})
	.then(() => {
		return EmbeddedModel.find({})
	})
	.then(embedded => {
		t.equal(embedded[0].string, 'New value', 'Embedded document was updated')
		t.end()
	}).catch(err => {
		t.error(err, 'Failed to save the document')
		t.end()
	})
})

test.only('Saving a model with an array of references', function (t) {
	const ReferencedModel = ko.Model('ko_db_test_save_referenced2', {
		string: ko.String,
	})

	const ArrayOfRefs = ko.Model('ko_db_test_save_arr_ref', {
		name: ko.String,
		refs: [ReferencedModel.ref()],
	})

	Promise.all([
		ReferencedModel.create({_id: 0, string: 'a'}).save(),
		ReferencedModel.create({_id: 1, string: 'b'}).save(),
	]).then(() => {
		return ArrayOfRefs.create({
			name: 'zero',
			refs: [0, 1],
		}).save()
	}).then(model => {
		t.deepEqual(model, {
			_id: model._id,
			name: 'zero',
			refs: [0, 1],
		}, 'Saved model')
		return ArrayOfRefs.count({})
	}).then(count => {
		t.equal(count, 1, 'Model count incremented')
		return ArrayOfRefs.findOne({name: 'zero'})
	}).then(model => {
		model.name = 'one'
		return model.save()
	}).then(model => {
		return ArrayOfRefs.findOne({_id: model._id})
	}).then(model => {
		t.equal(model.name, 'one', 'Updated model')
		return ArrayOfRefs.findOne({name: 'one'}).join()
	}).then(model => {
		model.name = 'two'
		return model.save()
	}).then(model => {
		return ArrayOfRefs.findOne({_id: model._id})
	}).then(model => {
		t.equal(model.name, 'two', 'Updated model after join')
		return ArrayOfRefs.findOne({name: 'two'}).join()
	}).then(model => {
		model.refs[0].string = 'z'
		return model.saveRefs()
	}).then(() => {
		return ReferencedModel.findOne({string: 'z'})
	}).then(reference => {
		t.deepEqual(reference, {
			_id: 0,
			string: 'z',
		}, 'Updated a reference after join')
		return ReferencedModel.create({_id: 2, string: 'c'}).save()
	}).then(() => {
		return ArrayOfRefs.findOne({name: 'two'})
	}).then(model => {
		model.refs.push(2)
		return model.save()
	}).then(model => {
		t.deepEqual(model.refs, [0, 1, 2], 'Pushed an existing reference')
		return model.join()
	}).then(model => {
		model.refs.push({
			_id: 3,
			string: 'd',
		})
		return model.saveRefs()
	}).then(() => {
		return ReferencedModel.count({})
	}).then(count => {
		t.equal(count, 4, 'Pushed a new reference and saved it')
		return ReferencedModel.findOne({_id: 3})
	}).then(ref => {
		t.deepEqual(ref, {
			_id: 3,
			string: 'd',
		}, 'New reference saved all data')
		return ArrayOfRefs.create({
			name: 'three',
			refs: [{
				_id: 4,
				string: 'e',
			}],
		}).saveAll()
	}).then(model => {
		t.deepEqual(model, {
			_id: model._id,
			name: 'three',
			refs: [4],
		}, 'Created new model and reference together')
		return ArrayOfRefs.count({})
	}).then(count => {
		t.equal(count, 2, 'Saved new model to the database')
		return ReferencedModel.count({})
	}).then(count => {
		t.equal(count, 5, 'Saved new reference to the database')
		t.end()
	}).catch(err => {
		t.error(err)
		t.end()
	})
})

