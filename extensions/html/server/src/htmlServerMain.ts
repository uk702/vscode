/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { createConnection, IConnection, TextDocuments, InitializeParams, InitializeResult, RequestType } from 'vscode-languageserver';
import { DocumentContext, TextDocument, Diagnostic, DocumentLink, Range } from 'vscode-html-languageservice';
import { getLanguageModes } from './languageModes';

import * as url from 'url';
import * as path from 'path';
import uri from 'vscode-uri';

import * as nls from 'vscode-nls';
nls.config(process.env['VSCODE_NLS_CONFIG']);

namespace ColorSymbolRequest {
	export const type: RequestType<string, Range[], any> = { get method() { return 'css/colorSymbols'; } };
}

// Create a connection for the server
let connection: IConnection = createConnection();

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

let languageModes = getLanguageModes({ 'css': true });

documents.onDidClose(e => {
	languageModes.getAllModes().forEach(m => m.onDocumentRemoved(e.document));
});
connection.onShutdown(() => {
	languageModes.getAllModes().forEach(m => m.dispose());
});

let workspacePath: string;


// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites
connection.onInitialize((params: InitializeParams): InitializeResult => {
	workspacePath = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			completionProvider: { resolveProvider: false, triggerCharacters: ['.', ':', '<', '"', '=', '/'] },
			hoverProvider: true,
			documentHighlightProvider: true,
			documentRangeFormattingProvider: params.initializationOptions['format.enable'],
			documentLinkProvider: true
		}
	};
});


// The settings have changed. Is send on server activation as well.
connection.onDidChangeConfiguration((change) => {
	languageModes.configure(change.settings);
});

let pendingValidationRequests: { [uri: string]: NodeJS.Timer } = {};
const validationDelayMs = 200;

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	triggerValidation(change.document);
});

// a document has closed: clear all diagnostics
documents.onDidClose(event => {
	cleanPendingValidation(event.document);
	connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

function cleanPendingValidation(textDocument: TextDocument): void {
	let request = pendingValidationRequests[textDocument.uri];
	if (request) {
		clearTimeout(request);
		delete pendingValidationRequests[textDocument.uri];
	}
}

function triggerValidation(textDocument: TextDocument): void {
	cleanPendingValidation(textDocument);
	pendingValidationRequests[textDocument.uri] = setTimeout(() => {
		delete pendingValidationRequests[textDocument.uri];
		validateTextDocument(textDocument);
	}, validationDelayMs);
}

function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	languageModes.getAllModesInDocument(textDocument).forEach(mode => {
		if (mode.doValidation) {
			diagnostics = diagnostics.concat(mode.doValidation(textDocument));
		}
	});
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCompletion(textDocumentPosition => {
	let document = documents.get(textDocumentPosition.textDocument.uri);
	let mode = languageModes.getModeAtPosition(document, textDocumentPosition.position);
	if (mode && mode.doComplete) {
		return mode.doComplete(document, textDocumentPosition.position);
	}
	return { isIncomplete: true, items: [] };
});

connection.onHover(textDocumentPosition => {
	let document = documents.get(textDocumentPosition.textDocument.uri);
	let mode = languageModes.getModeAtPosition(document, textDocumentPosition.position);
	if (mode && mode.doHover) {
		return mode.doHover(document, textDocumentPosition.position);
	}
	return null;
});

connection.onDocumentHighlight(documentHighlightParams => {
	let document = documents.get(documentHighlightParams.textDocument.uri);
	let mode = languageModes.getModeAtPosition(document, documentHighlightParams.position);
	if (mode && mode.findDocumentHighlight) {
		return mode.findDocumentHighlight(document, documentHighlightParams.position);
	}
	return [];
});

connection.onDocumentRangeFormatting(formatParams => {
	let document = documents.get(formatParams.textDocument.uri);
	let startMode = languageModes.getModeAtPosition(document, formatParams.range.start);
	let endMode = languageModes.getModeAtPosition(document, formatParams.range.end);
	if (startMode && startMode === endMode && startMode.format) {
		return startMode.format(document, formatParams.range, formatParams.options);
	}
	return null;
});

connection.onDocumentLinks(documentLinkParam => {
	let document = documents.get(documentLinkParam.textDocument.uri);
	let documentContext: DocumentContext = {
		resolveReference: ref => {
			if (workspacePath && ref[0] === '/') {
				return uri.file(path.join(workspacePath, ref)).toString();
			}
			return url.resolve(document.uri, ref);
		}
	};
	let links: DocumentLink[] = [];
	languageModes.getAllModesInDocument(document).forEach(m => {
		if (m.findDocumentLinks) {
			links = links.concat(m.findDocumentLinks(document, documentContext));
		}
	});
	return links;
});

connection.onRequest(ColorSymbolRequest.type, uri => {
	let ranges: Range[] = [];
	let document = documents.get(uri);
	if (document) {
		languageModes.getAllModesInDocument(document).forEach(m => {
			if (m.findColorSymbols) {
				ranges = ranges.concat(m.findColorSymbols(document));
			}
		});
	}
	return ranges;
});

// Listen on the connection
connection.listen();