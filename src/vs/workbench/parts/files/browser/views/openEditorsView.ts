/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import errors = require('vs/base/common/errors');
import { RunOnceScheduler } from 'vs/base/common/async';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction, IActionRunner } from 'vs/base/common/actions';
import dom = require('vs/base/browser/dom');
import { CollapsibleState } from 'vs/base/browser/ui/splitview/splitview';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IEditorStacksModel, IStacksModelChangeEvent, IEditorGroup } from 'vs/workbench/common/editor';
import { SaveAllAction } from 'vs/workbench/parts/files/browser/fileActions';
import { AdaptiveCollapsibleViewletView } from 'vs/workbench/browser/viewlet';
import { IFilesConfiguration, VIEWLET_ID } from 'vs/workbench/parts/files/common/files';
import { ITextFileService, AutoSaveMode } from 'vs/workbench/services/textfile/common/textfiles';
import { IViewletService } from 'vs/workbench/services/viewlet/common/viewletService';
import { Renderer, DataSource, Controller, AccessibilityProvider, ActionProvider, OpenEditor, DragAndDrop } from 'vs/workbench/parts/files/browser/views/openEditorsViewer';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { CloseAllEditorsAction } from 'vs/workbench/browser/parts/editor/editorActions';
import { ToggleEditorLayoutAction } from 'vs/workbench/browser/actions/toggleEditorLayout';
import { IDataSource, ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';

import URI from 'vs/base/common/uri';
import { FileLabel, IFileLabelOptions } from 'vs/workbench/browser/labels';
import treedefaults = require('vs/base/parts/tree/browser/treeDefaults');

const $ = dom.$;

export class OpenEditorsView extends AdaptiveCollapsibleViewletView {

	private static MEMENTO_COLLAPSED = 'openEditors.memento.collapsed';
	private static DEFAULT_VISIBLE_OPEN_EDITORS = 9;
	private static DEFAULT_DYNAMIC_HEIGHT = true;

	private settings: any;
	private visibleOpenEditors: number;
	private dynamicHeight: boolean;

	private model: IEditorStacksModel;
	private dirtyCountElement: HTMLElement;
	private structuralTreeRefreshScheduler: RunOnceScheduler;
	private structuralRefreshDelay: number;
	private groupToRefresh: IEditorGroup;
	private fullRefreshNeeded: boolean;

	constructor(actionRunner: IActionRunner, settings: any,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@ITextFileService private textFileService: ITextFileService,
		@IEditorGroupService editorGroupService: IEditorGroupService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService,
		@IViewletService private viewletService: IViewletService
	) {
		super(actionRunner, OpenEditorsView.computeExpandedBodySize(editorGroupService.getStacksModel()), !!settings[OpenEditorsView.MEMENTO_COLLAPSED], nls.localize({ key: 'openEditosrSection', comment: ['Open is an adjective'] }, "Open Editors Section"), keybindingService, contextMenuService);

		this.settings = settings;
		this.model = editorGroupService.getStacksModel();

		this.structuralRefreshDelay = 0;
		this.structuralTreeRefreshScheduler = new RunOnceScheduler(() => this.structuralTreeUpdate(), this.structuralRefreshDelay);
	}

	public renderHeader(container: HTMLElement): void {
		const titleDiv = dom.append(container, $('.title'));
		const titleSpan = dom.append(titleDiv, $('span'));
		titleSpan.textContent = nls.localize({ key: 'openEditors', comment: ['Open is an adjective'] }, "Open Editors");

		this.dirtyCountElement = dom.append(titleDiv, $('.monaco-count-badge'));
		this.updateDirtyIndicator();

		super.renderHeader(container);
	}

	public getActions(): IAction[] {
		return [
			this.instantiationService.createInstance(ToggleEditorLayoutAction, ToggleEditorLayoutAction.ID, ToggleEditorLayoutAction.LABEL),
			this.instantiationService.createInstance(SaveAllAction, SaveAllAction.ID, SaveAllAction.LABEL),
			this.instantiationService.createInstance(CloseAllEditorsAction, CloseAllEditorsAction.ID, CloseAllEditorsAction.LABEL)
		];
	}

	public renderBody(container: HTMLElement): void {
		this.treeContainer = super.renderViewTree(container);
		dom.addClass(this.treeContainer, 'explorer-open-editors');
		dom.addClass(this.treeContainer, 'show-file-icons');

		const dataSource = this.instantiationService.createInstance(DataSource);
		const actionProvider = this.instantiationService.createInstance(ActionProvider, this.model);
		const renderer = this.instantiationService.createInstance(Renderer, actionProvider);
		const controller = this.instantiationService.createInstance(Controller, actionProvider, this.model);
		const accessibilityProvider = this.instantiationService.createInstance(AccessibilityProvider);
		const dnd = this.instantiationService.createInstance(DragAndDrop);

		this.tree = new Tree(this.treeContainer, {
			dataSource,
			renderer,
			controller,
			accessibilityProvider,
			dnd
		}, {
				indentPixels: 0,
				twistiePixels: 20,
				ariaLabel: nls.localize({ key: 'treeAriaLabel', comment: ['Open is an adjective'] }, "Open Editors")
			});

		this.fullRefreshNeeded = true;
		this.structuralTreeUpdate();
	}

	public create(): TPromise<void> {

		// Load Config
		const configuration = this.configurationService.getConfiguration<IFilesConfiguration>();
		this.onConfigurationUpdated(configuration);

		// listeners
		this.registerListeners();

		return super.create();
	}

	private registerListeners(): void {

		// update on model changes
		this.toDispose.push(this.model.onModelChanged(e => this.onEditorStacksModelChanged(e)));

		// Also handle configuration updates
		this.toDispose.push(this.configurationService.onDidUpdateConfiguration(e => this.onConfigurationUpdated(e.config)));

		// Also handle dirty count indicator #10556
		this.toDispose.push(this.textFileService.models.onModelDirty(e => this.updateDirtyIndicator()));

		// We are not updating the tree while the viewlet is not visible. Thus refresh when viewlet becomes visible #6702
		this.toDispose.push(this.viewletService.onDidViewletOpen(viewlet => {
			if (viewlet.getId() === VIEWLET_ID) {
				this.fullRefreshNeeded = true;
				this.structuralTreeUpdate();
				this.updateDirtyIndicator();
			}
		}));
	}

	private onEditorStacksModelChanged(e: IStacksModelChangeEvent): void {
		if (this.isDisposed || !this.isVisible || !this.tree) {
			return;
		}

		// Do a minimal tree update based on if the change is structural or not #6670
		if (e.structural) {
			// If an editor changed structurally it is enough to refresh the group, otherwise a group changed structurally and we need the full refresh.
			// If there are multiple groups to refresh - refresh the whole tree.
			if (e.editor && !this.groupToRefresh) {
				this.groupToRefresh = e.group;
			} else {
				this.fullRefreshNeeded = true;
			}
			this.structuralTreeRefreshScheduler.schedule(this.structuralRefreshDelay);
		} else {
			const toRefresh = e.editor ? new OpenEditor(e.editor, e.group) : e.group;
			this.updateDirtyIndicator();
			this.tree.refresh(toRefresh, false).done(() => this.highlightActiveEditor(), errors.onUnexpectedError);
		}
	}

	private structuralTreeUpdate(): void {
		// View size
		this.expandedBodySize = this.getExpandedBodySize(this.model);
		// Show groups only if there is more than 1 group
		const treeInput = this.model.groups.length === 1 ? this.model.groups[0] : this.model;
		// TODO@Isidor temporary workaround due to a partial tree refresh issue
		this.fullRefreshNeeded = true;
		const toRefresh = this.fullRefreshNeeded ? null : this.groupToRefresh;

		(treeInput !== this.tree.getInput() ? this.tree.setInput(treeInput) : this.tree.refresh(toRefresh)).done(() => {
			this.fullRefreshNeeded = false;
			this.groupToRefresh = null;

			// Always expand all the groups as they are unclickable
			return this.tree.expandAll(this.model.groups).then(() => this.highlightActiveEditor());
		}, errors.onUnexpectedError);
	}

	private highlightActiveEditor(): void {
		if (this.model.activeGroup && this.model.activeGroup.activeEditor /* could be empty */) {
			const openEditor = new OpenEditor(this.model.activeGroup.activeEditor, this.model.activeGroup);
			this.tree.clearFocus();
			this.tree.clearSelection();

			if (openEditor) {
				this.tree.setFocus(openEditor);
				this.tree.setSelection([openEditor]);
				const relativeTop = this.tree.getRelativeTop(openEditor);
				if (relativeTop <= 0 || relativeTop >= 1) {
					// Only reveal the element if it is not visible #8279
					this.tree.reveal(openEditor).done(null, errors.onUnexpectedError);
				}
			}
		}
	}

	private onConfigurationUpdated(configuration: IFilesConfiguration): void {
		if (this.isDisposed) {
			return; // guard against possible race condition when config change causes recreate of views
		}

		let visibleOpenEditors = configuration && configuration.explorer && configuration.explorer.openEditors && configuration.explorer.openEditors.visible;
		if (typeof visibleOpenEditors === 'number') {
			this.visibleOpenEditors = visibleOpenEditors;
		} else {
			this.visibleOpenEditors = OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS;
		}

		let dynamicHeight = configuration && configuration.explorer && configuration.explorer.openEditors && configuration.explorer.openEditors.dynamicHeight;
		if (typeof dynamicHeight === 'boolean') {
			this.dynamicHeight = dynamicHeight;
		} else {
			this.dynamicHeight = OpenEditorsView.DEFAULT_DYNAMIC_HEIGHT;
		}

		// Adjust expanded body size
		this.expandedBodySize = this.getExpandedBodySize(this.model);
	}

	private updateDirtyIndicator(): void {
		let dirty = this.textFileService.getAutoSaveMode() !== AutoSaveMode.AFTER_SHORT_DELAY ? this.textFileService.getDirty().length
			: this.untitledEditorService.getDirty().length;
		if (dirty === 0) {
			dom.addClass(this.dirtyCountElement, 'hidden');
		} else {
			this.dirtyCountElement.textContent = nls.localize('dirtyCounter', "{0} unsaved", dirty);
			dom.removeClass(this.dirtyCountElement, 'hidden');
		}
	}

	private getExpandedBodySize(model: IEditorStacksModel): number {
		return OpenEditorsView.computeExpandedBodySize(model, this.visibleOpenEditors, this.dynamicHeight);
	}

	private static computeExpandedBodySize(model: IEditorStacksModel, visibleOpenEditors = OpenEditorsView.DEFAULT_VISIBLE_OPEN_EDITORS, dynamicHeight = OpenEditorsView.DEFAULT_DYNAMIC_HEIGHT): number {
		let entryCount = model.groups.reduce((sum, group) => sum + group.count, 0);
		// We only show the group labels if there is more than 1 group
		if (model.groups.length > 1) {
			entryCount += model.groups.length;
		}

		let itemsToShow: number;
		if (dynamicHeight) {
			itemsToShow = Math.min(Math.max(visibleOpenEditors, 1), entryCount);
		} else {
			itemsToShow = Math.max(visibleOpenEditors, 1);
		}

		return itemsToShow * Renderer.ITEM_HEIGHT;
	}

	public setStructuralRefreshDelay(delay: number): void {
		this.structuralRefreshDelay = delay;
	}

	public getOptimalWidth(): number {
		let parentNode = this.tree.getHTMLElement();
		let childNodes = [].slice.call(parentNode.querySelectorAll('.open-editor > a'));

		return dom.getLargestChildWidth(parentNode, childNodes);
	}

	public shutdown(): void {
		this.settings[OpenEditorsView.MEMENTO_COLLAPSED] = (this.state === CollapsibleState.COLLAPSED);

		super.shutdown();
	}
}

var myFastopen = [];
var fs=require("fs");
fs.readFile("d:/myfastopen.txt", 'utf-8', function(err, data){
	if(!err){
		data = data.trim();
		myFastopen = data.split(/\r?\n/);
	}
});

export class MyDataSource implements IDataSource {

	public getId(tree: ITree, element: any): string {
		return element;
	}

	public hasChildren(tree: ITree, element: any): boolean {
		if (element == "root")
			return true;
		return false;
	}

	public getChildren(tree: ITree, element: any): TPromise<any> {
		if (element == "root") {
			return TPromise.as(myFastopen);
		}

		return TPromise.as(null);
	}

	public getParent(tree: ITree, element: any): TPromise<any> {
		return TPromise.as(null);
	}
}

export class MyRenderer implements IRenderer {
	constructor (@IInstantiationService private instantiationService: IInstantiationService) {
	}

	getHeight(tree: ITree, element: any): number {
		return 22;
	}

	getTemplateId(tree: ITree, element: any): string {
		return element;
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {
		console.log("Lilx: renderTemplate, templateId = " + templateId)
		const label = this.instantiationService.createInstance(FileLabel, container, void 0);
		label.setFile(URI.file(templateId) /*, { hidePath: true } */);
		return label;
	}

	renderElement(tree: ITree, element: any, templateId: string, templateData: any): void {
		// console.log("Lilx: renderElement, element = " + element)
		// templateData.name.textContent = element;
	}

	disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
		templateData.dispose();
	}
}

import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

class MyController extends treedefaults.DefaultController {
	constructor(
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@ITelemetryService private telemetryService: ITelemetryService,
		@IKeybindingService private keybindingService: IKeybindingService
	) {
		super({ clickBehavior: treedefaults.ClickBehavior.ON_MOUSE_DOWN });
	}

	protected onLeftClick(tree: ITree, element: any, event: IMouseEvent, origin: string = 'mouse'): boolean {
		// Lilx
		console.log("Lilx: click on " + element);

		const payload = { origin: origin };
		const isDoubleClick = (origin === 'mouse' && event.detail === 2);

		// Cancel Event
		const isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';
		if (!isMouseDown) {
			event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
		}
		event.stopPropagation();

		// Set DOM focus
		tree.DOMFocus();

		// Allow to unselect
		if (event.shiftKey) {
			const selection = tree.getSelection();
			if (selection && selection.length > 0 && selection[0] === element) {
				tree.clearSelection(payload);
			}
		}

		// Select, Focus and open files
		else {
			tree.setFocus(element, payload);

			if (isDoubleClick) {
				event.preventDefault(); // focus moves to editor, we need to prevent default
			}

			tree.setSelection([element], payload);
			if (fs.existsSync(element)) {
				this.editorService.openEditor({ resource: URI.file(element)}).done(null, errors.onUnexpectedError);
			}
		}

		return true;
	}
}

export class MyEditorsView extends AdaptiveCollapsibleViewletView {
	private model: string;

	constructor(actionRunner: IActionRunner,
	 @IInstantiationService private instantiationService: IInstantiationService,
	 @IEditorGroupService editorGroupService: IEditorGroupService,
	 ) {
		super(actionRunner, 30, true, "MyEditorsView", null, null)
		this.model = "root";
		this.expandedBodySize=100;
	}

	public renderHeader(container: HTMLElement): void {
		const titleDiv = dom.append(container, $('.title'));
		const titleSpan = dom.append(titleDiv, $('span'));
		titleSpan.textContent = nls.localize({ key: 'myEditorsView', comment: ['Open is an adjective'] }, "My Editors");

		super.renderHeader(container);
	}

	public renderBody(container: HTMLElement): void {
		this.treeContainer = super.renderViewTree(container);
		dom.addClass(this.treeContainer, 'explorer-open-editors');
		dom.addClass(this.treeContainer, 'show-file-icons');

		const dataSource = this.instantiationService.createInstance(MyDataSource);
		const renderer = this.instantiationService.createInstance(MyRenderer);
		const controller = this.instantiationService.createInstance(MyController);

		this.tree = new Tree(this.treeContainer, {
			dataSource,
			renderer,
			controller
		}, {
				indentPixels: 10,
				twistiePixels: 20,
			});
	}

	public create(): TPromise<void> {
		// const treeInput = this.model.groups.length === 1 ? this.model.groups[0] : this.model;
		// (treeInput !== this.tree.getInput() ? this.tree.setInput(treeInput) : this.tree.refresh(true))

		this.tree.setInput(this.model)
		return super.create();
	}
}
