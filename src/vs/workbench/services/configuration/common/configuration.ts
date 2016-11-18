/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService, IConfigurationValue, IConfigurationKeys } from 'vs/platform/configuration/common/configuration';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const CONFIG_DEFAULT_NAME = 'settings';
export const WORKSPACE_CONFIG_FOLDER_DEFAULT_NAME = '.vscode';
export const WORKSPACE_CONFIG_DEFAULT_PATH = `${WORKSPACE_CONFIG_FOLDER_DEFAULT_NAME}/${CONFIG_DEFAULT_NAME}.json`;

export const IWorkspaceConfigurationService = createDecorator<IWorkspaceConfigurationService>('configurationService');

export interface IWorkspaceConfigurationService extends IConfigurationService {

	/**
	 * Returns iff the workspace has configuration or not.
	 */
	hasWorkspaceConfiguration(): boolean;

	/**
	 * Override for the IConfigurationService#lookup() method that adds information about workspace settings.
	 */
	lookup<T>(key: string): IWorkspaceConfigurationValue<T>;

	/**
	 * Override for the IConfigurationService#keys() method that adds information about workspace settings.
	 */
	keys(): IWorkspaceConfigurationKeys;
}

export interface IWorkspaceConfigurationValue<T> extends IConfigurationValue<T> {
	workspace: T;
}

export interface IWorkspaceConfigurationKeys extends IConfigurationKeys {
	workspace: string[];
}

export const WORKSPACE_STANDALONE_CONFIGURATIONS = {
	'tasks': `${WORKSPACE_CONFIG_FOLDER_DEFAULT_NAME}/tasks.json`,
	'launch': `${WORKSPACE_CONFIG_FOLDER_DEFAULT_NAME}/launch.json`
};

export type IWorkspaceConfiguration = { [key: string]: IWorkspaceConfigurationValue<any> }

export function getEntries(configurationService: IWorkspaceConfigurationService): IWorkspaceConfiguration {

	const result: IWorkspaceConfiguration = Object.create(null);
	const keyset = configurationService.keys();
	const keys = [...keyset.workspace, ...keyset.user, ...keyset.default].sort();
	let lastKey: string;
	for (const key of keys) {
		if (key !== lastKey) {
			lastKey = key;
			const config = configurationService.lookup(key);
			result[key] = config;
		}
	}

	return result;
}
