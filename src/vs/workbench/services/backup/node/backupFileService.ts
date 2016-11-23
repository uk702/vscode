/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as crypto from 'crypto';
import pfs = require('vs/base/node/pfs');
import Uri from 'vs/base/common/uri';
import { IBackupFileService, BACKUP_FILE_UPDATE_OPTIONS } from 'vs/workbench/services/backup/common/backup';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService } from 'vs/platform/files/common/files';
import { TPromise } from 'vs/base/common/winjs.base';

export interface IBackupFilesModel {
	resolve(backupRoot: string): TPromise<IBackupFilesModel>;

	add(resource: Uri, versionId?: number): void;
	has(resource: Uri, versionId?: number): boolean;
	remove(resource: Uri): void;
	clear(): void;
}

// TODO@daniel this should resolve the backups with their file names once we have the metadata in place
export class BackupFilesModel implements IBackupFilesModel {
	private cache: { [resource: string]: number /* version ID */ } = Object.create(null);

	public resolve(backupRoot: string): TPromise<IBackupFilesModel> {
		return pfs.readDirsInDir(backupRoot).then(backupSchemas => {

			// For all supported schemas
			return TPromise.join(backupSchemas.map(backupSchema => {

				// Read backup directory for backups
				const backupSchemaPath = path.join(backupRoot, backupSchema);
				return pfs.readdir(backupSchemaPath).then(backupHashes => {

					// Remember known backups in our caches
					backupHashes.forEach(backupHash => {
						const backupResource = Uri.file(path.join(backupSchemaPath, backupHash));
						this.add(backupResource);
					});
				});
			}));
		}).then(() => this, error => this);
	}

	public add(resource: Uri, versionId = 0): void {
		this.cache[resource.toString()] = versionId;
	}

	public has(resource: Uri, versionId?: number): boolean {
		const cachedVersionId = this.cache[resource.toString()];
		if (typeof cachedVersionId !== 'number') {
			return false; // unknown resource
		}

		if (typeof versionId === 'number') {
			return versionId === cachedVersionId; // if we are asked with a specific version ID, make sure to test for it
		}

		return true;
	}

	public remove(resource: Uri): void {
		delete this.cache[resource.toString()];
	}

	public clear(): void {
		this.cache = Object.create(null);
	}
}

export class BackupFileService implements IBackupFileService {

	public _serviceBrand: any;

	protected backupHome: string;
	protected workspacesJsonPath: string;

	private backupWorkspacePath: string;
	private ready: TPromise<IBackupFilesModel>;

	constructor(
		private currentWorkspace: Uri,
		@IEnvironmentService private environmentService: IEnvironmentService,
		@IFileService private fileService: IFileService
	) {
		this.backupHome = environmentService.backupHome;
		this.workspacesJsonPath = environmentService.backupWorkspacesPath;

		if (this.currentWorkspace) {
			const workspaceHash = crypto.createHash('md5').update(this.currentWorkspace.fsPath).digest('hex');
			this.backupWorkspacePath = path.join(this.backupHome, workspaceHash);
		}

		this.ready = this.init();
	}

	private get backupEnabled(): boolean {
		return this.currentWorkspace && !this.environmentService.isExtensionDevelopment; // Hot exit is disabled for empty workspaces and when doing extension development
	}

	private init(): TPromise<IBackupFilesModel> {
		const model = new BackupFilesModel();

		if (!this.backupEnabled) {
			return TPromise.as(model);
		}

		return model.resolve(this.backupWorkspacePath);
	}

	public hasBackup(resource: Uri): TPromise<boolean> {
		return this.ready.then(model => {
			const backupResource = this.getBackupResource(resource);
			if (!backupResource) {
				return TPromise.as(false);
			}

			return model.has(backupResource);
		});
	}

	public loadBackupResource(resource: Uri): TPromise<Uri> {
		return this.ready.then(() => {
			return this.hasBackup(resource).then(hasBackup => {
				if (hasBackup) {
					return this.getBackupResource(resource);
				}

				return void 0;
			});
		});
	}

	public backupResource(resource: Uri, content: string, versionId?: number): TPromise<void> {
		return this.ready.then(model => {
			const backupResource = this.getBackupResource(resource);
			if (!backupResource) {
				return void 0;
			}

			if (model.has(backupResource, versionId)) {
				return void 0; // return early if backup version id matches requested one
			}

			return this.fileService.updateContent(backupResource, content, BACKUP_FILE_UPDATE_OPTIONS).then(() => model.add(backupResource, versionId));
		});
	}

	public discardResourceBackup(resource: Uri): TPromise<void> {
		return this.ready.then(model => {
			const backupResource = this.getBackupResource(resource);
			if (!backupResource) {
				return void 0;
			}

			return this.fileService.del(backupResource).then(() => model.remove(backupResource));
		});
	}

	public discardAllWorkspaceBackups(): TPromise<void> {
		return this.ready.then(model => {
			if (!this.backupEnabled) {
				return void 0;
			}

			return this.fileService.del(Uri.file(this.backupWorkspacePath)).then(() => model.clear());
		});
	}

	protected getBackupResource(resource: Uri): Uri {
		if (!this.backupEnabled) {
			return null;
		}

		// Only hash the file path if the file is not untitled
		const backupName = resource.scheme === 'untitled' ? resource.fsPath : crypto.createHash('md5').update(resource.fsPath).digest('hex');
		const backupPath = path.join(this.backupWorkspacePath, resource.scheme, backupName);

		return Uri.file(backupPath);
	}
}