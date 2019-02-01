import * as AlvaUtil from '@meetalva/util';
import * as _ from 'lodash';
import * as Mobx from 'mobx';
import { PatternLibrary } from '../pattern-library';
import * as PatternProperty from '../pattern-property';
import { PatternSlot } from './pattern-slot';
import * as Types from '@meetalva/types';
import * as uuid from 'uuid';
import { PatternPropertyType } from '@meetalva/types';
import { merge } from 'lodash';

export interface PatternInit {
	contextId: string;
	description: string;
	exportName: string;
	group: string;
	id?: string;
	icon: string;
	name: string;
	propertyIds: string[];
	slots: PatternSlot[];
	type: Types.PatternType;
}

export interface PatternContext {
	patternLibrary: PatternLibrary;
}

export class Pattern {
	public readonly model = Types.ModelName.Pattern;

	@Mobx.observable private contextId: string;
	@Mobx.observable private description: string;
	@Mobx.observable private exportName: string;
	@Mobx.observable private group: string;
	@Mobx.observable private icon: string;
	@Mobx.observable private id: string;
	@Mobx.observable private name: string;
	private patternLibrary: PatternLibrary;
	@Mobx.observable private propertyIds: Set<string> = new Set();
	@Mobx.observable private slots: Map<string, PatternSlot> = new Map();
	@Mobx.observable private type: Types.PatternType;

	public static Defaults(): PatternInit {
		return {
			contextId: 'context-id',
			description: '',
			exportName: 'pattern',
			group: '',
			icon: '',
			name: 'pattern',
			propertyIds: [],
			type: Types.PatternType.Pattern,
			slots: []
		};
	}

	public constructor(init: PatternInit, context: PatternContext) {
		this.contextId = init.contextId;
		this.description = init.description;
		this.exportName = init.exportName;
		this.group = init.group;
		this.icon = init.icon;
		this.id = init.id || uuid.v4();
		this.name = AlvaUtil.guessName(init.name);
		this.patternLibrary = context.patternLibrary;
		this.propertyIds = new Set(init.propertyIds || []);
		this.type = init.type;

		init.slots.forEach(slot => this.slots.set(slot.getId(), slot));
	}

	public static from(serialized: Types.SerializedPattern, context: PatternContext): Pattern {
		return new Pattern(
			{
				contextId: serialized.contextId,
				description: serialized.description,
				exportName: serialized.exportName,
				group: serialized.group,
				icon: serialized.icon,
				id: serialized.id,
				name: serialized.name,
				propertyIds: serialized.propertyIds,
				slots: serialized.slots.map(slot => PatternSlot.from(slot)),
				type: deserializeType(serialized.type)
			},
			context
		);
	}

	public static fromDefaults(overrides: Partial<PatternInit>, context: PatternContext): Pattern {
		return new Pattern(merge({}, Pattern.Defaults(), overrides), context);
	}

	public addProperty(property: PatternProperty.AnyPatternProperty): void {
		this.propertyIds.add(property.getId());
	}

	public addSlot(slot: PatternSlot): void {
		this.slots.set(slot.getId(), slot);
	}

	public equals(b: Pattern): boolean {
		return _.isEqual(this.toJSON(), b.toJSON());
	}

	public getContextId(): string {
		return this.contextId;
	}

	public getDescription(): string {
		return this.description;
	}

	public getExportName(): string {
		return this.exportName;
	}

	public getGroup(): string {
		return this.group;
	}

	public getIcon(): string {
		return this.icon;
	}

	public getId(): string {
		return this.id;
	}

	public getName(): string {
		return this.name;
	}

	public getPatternLibrary(): PatternLibrary {
		return this.patternLibrary;
	}

	public getProperties(): PatternProperty.AnyPatternProperty[] {
		if (!this.patternLibrary) {
			return [];
		}

		return this.getPropertyIds()
			.map(propertyId => this.patternLibrary.getPatternPropertyById(propertyId))
			.filter((p): p is PatternProperty.AnyPatternProperty => typeof p !== 'undefined');
	}

	public getPropertyById(id: string): PatternProperty.AnyPatternProperty | undefined {
		return this.getProperties().find(p => p.getId() === id);
	}

	public getPropertyByContextId(
		contextId: string
	): PatternProperty.AnyPatternProperty | undefined {
		return this.getProperties().find(p => p.getContextId() === contextId);
	}

	public getPropertyIds(): string[] {
		return [...this.propertyIds];
	}

	public getSlots(): PatternSlot[] {
		return [...this.slots.values()];
	}

	public getSlotByContextId(contextId: string): PatternSlot | undefined {
		return this.getSlots().find(slot => slot.getContextId() === contextId);
	}

	public getSlotById(contextId: string): PatternSlot | undefined {
		return this.getSlots().find(slot => slot.getContextId() === contextId);
	}

	public getType(): Types.PatternType {
		return this.type;
	}

	public removeProperty(property: PatternProperty.AnyPatternProperty): void {
		this.propertyIds.delete(property.getId());
	}

	public removeSlot(slot: PatternSlot): void {
		this.slots.delete(slot.getId());
	}

	public toJSON(): Types.SerializedPattern {
		return {
			model: this.model,
			contextId: this.contextId,
			description: this.description,
			exportName: this.exportName,
			group: this.group,
			icon: this.icon,
			id: this.id,
			name: this.name,
			propertyIds: Array.from(this.propertyIds),
			slots: this.getSlots().map(slot => slot.toJSON()),
			type: serializeType(this.type)
		};
	}

	@Mobx.action
	public update(pattern: Pattern, context?: PatternContext): void {
		this.contextId = pattern.getContextId();
		this.description = pattern.getDescription();
		this.exportName = pattern.getExportName();
		this.group = pattern.getGroup();
		this.name = pattern.getName();
		this.icon = pattern.getIcon();
		this.patternLibrary = context ? context.patternLibrary : this.patternLibrary;
		this.propertyIds = pattern.propertyIds;
		this.type = pattern.getType();

		const slotChanges = AlvaUtil.computeDifference<PatternSlot>({
			before: this.getSlots(),
			after: pattern.getSlots()
		});

		slotChanges.added.forEach(change => this.addSlot(change.after));
		slotChanges.changed.forEach(change => change.before.update(change.after));
		slotChanges.removed.forEach(change => this.removeSlot(change.before));
	}
}

function deserializeType(input: Types.SerializedPatternType): Types.PatternType {
	switch (input) {
		case 'synthetic:page':
			return Types.PatternType.SyntheticPage;
		case 'synthetic:box':
			return Types.PatternType.SyntheticBox;
		case 'synthetic:image':
			return Types.PatternType.SyntheticImage;
		case 'synthetic:text':
			return Types.PatternType.SyntheticText;
		case 'synthetic:link':
			return Types.PatternType.SyntheticLink;
		case 'synthetic:conditional':
			return Types.PatternType.SyntheticConditional;
		case 'pattern':
			return Types.PatternType.Pattern;
	}
	throw new Error(`Unknown pattern type: ${input}`);
}

function serializeType(input: Types.PatternType): Types.SerializedPatternType {
	switch (input) {
		case Types.PatternType.SyntheticPage:
			return 'synthetic:page';
		case Types.PatternType.SyntheticBox:
			return 'synthetic:box';
		case Types.PatternType.SyntheticImage:
			return 'synthetic:image';
		case Types.PatternType.SyntheticConditional:
			return 'synthetic:conditional';
		case Types.PatternType.SyntheticText:
			return 'synthetic:text';
		case Types.PatternType.SyntheticLink:
			return 'synthetic:link';
		case Types.PatternType.Pattern:
			return 'pattern';
	}
	throw new Error(`Unknown pattern type: ${input}`);
}
