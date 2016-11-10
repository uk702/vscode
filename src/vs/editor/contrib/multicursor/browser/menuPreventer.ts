/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { KeyMod } from 'vs/base/common/keyCodes';
import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { editorContribution } from 'vs/editor/browser/editorBrowserExtensions';

import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import URI from 'vs/base/common/uri';

/**
 * Prevents the top-level menu from showing up when doing Alt + Click in the editor
 */
@editorContribution
export class MenuPreventer extends Disposable implements IEditorContribution {

	private static ID = 'editor.contrib.menuPreventer';

	private _editor: ICodeEditor;
	private _altListeningMouse: boolean;
	private _altMouseTriggered: boolean;
	private _ctrlMouseTriggered: boolean;

	constructor(editor: ICodeEditor,
	@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
	) {
		super();
		this._editor = editor;
		this._altListeningMouse = false;
		this._altMouseTriggered = false;
		this._ctrlMouseTriggered = false;

		// A global crossover handler to prevent menu bar from showing up
		// When <alt> is hold, we will listen to mouse events and prevent
		// the release event up <alt> if the mouse is triggered.

		this._register(this._editor.onMouseDown((e) => {
			// Lilx
			let model = editor.getModel();
			let lineno = editor.getSelection().getStartPosition().lineNumber;
			let content = model.getLineContent(lineno);
			if (this._ctrlMouseTriggered) {
				if (content.substr(0,4) == "|=> ") {
					let filename = content.substr(4);

					var fs=require("fs");
					if (fs.existsSync(filename)) {
						this.editorService.openEditor({ resource: URI.file(filename), options: { pinned: true } });
					}
				}
			}

			if (this._altListeningMouse) {
				this._altMouseTriggered = true;
			}
		}));

		this._register(this._editor.onKeyDown((e) => {
			if (e.equals(KeyMod.Alt)) {
				if (!this._altListeningMouse) {
					this._altMouseTriggered = false;
				}
				this._altListeningMouse = true;
			}

			if (e.equals(KeyMod.CtrlCmd))
				this._ctrlMouseTriggered = true;
		}));

		this._register(this._editor.onKeyUp((e) => {
			if (e.equals(KeyMod.Alt)) {
				if (this._altMouseTriggered) {
					e.preventDefault();
				}
				this._altListeningMouse = false;
				this._altMouseTriggered = false;
			}

			this._ctrlMouseTriggered = false;
		}));
	}

	public getId(): string {
		return MenuPreventer.ID;
	}
}
