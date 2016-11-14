/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/mybooksviewlet';
import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { EditorType } from 'vs/editor/common/editorCommon';
import lifecycle = require('vs/base/common/lifecycle');
import errors = require('vs/base/common/errors');
import aria = require('vs/base/browser/ui/aria/aria');
import { IExpression } from 'vs/base/common/glob';
import { isFunction } from 'vs/base/common/types';
import URI from 'vs/base/common/uri';
import strings = require('vs/base/common/strings');
import dom = require('vs/base/browser/dom');
import { IAction, Action } from 'vs/base/common/actions';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Dimension, Builder, $ } from 'vs/base/browser/builder';
import { FindInput } from 'vs/base/browser/ui/findinput/findInput';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { Scope } from 'vs/workbench/common/memento';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { getOutOfWorkspaceEditorResources } from 'vs/workbench/common/editor';
import { FileChangeType, FileChangesEvent, EventType as FileEventType } from 'vs/platform/files/common/files';
import { Viewlet } from 'vs/workbench/browser/viewlet';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEventService } from 'vs/platform/event/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService } from 'vs/platform/message/common/message';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { KeyCode } from 'vs/base/common/keyCodes';
import Severity from 'vs/base/common/severity';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import * as Constants from 'vs/workbench/parts/mybooks/common/constants';

export class MybooksViewlet extends Viewlet {
	private size: Dimension;
	private isDisposed: boolean;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IEventService private eventService: IEventService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IEditorGroupService private editorGroupService: IEditorGroupService,
		@IProgressService private progressService: IProgressService,
		@IMessageService private messageService: IMessageService,
		@IStorageService private storageService: IStorageService,
		@IContextViewService private contextViewService: IContextViewService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IKeybindingService private keybindingService: IKeybindingService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService
	) {
		super(Constants.VIEWLET_ID, telemetryService);

		this.toUnbind.push(this.configurationService.onDidUpdateConfiguration(e => this.onConfigurationUpdated(e.config)));

	}

	private onConfigurationUpdated(configuration: any): void {
	}

	public create(parent: Builder): TPromise<void> {
		super.create(parent);

		return TPromise.as(null);
	}

	public layout(dimension: Dimension): void {
		this.size = dimension;
		this.reLayout();
	}

	private reLayout(): void {
		if (this.isDisposed) {
			return;
		}
	}

	public dispose(): void {
		super.dispose();
	}
}