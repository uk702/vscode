/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import URI from 'vs/base/common/uri';
import { first, always } from 'vs/base/common/async';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IModel } from 'vs/editor/common/editorCommon';
import { IDisposable, toDisposable, IReference, ReferenceCollection, ImmortalReference } from 'vs/base/common/lifecycle';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ResourceEditorModel } from 'vs/workbench/common/editor/resourceEditorModel';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import network = require('vs/base/common/network');
import { ITextModelResolverService, ITextModelContentProvider, ITextEditorModel } from 'vs/editor/common/services/resolverService';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';

class ResourceModelCollection extends ReferenceCollection<TPromise<ITextEditorModel>> {

	private providers: { [scheme: string]: ITextModelContentProvider[] } = Object.create(null);

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IModelService private modelService: IModelService
	) {
		super();
	}

	createReferencedObject(key: string): TPromise<ITextEditorModel> {
		const resource = URI.parse(key);

		return this.resolveTextModelContent(this.modelService, key)
			.then(() => this.instantiationService.createInstance(ResourceEditorModel, resource));
	}

	destroyReferencedObject(modelPromise: TPromise<ITextEditorModel>): void {
		modelPromise.done(model => model.dispose());
	}

	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable {
		const registry = this.providers;
		const providers = registry[scheme] || (registry[scheme] = []);

		providers.unshift(provider);

		return toDisposable(() => {
			const array = registry[scheme];

			if (!array) {
				return;
			}

			const index = array.indexOf(provider);

			if (index === -1) {
				return;
			}

			array.splice(index, 1);

			if (array.length === 0) {
				delete registry[scheme];
			}
		});
	}

	private resolveTextModelContent(modelService: IModelService, key: string): TPromise<IModel> {
		const resource = URI.parse(key);
		const model = modelService.getModel(resource);

		if (model) {
			// TODO@Joao this should never happen
			return TPromise.as(model);
		}

		const providers = this.providers[resource.scheme] || [];
		const factories = providers.map(p => () => p.provideTextContent(resource));

		return first(factories).then(uri => {
			if (!uri) {
				return TPromise.wrapError(`Could not resolve any model with uri '${resource}'.`);
			}

			return uri;
		});
	}
}

export class TextModelResolverService implements ITextModelResolverService {

	_serviceBrand: any;

	private promiseCache: { [uri: string]: TPromise<IReference<ITextEditorModel>> } = Object.create(null);
	private resourceModelCollection: ResourceModelCollection;

	constructor(
		@ITextFileService private textFileService: ITextFileService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		this.resourceModelCollection = instantiationService.createInstance(ResourceModelCollection);
	}

	createModelReference(resource: URI): TPromise<IReference<ITextEditorModel>> {
		const uri = resource.toString();
		let promise = this.promiseCache[uri];

		if (promise) {
			return promise;
		}

		promise = this.promiseCache[uri] = this._createModelReference(resource);

		return always(promise, () => delete this.promiseCache[uri]);
	}

	private _createModelReference(resource: URI): TPromise<IReference<ITextEditorModel>> {
		// File Schema: use text file service
		// TODO ImmortalReference is a hack
		if (resource.scheme === network.Schemas.file) {
			return this.textFileService.models.loadOrCreate(resource)
				.then(model => new ImmortalReference(model));
		}

		// Untitled Schema: go through cached input
		// TODO ImmortalReference is a hack
		if (resource.scheme === UntitledEditorInput.SCHEMA) {
			return this.untitledEditorService.createOrGet(resource).resolve()
				.then(model => new ImmortalReference(model));
		}

		const ref = this.resourceModelCollection.acquire(resource.toString());
		return ref.object.then(model => ({ object: model, dispose: () => ref.dispose() }));
	}

	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable {
		return this.resourceModelCollection.registerTextModelContentProvider(scheme, provider);
	}
}