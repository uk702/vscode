/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { TPromise, Promise } from 'vs/base/common/winjs.base';
import { IDataSource, ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { Action } from 'vs/base/common/actions';
import { IExtensionDependencies, IExtensionsWorkbenchService } from './extensions';
import { once } from 'vs/base/common/event';
import { domEvent } from 'vs/base/browser/event';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';

export interface IExtensionTemplateData {
	icon: HTMLImageElement;
	name: HTMLElement;
	identifier: HTMLElement;
	author: HTMLElement;
	extensionDisposables: IDisposable[];
	extensionDependencies: IExtensionDependencies;
}

export class DataSource implements IDataSource {

	public getId(tree: ITree, element: IExtensionDependencies): string {
		let id = `${element.extension.publisher}.${element.extension.name}`;
		this.getParent(tree, element).then(parent => {
			id = parent ? this.getId(tree, parent) + '/' + id : id;
		});
		return id;
	}

	public hasChildren(tree: ITree, element: IExtensionDependencies): boolean {
		return element.hasDependencies && !this.isSelfAncestor(element);
	}

	public getChildren(tree: ITree, element: IExtensionDependencies): Promise {
		return TPromise.as(element.dependencies);
	}

	public getParent(tree: ITree, element: IExtensionDependencies): Promise {
		return TPromise.as(element.dependent);
	}

	private isSelfAncestor(element: IExtensionDependencies): boolean {
		let ancestor = element.dependent;
		while (ancestor !== null) {
			if (ancestor.extension.identifier === element.extension.identifier) {
				return true;
			}
			ancestor = ancestor.dependent;
		}
		return false;
	}
}

export class Renderer implements IRenderer {

	private static EXTENSION_TEMPLATE_ID = 'extension-template';

	constructor( @IInstantiationService private instantiationService: IInstantiationService) {
	}

	public getHeight(tree: ITree, element: IExtensionDependencies): number {
		return 62;
	}

	public getTemplateId(tree: ITree, element: IExtensionDependencies): string {
		return Renderer.EXTENSION_TEMPLATE_ID;
	}

	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): IExtensionTemplateData {
		dom.addClass(container, 'dependency');

		const icon = dom.append(container, dom.$<HTMLImageElement>('img.icon'));
		const details = dom.append(container, dom.$('.details'));

		const header = dom.append(details, dom.$('.header'));
		const name = dom.append(header, dom.$('span.name'));
		const openExtensionAction = this.instantiationService.createInstance(OpenExtensionAction);
		const extensionDisposables = [dom.addDisposableListener(name, 'click', (e: MouseEvent) => {
			tree.setFocus(openExtensionAction.extensionDependencies);
			tree.setSelection([openExtensionAction.extensionDependencies]);
			openExtensionAction.run(e.ctrlKey || e.metaKey);
			e.stopPropagation();
			e.preventDefault();
		})];
		var identifier = dom.append(header, dom.$('span.identifier'));

		const footer = dom.append(details, dom.$('.footer'));
		var author = dom.append(footer, dom.$('.author'));
		return {
			icon,
			name,
			identifier,
			author,
			extensionDisposables,
			set extensionDependencies(e: IExtensionDependencies) {
				openExtensionAction.extensionDependencies = e;
			}
		};
	}


	public renderElement(tree: ITree, element: IExtensionDependencies, templateId: string, templateData: any): void {
		const extension = element.extension;
		const data = <IExtensionTemplateData>templateData;

		const onError = once(domEvent(data.icon, 'error'));
		onError(() => data.icon.src = extension.iconUrlFallback, null, data.extensionDisposables);
		data.icon.src = extension.iconUrl;

		if (!data.icon.complete) {
			data.icon.style.visibility = 'hidden';
			data.icon.onload = () => data.icon.style.visibility = 'inherit';
		} else {
			data.icon.style.visibility = 'inherit';
		}

		data.name.textContent = extension.displayName;
		data.identifier.textContent = `${extension.publisher}.${extension.name}`;
		data.author.textContent = extension.publisherDisplayName;
		data.extensionDependencies = element;
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: IExtensionTemplateData): void {
		templateData.extensionDisposables = dispose(templateData.extensionDisposables);
	}
}

export class Controller extends DefaultController {

	constructor( @IExtensionsWorkbenchService private extensionsWorkdbenchService: IExtensionsWorkbenchService) {
		super();
		this.downKeyBindingDispatcher.set(KeyMod.CtrlCmd | KeyCode.Enter, (tree: ITree, event: any) => { this.openExtension(tree, true); });
	}

	protected onLeftClick(tree: ITree, element: IExtensionDependencies, event: IMouseEvent): boolean {
		let currentFoucssed = tree.getFocus();
		if (super.onLeftClick(tree, element, event)) {
			if (element.dependent === null) {
				if (currentFoucssed) {
					tree.setFocus(currentFoucssed);
				} else {
					tree.focusFirst();
				}
				return true;
			}
		}
		return false;
	}

	protected onEnter(tree: ITree, event: IKeyboardEvent): boolean {
		if (super.onEnter(tree, event)) {
			this.openExtension(tree, false);
		}
		return false;
	}

	private openExtension(tree: ITree, sideByside: boolean) {
		const element: IExtensionDependencies = tree.getFocus();
		this.extensionsWorkdbenchService.open(element.extension, sideByside);
	}
}

class OpenExtensionAction extends Action {

	private _extensionDependencies: IExtensionDependencies;

	constructor( @IExtensionsWorkbenchService private extensionsWorkdbenchService: IExtensionsWorkbenchService) {
		super('extensions.action.openDependency', '');
	}

	public set extensionDependencies(extensionDependencies: IExtensionDependencies) {
		this._extensionDependencies = extensionDependencies;
	}

	public get extensionDependencies(): IExtensionDependencies {
		return this._extensionDependencies;
	}

	run(sideByside: boolean): TPromise<any> {
		return this.extensionsWorkdbenchService.open(this._extensionDependencies.extension, sideByside);
	}
}