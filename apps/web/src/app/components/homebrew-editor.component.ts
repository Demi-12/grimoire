import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from "@angular/core";
import { challengeRatings, proficiencyBonusFor, xpForChallengeRating, type HomebrewVisibility } from "@grimoire/shared/homebrew";
import {
  abilityFields, draftFromMonster, draftToPayload, draftToPreview, emptyDraft, entryKinds, MAX_ENTRIES, senseKinds, sizes, speedKinds,
  type HomebrewDraft,
} from "@grimoire/shared/homebrew-draft";
import { translateTerms, type VocabularyKind } from "@grimoire/shared/monster-i18n";
import { api, ApiError, type Campaign, type HomebrewMonster } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { MonsterSheetComponent } from "./monster-sheet.component";

const copy = {
  en: {
    newTitle: "New homebrew monster", editTitle: "Edit homebrew monster", save: "Save monster", saving: "Saving…", cancel: "Cancel",
    basics: "Basics", name: "Name", size: "Size", type: "Type", typeHint: "beast, dragon, undead…", alignment: "Alignment", cr: "Challenge rating",
    crHint: (xp: number, bonus: number) => `${xp.toLocaleString("en")} XP · proficiency bonus +${bonus}. Both come from the rating.`,
    defense: "Defense", ac: "Armor class", armorType: "Armor type", hp: "Hit points", hitDice: "Hit dice", hitDiceHint: "e.g. 7d8+21",
    movement: "Movement and senses", speed: { walk: "Walk", fly: "Fly", swim: "Swim", climb: "Climb", burrow: "Burrow" },
    sense: { darkvision: "Darkvision", blindsight: "Blindsight", tremorsense: "Tremorsense", truesight: "Truesight" },
    passive: "Passive Perception", languages: "Languages",
    abilities: "Ability scores", ability: { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" },
    resistances: "Damage resistances", immunities: "Damage immunities", vulnerabilities: "Damage vulnerabilities", conditionImmunities: "Condition immunities",
    listHint: "Separate with commas.",
    entries: { traits: "Traits", actions: "Actions", reactions: "Reactions", legendary: "Legendary actions" },
    entryName: "Name", entryDesc: "Description", addEntry: "Add", removeEntry: "Remove",
    sharing: "Who can see it", preview: "Preview",
    visibility: {
      private: ["Only me", "Nobody else can find it."],
      campaign: ["Some of my campaigns", "Members of the campaigns you pick."],
      instance: ["Everyone on this server", "Every signed-in account can use it."],
    },
    pickCampaigns: "Campaigns", noCampaigns: "You are not in any campaign yet.",
    locked: "An admin locked this monster, so it can only be private until they unlock it.",
    errorGeneric: "Could not save the monster.",
  },
  es: {
    newTitle: "Nuevo monstruo homebrew", editTitle: "Editar monstruo homebrew", save: "Guardar monstruo", saving: "Guardando…", cancel: "Cancelar",
    basics: "Datos básicos", name: "Nombre", size: "Tamaño", type: "Tipo", typeHint: "bestia, dragón, no muerto…", alignment: "Alineamiento", cr: "Valor de desafío",
    crHint: (xp: number, bonus: number) => `${xp.toLocaleString("es")} XP · bonificador de competencia +${bonus}. Ambos salen del valor de desafío.`,
    defense: "Defensa", ac: "Clase de armadura", armorType: "Tipo de armadura", hp: "Puntos de golpe", hitDice: "Dados de golpe", hitDiceHint: "p. ej. 7d8+21",
    movement: "Movimiento y sentidos", speed: { walk: "Caminar", fly: "Volar", swim: "Nadar", climb: "Trepar", burrow: "Excavar" },
    sense: { darkvision: "Visión en la oscuridad", blindsight: "Vista ciega", tremorsense: "Sentido de la vibración", truesight: "Visión verdadera" },
    passive: "Percepción pasiva", languages: "Idiomas",
    abilities: "Características", ability: { strength: "FUE", dexterity: "DES", constitution: "CON", intelligence: "INT", wisdom: "SAB", charisma: "CAR" },
    resistances: "Resistencias al daño", immunities: "Inmunidades al daño", vulnerabilities: "Vulnerabilidades al daño", conditionImmunities: "Inmunidades a estados",
    listHint: "Separa con comas.",
    entries: { traits: "Rasgos", actions: "Acciones", reactions: "Reacciones", legendary: "Acciones legendarias" },
    entryName: "Nombre", entryDesc: "Descripción", addEntry: "Añadir", removeEntry: "Quitar",
    sharing: "Quién puede verlo", preview: "Vista previa",
    visibility: {
      private: ["Solo yo", "Nadie más puede encontrarlo."],
      campaign: ["Algunas de mis campañas", "Los miembros de las campañas que elijas."],
      instance: ["Todos en este servidor", "Cualquier cuenta con sesión puede usarlo."],
    },
    pickCampaigns: "Campañas", noCampaigns: "Todavía no estás en ninguna campaña.",
    locked: "Un admin ha bloqueado este monstruo, así que solo puede ser privado hasta que lo desbloquee.",
    errorGeneric: "No se ha podido guardar el monstruo.",
  },
} as const;

const ratingLabel = (value: number) => (value === 0.125 ? "1/8" : value === 0.25 ? "1/4" : value === 0.5 ? "1/2" : String(value));
const visibilities: HomebrewVisibility[] = ["private", "campaign", "instance"];

type EntryKind = (typeof entryKinds)[number];

/** The homebrew monster form (create or edit), with a live preview of the stat block beside it. */
@Component({
  selector: "app-homebrew-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonsterSheetComponent],
  styleUrl: "./homebrew.component.css",
  host: { class: "contents" },
  templateUrl: "./homebrew-editor.component.html",
})
export class HomebrewEditorComponent implements OnInit {
  private readonly i18n = inject(I18nService);

  /** Campaigns the signed-in user belongs to: the only ones a monster can be shared with. */
  readonly campaigns = input.required<Campaign[]>();
  /** Monster being edited, or null to create one. */
  readonly initial = input.required<HomebrewMonster | null>();
  /** Name shown as the author in the preview. */
  readonly ownerName = input.required<string>();
  readonly onSaved = input.required<(monster: HomebrewMonster) => void>();
  readonly onCancel = input.required<() => void>();

  protected readonly t = computed(() => copy[this.i18n.locale()]);
  protected readonly draft = signal<HomebrewDraft>(emptyDraft());
  protected readonly busy = signal(false);
  protected readonly error = signal("");
  protected readonly preview = computed(() => ({ ...draftToPreview(this.draft()), homebrew: { ownerName: this.ownerName() } }));
  /** The XP and proficiency line under the rating, when the rating is a real one. */
  protected readonly crHint = computed(() => {
    const rating = Number(this.draft().cr);
    const xp = xpForChallengeRating(rating);
    return xp !== null ? this.t().crHint(xp, proficiencyBonusFor(rating)) : null;
  });
  protected readonly locked = computed(() => this.initial()?.locked ?? false);

  protected readonly sizes = sizes;
  protected readonly challengeRatings = challengeRatings;
  protected readonly abilityFields = abilityFields;
  protected readonly speedKinds = speedKinds;
  protected readonly senseKinds = senseKinds;
  protected readonly entryKinds = entryKinds;
  protected readonly visibilities = visibilities;
  protected readonly maxEntries = MAX_ENTRIES;
  protected readonly ratingLabel = ratingLabel;

  /** The form starts from the monster being edited once, when it opens; later input changes do not reset it. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) this.draft.set(draftFromMonster(initial));
  }

  protected term(kind: VocabularyKind, text: string): string {
    return translateTerms(kind, text, this.i18n.locale());
  }

  protected set<K extends keyof HomebrewDraft>(key: K, value: HomebrewDraft[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected setIn<K extends "speed" | "abilities" | "senses">(group: K, key: keyof HomebrewDraft[K], value: string): void {
    this.draft.update((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  protected setEntry(kind: EntryKind, index: number, field: "name" | "desc", value: string): void {
    this.draft.update((current) => ({ ...current, [kind]: current[kind].map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  }

  protected removeEntry(kind: EntryKind, index: number): void {
    this.draft.update((current) => ({ ...current, [kind]: current[kind].filter((_, i) => i !== index) }));
  }

  protected addEntry(kind: EntryKind): void {
    this.draft.update((current) => ({ ...current, [kind]: [...current[kind], { name: "", desc: "" }] }));
  }

  protected toggleCampaign(id: string): void {
    this.draft.update((current) => ({
      ...current,
      campaignIds: current.campaignIds.includes(id) ? current.campaignIds.filter((item) => item !== id) : [...current.campaignIds, id],
    }));
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set("");
    try {
      const initial = this.initial();
      const body = draftToPayload(this.draft());
      const { monster } = await api<{ monster: HomebrewMonster }>(initial ? `/api/homebrew/${initial.id}` : "/api/homebrew", { method: initial ? "PUT" : "POST", body });
      this.onSaved()(monster);
    } catch (cause) {
      this.error.set(cause instanceof ApiError ? cause.message : this.t().errorGeneric);
    } finally {
      this.busy.set(false);
    }
  }
}
