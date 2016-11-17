/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { LanguageModelCache, getLanguageModelCache } from '../languageModelCache';
import { LanguageService as HTMLLanguageService, HTMLDocument } from 'vscode-html-languageservice';
import { getEmbeddedDocument } from './embeddedSupport';
import { CompletionItem, Location, SignatureHelp, SignatureInformation, ParameterInformation, Definition, TextEdit, TextDocument, Diagnostic, DiagnosticSeverity, Range, CompletionItemKind, Hover, MarkedString, DocumentHighlight, DocumentHighlightKind, CompletionList, Position, FormattingOptions } from 'vscode-languageserver-types';
import { LanguageMode } from './languageModes';
import { getWordAtText } from '../utils/words';

import ts = require('./typescript/typescriptServices');
import { contents as libdts } from './typescript/lib-ts';

const DEFAULT_LIB = {
	NAME: 'defaultLib:lib.d.ts',
	CONTENTS: libdts
};
const FILE_NAME = 'typescript://singlefile/1';  // the same 'file' is used for all contents

const JS_WORD_REGEX = /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g;

export function getJavascriptMode(htmlLanguageService: HTMLLanguageService, htmlDocuments: LanguageModelCache<HTMLDocument>): LanguageMode {
	let compilerOptions = { allowNonTsExtensions: true, allowJs: true, target: ts.ScriptTarget.Latest };
	let currentTextDocument: TextDocument;
	let host = {
		getCompilationSettings: () => compilerOptions,
		getScriptFileNames: () => [FILE_NAME],
		getScriptVersion: (fileName: string) => {
			if (fileName === FILE_NAME) {
				return String(currentTextDocument.version);
			}
			return '1'; // default lib is static
		},
		getScriptSnapshot: (fileName: string) => {
			let text = fileName === FILE_NAME ? currentTextDocument.getText() : DEFAULT_LIB.CONTENTS;
			return {
				getText: (start, end) => text.substring(start, end),
				getLength: () => text.length,
				getChangeRange: () => void 0
			};
		},
		getCurrentDirectory: () => '',
		getDefaultLibFileName: options => DEFAULT_LIB.NAME
	};
	let jsLanguageService = ts.createLanguageService(host);

	let jsDocuments = getLanguageModelCache<TextDocument>(10, 60, document => {
		return getEmbeddedDocument(htmlLanguageService, document, htmlDocuments.get(document), 'javascript');
	});
	let settings: any = {};

	return {
		configure(options: any) {
			settings = options && options.html;
		},
		doValidation(document: TextDocument): Diagnostic[] {
			currentTextDocument = jsDocuments.get(document);
			const diagnostics = jsLanguageService.getSyntacticDiagnostics(FILE_NAME);
			return diagnostics.map(diag => {
				return {
					range: convertRange(currentTextDocument, diag),
					severity: DiagnosticSeverity.Error,
					message: ts.flattenDiagnosticMessageText(diag.messageText, '\n')
				};
			});
		},
		doComplete(document: TextDocument, position: Position): CompletionList {
			currentTextDocument = jsDocuments.get(document);
			let offset = currentTextDocument.offsetAt(position);
			let completions = jsLanguageService.getCompletionsAtPosition(FILE_NAME, offset);
			if (!completions) {
				return { isIncomplete: false, items: [] };
			}
			let replaceRange = convertRange(currentTextDocument, getWordAtText(currentTextDocument.getText(), offset, JS_WORD_REGEX));
			return {
				isIncomplete: false,
				items: completions.entries.map(entry => {
					return {
						uri: document.uri,
						position: position,
						label: entry.name,
						sortText: entry.sortText,
						kind: convertKind(entry.kind),
						textEdit: TextEdit.replace(replaceRange, entry.name),
						data: { // data used for resolving item details (see 'doResolve')
							languageId: 'javascript',
							uri: document.uri,
							offset: offset
						}
					};
				})
			};
		},
		doResolve(document: TextDocument, item: CompletionItem): CompletionItem {
			currentTextDocument = jsDocuments.get(document);
			let details = jsLanguageService.getCompletionEntryDetails(FILE_NAME, item.data.offset, item.label);
			if (details) {
				item.detail = ts.displayPartsToString(details.displayParts);
				item.documentation = ts.displayPartsToString(details.documentation);
				delete item.data;
			}
			return item;
		},
		doHover(document: TextDocument, position: Position): Hover {
			currentTextDocument = jsDocuments.get(document);
			let info = jsLanguageService.getQuickInfoAtPosition(FILE_NAME, currentTextDocument.offsetAt(position));
			if (info) {
				let contents = ts.displayPartsToString(info.displayParts);
				return {
					range: convertRange(currentTextDocument, info.textSpan),
					contents: MarkedString.fromPlainText(contents)
				};
			}
			return null;
		},
		doSignatureHelp(document: TextDocument, position: Position): SignatureHelp {
			currentTextDocument = jsDocuments.get(document);
			let signHelp = jsLanguageService.getSignatureHelpItems(FILE_NAME, currentTextDocument.offsetAt(position));
			if (signHelp) {
				let ret: SignatureHelp = {
					activeSignature: signHelp.selectedItemIndex,
					activeParameter: signHelp.argumentIndex,
					signatures: []
				};
				signHelp.items.forEach(item => {

					let signature: SignatureInformation = {
						label: '',
						documentation: null,
						parameters: []
					};

					signature.label += ts.displayPartsToString(item.prefixDisplayParts);
					item.parameters.forEach((p, i, a) => {
						let label = ts.displayPartsToString(p.displayParts);
						let parameter: ParameterInformation = {
							label: label,
							documentation: ts.displayPartsToString(p.documentation)
						};
						signature.label += label;
						signature.parameters.push(parameter);
						if (i < a.length - 1) {
							signature.label += ts.displayPartsToString(item.separatorDisplayParts);
						}
					});
					signature.label += ts.displayPartsToString(item.suffixDisplayParts);
					ret.signatures.push(signature);
				});
				return ret;
			};
			return null;
		},
		findDocumentHighlight(document: TextDocument, position: Position): DocumentHighlight[] {
			currentTextDocument = jsDocuments.get(document);
			let occurrences = jsLanguageService.getOccurrencesAtPosition(FILE_NAME, currentTextDocument.offsetAt(position));
			if (occurrences) {
				return occurrences.map(entry => {
					return {
						range: convertRange(currentTextDocument, entry.textSpan),
						kind: entry.isWriteAccess ? DocumentHighlightKind.Write : DocumentHighlightKind.Text
					};
				});
			};
			return null;
		},
		findDefinition(document: TextDocument, position: Position): Definition {
			currentTextDocument = jsDocuments.get(document);
			let definition = jsLanguageService.getDefinitionAtPosition(FILE_NAME, currentTextDocument.offsetAt(position));
			if (definition) {
				return definition.filter(d => d.fileName === FILE_NAME).map(d => {
					return {
						uri: document.uri,
						range: convertRange(currentTextDocument, d.textSpan)
					};
				});
			}
			return null;
		},
		findReferences(document: TextDocument, position: Position): Location[] {
			currentTextDocument = jsDocuments.get(document);
			let references = jsLanguageService.getReferencesAtPosition(FILE_NAME, currentTextDocument.offsetAt(position));
			if (references) {
				return references.filter(d => d.fileName === FILE_NAME).map(d => {
					return {
						uri: document.uri,
						range: convertRange(currentTextDocument, d.textSpan)
					};
				});
			}
			return null;
		},
		format(document: TextDocument, range: Range, formatParams: FormattingOptions): TextEdit[] {
			currentTextDocument = jsDocuments.get(document);
			let formatSettings = convertOptions(formatParams, settings && settings.format);
			let start = currentTextDocument.offsetAt(range.start);
			let end = currentTextDocument.offsetAt(range.end);
			let edits = jsLanguageService.getFormattingEditsForRange(FILE_NAME, start, end, formatSettings);
			if (edits) {
				return edits.map(e => ({
					range: convertRange(currentTextDocument, e.span),
					newText: e.newText
				}));
			}
			return null;
		},
		onDocumentRemoved(document: TextDocument) {
			jsDocuments.onDocumentRemoved(document);
		},
		dispose() {
			jsDocuments.dispose();
			jsLanguageService.dispose();
		}
	};
};

function convertRange(document: TextDocument, span: { start: number, length: number }): Range {
	let startPosition = document.positionAt(span.start);
	let endPosition = document.positionAt(span.start + span.length);
	return Range.create(startPosition, endPosition);
}

function convertKind(kind: string): CompletionItemKind {
	switch (kind) {
		case 'primitive type':
		case 'keyword':
			return CompletionItemKind.Keyword;
		case 'var':
		case 'local var':
			return CompletionItemKind.Variable;
		case 'property':
		case 'getter':
		case 'setter':
			return CompletionItemKind.Field;
		case 'function':
		case 'method':
		case 'construct':
		case 'call':
		case 'index':
			return CompletionItemKind.Function;
		case 'enum':
			return CompletionItemKind.Enum;
		case 'module':
			return CompletionItemKind.Module;
		case 'class':
			return CompletionItemKind.Class;
		case 'interface':
			return CompletionItemKind.Interface;
		case 'warning':
			return CompletionItemKind.File;
	}

	return CompletionItemKind.Property;
}

function convertOptions(options: FormattingOptions, formatSettings?: any): ts.FormatCodeOptions {
	return {
		ConvertTabsToSpaces: options.insertSpaces,
		TabSize: options.tabSize,
		IndentSize: options.tabSize,
		IndentStyle: ts.IndentStyle.Smart,
		NewLineCharacter: '\n',
		BaseIndentSize: 1, //
		InsertSpaceAfterCommaDelimiter: !formatSettings || formatSettings.insertSpaceAfterCommaDelimiter,
		InsertSpaceAfterSemicolonInForStatements: !formatSettings || formatSettings.insertSpaceAfterSemicolonInForStatements,
		InsertSpaceBeforeAndAfterBinaryOperators: !formatSettings || formatSettings.insertSpaceBeforeAndAfterBinaryOperators,
		InsertSpaceAfterKeywordsInControlFlowStatements: !formatSettings || formatSettings.insertSpaceAfterKeywordsInControlFlowStatements,
		InsertSpaceAfterFunctionKeywordForAnonymousFunctions: !formatSettings || formatSettings.insertSpaceAfterFunctionKeywordForAnonymousFunctions,
		InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis,
		InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets,
		InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces,
		PlaceOpenBraceOnNewLineForControlBlocks: formatSettings && formatSettings.placeOpenBraceOnNewLineForFunctions,
		PlaceOpenBraceOnNewLineForFunctions: formatSettings && formatSettings.placeOpenBraceOnNewLineForControlBlocks
	};
}