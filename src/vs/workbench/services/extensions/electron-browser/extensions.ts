/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import pkg from 'vs/platform/package';
import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { distinct } from 'vs/base/common/arrays';
import * as paths from 'vs/base/common/paths';
import URI from 'vs/base/common/uri';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ExtensionScanner, MessagesCollector } from 'vs/workbench/node/extensionPoints';
import { IExtensionManagementService, DidUninstallExtensionEvent } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IWorkspaceContextService, IWorkspace } from 'vs/platform/workspace/common/workspace';
import { IExtensionsRuntimeService, IExtensionDescription, IMessage } from 'vs/platform/extensions/common/extensions';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Severity, IMessageService } from 'vs/platform/message/common/message';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';


const DIRNAME = URI.parse(require.toUrl('./')).fsPath;
const BASE_PATH = paths.normalize(paths.join(DIRNAME, '../../../../../..'));
const BUILTIN_EXTENSIONS_PATH = paths.join(BASE_PATH, 'extensions');
const DISABLED_EXTENSIONS_STORAGE_PATH = 'extensions/disabled';

export class ExtensionsRuntimeService implements IExtensionsRuntimeService {

	_serviceBrand: any;

	private workspace: IWorkspace;

	private installedExtensions: TPromise<IExtensionDescription[]>;
	private _globalDisabledExtensions: string[];
	private _workspaceDisabledExtensions: string[];

	private disposables: IDisposable[] = [];

	constructor(
		@IStorageService private storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IMessageService private messageService: IMessageService,
		@IEnvironmentService private environmentService: IEnvironmentService,
		@IExtensionManagementService private extensionManagementService: IExtensionManagementService
	) {
		this.workspace = contextService.getWorkspace();
		extensionManagementService.onDidUninstallExtension(this.onDidUninstallExtension, this, this.disposables);
	}

	public getExtensions(includeDisabled: boolean = false): TPromise<IExtensionDescription[]> {
		if (!this.installedExtensions) {
			this.installedExtensions = this.scanExtensions();
		}
		if (includeDisabled) {
			return this.installedExtensions;
		}
		return this.installedExtensions.then(extensionDescriptions => {
			const disabledExtensions = this.getDisabledExtensions();
			return disabledExtensions.length ? extensionDescriptions.filter(e => disabledExtensions.indexOf(`${e.publisher}.${e.name}`) === -1) : extensionDescriptions;
		});
	}

	public canEnable(identifier: string): boolean {
		if (this.environmentService.disableExtensions) {
			return false;
		}

		return this.getDisabledExtensions().indexOf(identifier) !== -1;
	}

	public isDisabled(identifier: string): boolean {
		if (this.environmentService.disableExtensions) {
			return true;
		}

		return this.getDisabledExtensions().indexOf(identifier) !== -1;
	}

	public isDisabledAlways(identifier: string): boolean {
		return this.globalDisabledExtensions.indexOf(identifier) !== -1;
	}

	public setEnablement(identifier: string, enable: boolean, workspace: boolean = false): TPromise<boolean> {
		if (workspace && !this.workspace) {
			return TPromise.wrapError(localize('noWorkspace', "No workspace."));
		}

		if (this.environmentService.disableExtensions) {
			return TPromise.wrap(false);
		}

		if (this.isDisabled(identifier) === !enable) {
			return TPromise.wrap(false);
		}

		if (enable) {
			if (workspace) {
				this.enableExtension(identifier, StorageScope.WORKSPACE);
			} else {
				this.enableExtension(identifier, StorageScope.GLOBAL);
			}
		} else {
			if (workspace) {
				this.disableExtension(identifier, StorageScope.WORKSPACE);
			} else {
				this.disableExtension(identifier, StorageScope.GLOBAL);
			}
		}

		return TPromise.wrap(true);
	}

	private getDisabledExtensions(): string[] {
		return [...this.globalDisabledExtensions, ...this.workspaceDisabledExtensions];
	}

	private get workspaceDisabledExtensions(): string[] {
		if (!this._workspaceDisabledExtensions) {
			this._workspaceDisabledExtensions = this.getDisabledExtensionsFromStorage(StorageScope.WORKSPACE);
		}
		return this._workspaceDisabledExtensions;
	}

	private get globalDisabledExtensions(): string[] {
		if (!this._globalDisabledExtensions) {
			this._globalDisabledExtensions = this.getDisabledExtensionsFromStorage(StorageScope.GLOBAL);
		}
		return this._globalDisabledExtensions;
	}

	private getDisabledExtensionsFromStorage(scope?: StorageScope): string[] {
		if (scope !== void 0) {
			return this._getDisabledExtensions(scope);
		}

		const globallyDisabled = this._getDisabledExtensions(StorageScope.GLOBAL);
		const workspaceDisabled = this._getDisabledExtensions(StorageScope.WORKSPACE);
		return [...globallyDisabled, ...workspaceDisabled];
	}

	private disableExtension(identifier: string, scope: StorageScope): TPromise<boolean> {
		let disabledExtensions = this._getDisabledExtensions(scope);
		disabledExtensions.push(identifier);
		this._setDisabledExtensions(disabledExtensions, scope);
		return TPromise.wrap(true);
	}

	private enableExtension(identifier: string, scope: StorageScope): TPromise<boolean> {
		let disabledExtensions = this._getDisabledExtensions(scope);
		const index = disabledExtensions.indexOf(identifier);
		if (index !== -1) {
			disabledExtensions.splice(index, 1);
			this._setDisabledExtensions(disabledExtensions, scope);
		}
		return TPromise.wrap(true);
	}

	private _getDisabledExtensions(scope: StorageScope): string[] {
		const value = this.storageService.get(DISABLED_EXTENSIONS_STORAGE_PATH, scope, '');
		return value ? distinct(value.split(',')) : [];
	}

	private _setDisabledExtensions(disabledExtensions: string[], scope: StorageScope): void {
		if (disabledExtensions.length) {
			this.storageService.store(DISABLED_EXTENSIONS_STORAGE_PATH, disabledExtensions.join(','), scope);
		} else {
			this.storageService.remove(DISABLED_EXTENSIONS_STORAGE_PATH, scope);
		}
	}

	private onDidUninstallExtension({id, error}: DidUninstallExtensionEvent): void {
		if (!error) {
			id = stripVersion(id);
			this.enableExtension(id, StorageScope.WORKSPACE);
			this.enableExtension(id, StorageScope.GLOBAL);
		}
	}

	private scanExtensions(): TPromise<IExtensionDescription[]> {
		const collector = new MessagesCollector();
		const version = pkg.version;
		const builtinExtensions = ExtensionScanner.scanExtensions(version, collector, BUILTIN_EXTENSIONS_PATH, true);
		const userExtensions = this.environmentService.disableExtensions || !this.environmentService.extensionsPath ? TPromise.as([]) : ExtensionScanner.scanExtensions(version, collector, this.environmentService.extensionsPath, false);
		const developedExtensions = this.environmentService.disableExtensions || !this.environmentService.extensionDevelopmentPath ? TPromise.as([]) : ExtensionScanner.scanOneOrMultipleExtensions(version, collector, this.environmentService.extensionDevelopmentPath, false);
		const isDev = !this.environmentService.isBuilt || !!this.environmentService.extensionDevelopmentPath;

		return TPromise.join([builtinExtensions, userExtensions, developedExtensions]).then((extensionDescriptions: IExtensionDescription[][]) => {
			let builtinExtensions = extensionDescriptions[0];
			let userExtensions = extensionDescriptions[1];
			let developedExtensions = extensionDescriptions[2];

			let result: { [extensionId: string]: IExtensionDescription; } = {};
			builtinExtensions.forEach((builtinExtension) => {
				result[builtinExtension.id] = builtinExtension;
			});
			userExtensions.forEach((userExtension) => {
				if (result.hasOwnProperty(userExtension.id)) {
					collector.warn(userExtension.extensionFolderPath, localize('overwritingExtension', "Overwriting extension {0} with {1}.", result[userExtension.id].extensionFolderPath, userExtension.extensionFolderPath));
				}
				result[userExtension.id] = userExtension;
			});
			developedExtensions.forEach(developedExtension => {
				collector.info('', localize('extensionUnderDevelopment', "Loading development extension at {0}", developedExtension.extensionFolderPath));
				if (result.hasOwnProperty(developedExtension.id)) {
					collector.warn(developedExtension.extensionFolderPath, localize('overwritingExtension', "Overwriting extension {0} with {1}.", result[developedExtension.id].extensionFolderPath, developedExtension.extensionFolderPath));
				}
				result[developedExtension.id] = developedExtension;
			});

			return Object.keys(result).map(name => result[name]);
		}).then(null, err => {
			collector.error('', err);
			return [];
		}).then(extensions => {
			collector.getMessages().forEach(entry => this._handleMessage(entry, isDev));
			return extensions;
		});
	}

	private _handleMessage(message: IMessage, isDev: boolean): void {
		let messageShown = false;
		if (message.type === Severity.Error || message.type === Severity.Warning) {
			if (isDev) {
				// Only show nasty intrusive messages if doing extension development.
				this.messageService.show(message.type, (message.source ? '[' + message.source + ']: ' : '') + message.message);
				messageShown = true;
			}
		}
		if (!messageShown) {
			switch (message.type) {
				case Severity.Error:
					console.error(message);
					break;
				case Severity.Warning:
					console.warn(message);
					break;
				default:
					console.log(message);
			}
		}
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}

function stripVersion(id: string): string {
	return id.replace(/-\d+\.\d+\.\d+$/, '');
}