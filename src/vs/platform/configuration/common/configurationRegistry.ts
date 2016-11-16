/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import Event, { Emitter } from 'vs/base/common/event';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/platform';
import objects = require('vs/base/common/objects');
import types = require('vs/base/common/types');
import { ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';

export const Extensions = {
	Configuration: 'base.contributions.configuration'
};

export interface IConfigurationRegistry {

	/**
	 * Register a configuration to the registry.
	 */
	registerConfiguration(configuration: IConfigurationNode): void;

	/**
	 * Register multiple configurations to the registry.
	 */
	registerConfigurations(configurations: IConfigurationNode[]): void;

	/**
	 * Event that fires whenver a configuratio has been
	 * registered.
	 */
	onDidRegisterConfiguration: Event<IConfigurationRegistry>;

	/**
	 * Returns all configuration nodes contributed to this registry.
	 */
	getConfigurations(): IConfigurationNode[];

	/**
	 * Returns all configurations settings of all configuration nodes contributed to this registry.
	 */
	getConfigurationProperties(): { [qualifiedKey: string]: IJSONSchema };

}

export interface IConfigurationNode {
	id?: string;
	order?: number;
	type?: string | string[];
	title?: string;
	description?: string;
	properties?: { [path: string]: IJSONSchema; };
	allOf?: IConfigurationNode[];
}

const schemaId = 'vscode://schemas/settings';
const contributionRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);

class ConfigurationRegistry implements IConfigurationRegistry {
	private configurationContributors: IConfigurationNode[];
	private configurationProperties: { [qualifiedKey: string]: IJSONSchema };
	private configurationSchema: IJSONSchema;
	private _onDidRegisterConfiguration: Emitter<IConfigurationRegistry>;

	constructor() {
		this.configurationContributors = [];
		this.configurationSchema = { allOf: [] };
		this._onDidRegisterConfiguration = new Emitter<IConfigurationRegistry>();
		this.configurationProperties = {};

		contributionRegistry.registerSchema(schemaId, this.configurationSchema);
	}

	public get onDidRegisterConfiguration() {
		return this._onDidRegisterConfiguration.event;
	}

	public registerConfiguration(configuration: IConfigurationNode): void {
		this.registerConfigurations([configuration]);
	}

	public registerConfigurations(configurations: IConfigurationNode[]): void {
		configurations.forEach(configuration => {
			this.registerProperties(configuration); // fills in defaults
			this.configurationContributors.push(configuration);
			this.registerJSONConfiguration(configuration);
		});

		this._onDidRegisterConfiguration.fire(this);
	}

	private registerProperties(configuration: IConfigurationNode) {
		let properties = configuration.properties;
		if (properties) {
			for (let key in properties) {
				// fill in default values
				let property = properties[key];
				let defaultValue = property.default;
				if (types.isUndefined(defaultValue)) {
					property.default = getDefaultValue(property.type);
				}
				// add to properties map
				this.configurationProperties[key] = properties[key];
			}
		}
		let subNodes = configuration.allOf;
		if (subNodes) {
			for (let node of subNodes) {
				this.registerProperties(node);
			}
		}
	}

	getConfigurations(): IConfigurationNode[] {
		return this.configurationContributors;
	}

	getConfigurationProperties(): { [qualifiedKey: string]: IJSONSchema } {
		return this.configurationProperties;
	}

	private registerJSONConfiguration(configuration: IConfigurationNode) {
		const schema = <IJSONSchema>objects.clone(configuration);
		this.configurationSchema.allOf.push(schema);
		contributionRegistry.registerSchema(schemaId, this.configurationSchema);
	}
}

function getDefaultValue(type: string | string[]): any {
	const t = Array.isArray(type) ? (<string[]>type)[0] : <string>type;
	switch (t) {
		case 'boolean':
			return false;
		case 'integer':
		case 'number':
			return 0;
		case 'string':
			return '';
		case 'array':
			return [];
		case 'object':
			return {};
		default:
			return null;
	}
}


const configurationRegistry = new ConfigurationRegistry();
Registry.add(Extensions.Configuration, configurationRegistry);

const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint<IConfigurationNode>('configuration', [], {
	description: nls.localize('vscode.extension.contributes.configuration', 'Contributes configuration settings.'),
	type: 'object',
	defaultSnippets: [{ body: { title: '', properties: {} } }],
	properties: {
		title: {
			description: nls.localize('vscode.extension.contributes.configuration.title', 'A summary of the settings. This label will be used in the settings file as separating comment.'),
			type: 'string'
		},
		properties: {
			description: nls.localize('vscode.extension.contributes.configuration.properties', 'Description of the configuration properties.'),
			type: 'object',
			additionalProperties: {
				$ref: 'http://json-schema.org/draft-04/schema#'
			}
		}
	}
});

configurationExtPoint.setHandler(extensions => {
	const configurations: IConfigurationNode[] = [];

	for (let i = 0; i < extensions.length; i++) {
		const configuration = <IConfigurationNode>extensions[i].value;
		const collector = extensions[i].collector;

		if (configuration.type && configuration.type !== 'object') {
			collector.warn(nls.localize('invalid.type', "if set, 'configuration.type' must be set to 'object"));
		} else {
			configuration.type = 'object';
		}

		if (configuration.title && (typeof configuration.title !== 'string')) {
			collector.error(nls.localize('invalid.title', "'configuration.title' must be a string"));
		}

		if (configuration.properties && (typeof configuration.properties !== 'object')) {
			collector.error(nls.localize('invalid.properties', "'configuration.properties' must be an object"));
			return;
		}

		const clonedConfiguration = objects.clone(configuration);
		clonedConfiguration.id = extensions[i].description.id;
		configurations.push(clonedConfiguration);
	}

	configurationRegistry.registerConfigurations(configurations);
});