/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService } from 'vs/platform/storage/common/storage';

export const ITelemetryService = createDecorator<ITelemetryService>('telemetryService');

export interface ITelemetryInfo {
	sessionId: string;
	machineId: string;
	instanceId: string;
}

export interface ITelemetryExperiments {
	showCommandsWatermark: boolean;
}

export interface ITelemetryService {

	_serviceBrand: any;

	/**
	 * Sends a telemetry event that has been privacy approved.
	 * Do not call this unless you have been given approval.
	 */
	publicLog(eventName: string, data?: any): TPromise<void>;

	getTelemetryInfo(): TPromise<ITelemetryInfo>;

	isOptedIn: boolean;

	getExperiments(): ITelemetryExperiments;
}

export const defaultExperiments: ITelemetryExperiments = {
	showCommandsWatermark: false,
};

export const NullTelemetryService = {
	_serviceBrand: undefined,
	_experiments: defaultExperiments,
	publicLog(eventName: string, data?: any) {
		return TPromise.as<void>(null);
	},
	isOptedIn: true,
	getTelemetryInfo(): TPromise<ITelemetryInfo> {
		return TPromise.as({
			instanceId: 'someValue.instanceId',
			sessionId: 'someValue.sessionId',
			machineId: 'someValue.machineId'
		});
	},
	getExperiments(): ITelemetryExperiments {
		return this._experiments;
	}
};

export function loadExperiments(storageService: IStorageService, configurationService: IConfigurationService): ITelemetryExperiments {
	const key = 'experiments.randomness';
	let valueString = storageService.get(key);
	if (!valueString) {
		valueString = Math.random().toString();
		storageService.store(key, valueString);
	}
	const value = parseFloat(valueString);
	return applyOverrides(configurationService, {
		showCommandsWatermark: value < 0.5
	});
}

export function applyOverrides(configurationService: IConfigurationService, experiments: ITelemetryExperiments): ITelemetryExperiments {
	const config: any = configurationService.getConfiguration('telemetry');
	const experimentsConfig = config && config.experiments || {};
	Object.keys(experiments).forEach(key => {
		if (key in experimentsConfig) {
			experiments[key] = experimentsConfig[key];
		}
	});
	return experiments;
}

export interface ITelemetryAppender {
	log(eventName: string, data: any): void;
}

export function combinedAppender(...appenders: ITelemetryAppender[]): ITelemetryAppender {
	return { log: (e, d) => appenders.forEach(a => a.log(e, d)) };
}

export const NullAppender: ITelemetryAppender = { log: () => null };

// --- util

export function anonymize(input: string): string {
	if (!input) {
		return input;
	}

	let r = '';
	for (let i = 0; i < input.length; i++) {
		let ch = input[i];
		if (ch >= '0' && ch <= '9') {
			r += '0';
			continue;
		}
		if (ch >= 'a' && ch <= 'z') {
			r += 'a';
			continue;
		}
		if (ch >= 'A' && ch <= 'Z') {
			r += 'A';
			continue;
		}
		r += ch;
	}
	return r;
}