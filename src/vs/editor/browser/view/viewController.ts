/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EventEmitter } from 'vs/base/common/eventEmitter';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Position } from 'vs/editor/common/core/position';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { IEditorMouseEvent, IMouseTarget, IViewController, IMouseDispatchData } from 'vs/editor/browser/editorBrowser';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IViewModel } from 'vs/editor/common/viewModel/viewModel';
import { Range } from 'vs/editor/common/core/range';

export interface TriggerCursorHandler {
	(source: string, handlerId: string, payload: any): void;
}

export class ViewController implements IViewController {

	private viewModel: IViewModel;
	private triggerCursorHandler: TriggerCursorHandler;
	private outgoingEventBus: EventEmitter;
	private commandService: ICommandService;

	constructor(
		viewModel: IViewModel,
		triggerCursorHandler: TriggerCursorHandler,
		outgoingEventBus: EventEmitter,
		commandService: ICommandService
	) {
		this.viewModel = viewModel;
		this.triggerCursorHandler = triggerCursorHandler;
		this.outgoingEventBus = outgoingEventBus;
		this.commandService = commandService;
	}

	public paste(source: string, text: string, pasteOnNewLine: boolean): void {
		this.commandService.executeCommand(editorCommon.Handler.Paste, {
			text: text,
			pasteOnNewLine: pasteOnNewLine,
		});
	}

	public type(source: string, text: string): void {
		this.commandService.executeCommand(editorCommon.Handler.Type, {
			text: text
		});
	}

	public replacePreviousChar(source: string, text: string, replaceCharCnt: number): void {
		this.commandService.executeCommand(editorCommon.Handler.ReplacePreviousChar, {
			text: text,
			replaceCharCnt: replaceCharCnt
		});
	}

	public compositionStart(source: string): void {
		this.commandService.executeCommand(editorCommon.Handler.CompositionStart, {});
	}

	public compositionEnd(source: string): void {
		this.commandService.executeCommand(editorCommon.Handler.CompositionEnd, {});
	}

	public cut(source: string): void {
		this.commandService.executeCommand(editorCommon.Handler.Cut, {});
	}

	private _validateViewColumn(viewPosition: Position): Position {
		let minColumn = this.viewModel.getLineMinColumn(viewPosition.lineNumber);
		if (viewPosition.column < minColumn) {
			return new Position(viewPosition.lineNumber, minColumn);
		}
		return viewPosition;
	}

	public dispatchMouse(data: IMouseDispatchData): void {
		if (data.startedOnLineNumbers) {
			// If the dragging started on the gutter, then have operations work on the entire line
			if (data.altKey) {
				if (data.inSelectionMode) {
					this.lastCursorLineSelect('mouse', data.position);
				} else {
					this.createCursor('mouse', data.position, true);
				}
			} else {
				if (data.inSelectionMode) {
					this.lineSelectDrag('mouse', data.position);
				} else {
					this.lineSelect('mouse', data.position);
				}
			}
		} else if (data.mouseDownCount >= 4) {
			this.selectAll('mouse');
		} else if (data.mouseDownCount === 3) {
			if (data.altKey) {
				if (data.inSelectionMode) {
					this.lastCursorLineSelectDrag('mouse', data.position);
				} else {
					this.lastCursorLineSelect('mouse', data.position);
				}
			} else {
				if (data.inSelectionMode) {
					this.lineSelectDrag('mouse', data.position);
				} else {
					this.lineSelect('mouse', data.position);
				}
			}
		} else if (data.mouseDownCount === 2) {
			if (data.altKey) {
				this.lastCursorWordSelect('mouse', data.position);
			} else {
				if (data.inSelectionMode) {
					this.wordSelectDrag('mouse', data.position);
				} else {
					this.wordSelect('mouse', data.position);
				}
			}
		} else {
			if (data.altKey) {
				if (!data.ctrlKey && !data.metaKey) {
					if (data.shiftKey) {
						this.columnSelect('mouse', data.position, data.mouseColumn);
					} else {
						// Do multi-cursor operations only when purely alt is pressed
						if (data.inSelectionMode) {
							this.lastCursorMoveToSelect('mouse', data.position);
						} else {
							this.createCursor('mouse', data.position, false);
						}
					}
				}
			} else {
				if (data.inSelectionMode) {
					this.moveToSelect('mouse', data.position);
				} else {
					this.moveTo('mouse', data.position);
				}
			}
		}
	}

	public moveTo(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.MoveTo, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private moveToSelect(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.MoveToSelect, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private columnSelect(source: string, viewPosition: Position, mouseColumn: number): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.ColumnSelect, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition,
			mouseColumn: mouseColumn
		});
	}

	private createCursor(source: string, viewPosition: Position, wholeLine: boolean): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.CreateCursor, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition,
			wholeLine: wholeLine
		});
	}

	private lastCursorMoveToSelect(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.LastCursorMoveToSelect, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private wordSelect(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.WordSelect, {
			position: this.convertViewToModelPosition(viewPosition)
		});
	}

	private wordSelectDrag(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.WordSelectDrag, {
			position: this.convertViewToModelPosition(viewPosition)
		});
	}

	private lastCursorWordSelect(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.LastCursorWordSelect, {
			position: this.convertViewToModelPosition(viewPosition)
		});
	}

	private lineSelect(source: string, viewPosition: Position): void {
		// Lilx
		// try {
		// 	console.error("Lilx: lineSelect.");
		// 	let err = new Error("print stack:");
		// 	console.error(err.stack);
		// }
		// catch (Error) {
		// }

		viewPosition = this._validateViewColumn(viewPosition);

		// Lilx
		// console.log("Lilx: triggerCursorHandler = " + this.triggerCursorHandler);
		// "Lilx: triggerCursorHandler = function (source, handlerId, payload) {
		//                 if (!_this.cursor) {
		//                     return;
		//                 }
		//                 _this.cursor.trigger(source, handlerId, payload);
		//             }", source: file:///D:/workspace/vscode/out/vs/editor/browser/view/viewController.js (194)

		// 触发 editorCommon.Handler.LineSelect 这个 action
		this.triggerCursorHandler(source, editorCommon.Handler.LineSelect, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private lineSelectDrag(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.LineSelectDrag, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private lastCursorLineSelect(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.LastCursorLineSelect, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private lastCursorLineSelectDrag(source: string, viewPosition: Position): void {
		viewPosition = this._validateViewColumn(viewPosition);
		this.triggerCursorHandler(source, editorCommon.Handler.LastCursorLineSelectDrag, {
			position: this.convertViewToModelPosition(viewPosition),
			viewPosition: viewPosition
		});
	}

	private selectAll(source: string): void {
		this.triggerCursorHandler(source, editorCommon.Handler.SelectAll, null);
	}

	// ----------------------

	private convertViewToModelPosition(viewPosition: Position): Position {
		return this.viewModel.convertViewPositionToModelPosition(viewPosition.lineNumber, viewPosition.column);
	}

	private convertViewToModelRange(viewRange: editorCommon.IRange): Range {
		return this.viewModel.convertViewRangeToModelRange(viewRange);
	}

	private _convertViewToModelMouseTarget(target: IMouseTarget): IMouseTarget {
		return {
			element: target.element,
			type: target.type,
			position: target.position ? this.convertViewToModelPosition(target.position) : null,
			mouseColumn: target.mouseColumn,
			range: target.range ? this.convertViewToModelRange(target.range) : null,
			detail: target.detail
		};
	}

	private _convertViewToModelMouseEvent(e: IEditorMouseEvent): IEditorMouseEvent {
		if (e.target) {
			return {
				event: e.event,
				target: this._convertViewToModelMouseTarget(e.target)
			};
		}
		return e;
	}

	public emitKeyDown(e: IKeyboardEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.KeyDown, e);
	}

	public emitKeyUp(e: IKeyboardEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.KeyUp, e);
	}

	public emitContextMenu(e: IEditorMouseEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.ContextMenu, this._convertViewToModelMouseEvent(e));
	}

	public emitMouseMove(e: IEditorMouseEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.MouseMove, this._convertViewToModelMouseEvent(e));
	}

	public emitMouseLeave(e: IEditorMouseEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.MouseLeave, this._convertViewToModelMouseEvent(e));
	}

	public emitMouseUp(e: IEditorMouseEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.MouseUp, this._convertViewToModelMouseEvent(e));
	}

	public emitMouseDown(e: IEditorMouseEvent): void {
		this.outgoingEventBus.emit(editorCommon.EventType.MouseDown, this._convertViewToModelMouseEvent(e));
	}

}