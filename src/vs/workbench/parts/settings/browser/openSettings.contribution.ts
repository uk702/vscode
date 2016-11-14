/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/platform';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actionRegistry';
import { IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/common/editor';
import { EditorDescriptor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { DefaultSettingsEditor, DefaultSettingsInput, DefaultKeybindingsInput } from 'vs/workbench/parts/settings/browser/defaultSettingsEditors';
import { OpenGlobalSettingsAction, OpenGlobalKeybindingsAction, OpenWorkspaceSettingsAction } from 'vs/workbench/parts/settings/browser/openSettingsActions';
import { IOpenSettingsService } from 'vs/workbench/parts/settings/common/openSettings';
import { OpenSettingsService } from 'vs/workbench/parts/settings/browser/openSettingsService';

registerSingleton(IOpenSettingsService, OpenSettingsService);

(<IEditorRegistry>Registry.as(EditorExtensions.Editors)).registerEditor(
	new EditorDescriptor(
		DefaultSettingsEditor.ID,
		nls.localize('defaultSettingsEditor', "Default Settings Editor"),
		'vs/workbench/parts/settings/browser/defaultSettingsEditors',
		'DefaultSettingsEditor'
	),
	[
		new SyncDescriptor(DefaultSettingsInput),
		new SyncDescriptor(DefaultKeybindingsInput)
	]
);

// Contribute Global Actions
const category = nls.localize('preferences', "Preferences");
const registry = Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions);
registry.registerWorkbenchAction(new SyncActionDescriptor(OpenGlobalSettingsAction, OpenGlobalSettingsAction.ID, OpenGlobalSettingsAction.LABEL, {
	primary: null,
	mac: { primary: KeyMod.CtrlCmd | KeyCode.US_COMMA }
}), 'Preferences: Open User Settings', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(OpenGlobalKeybindingsAction, OpenGlobalKeybindingsAction.ID, OpenGlobalKeybindingsAction.LABEL), 'Preferences: Open Keyboard Shortcuts', category);
registry.registerWorkbenchAction(new SyncActionDescriptor(OpenWorkspaceSettingsAction, OpenWorkspaceSettingsAction.ID, OpenWorkspaceSettingsAction.LABEL), 'Preferences: Open Workspace Settings', category);