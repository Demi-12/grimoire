"use client";

import { useMemo, useState, type FormEvent } from "react";
import MonsterSheet from "@/components/monster-sheet";
import { translateTerms } from "@/lib/monster-i18n";
import { api, ApiError, type Campaign, type HomebrewMonster } from "@/lib/api-client";
import { challengeRatings, proficiencyBonusFor, xpForChallengeRating, type HomebrewVisibility } from "@/lib/homebrew";
import {
  abilityFields, draftFromMonster, draftToPayload, draftToPreview, emptyDraft, entryKinds, MAX_ENTRIES, senseKinds, sizes, speedKinds,
  type EntryDraft, type HomebrewDraft,
} from "@/lib/homebrew-draft";
import styles from "./homebrew.module.css";

type Locale = "en" | "es";
type Props = {
  locale: Locale;
  /** Campaigns the signed-in user belongs to: the only ones a monster can be shared with. */
  campaigns: Campaign[];
  /** Monster being edited, or null to create one. */
  initial: HomebrewMonster | null;
  /** Name shown as the author in the preview. */
  ownerName: string;
  onSaved: (monster: HomebrewMonster) => void;
  onCancel: () => void;
};

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

export default function HomebrewEditor({ locale, campaigns, initial, ownerName, onSaved, onCancel }: Props) {
  const t = copy[locale];
  const [draft, setDraft] = useState<HomebrewDraft>(() => (initial ? draftFromMonster(initial) : emptyDraft()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = useMemo(() => ({ ...draftToPreview(draft), homebrew: { ownerName } }), [draft, ownerName]);
  const rating = Number(draft.cr);
  const xp = xpForChallengeRating(rating);
  const locked = initial?.locked ?? false;

  const set = <K extends keyof HomebrewDraft>(key: K, value: HomebrewDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setIn = <K extends "speed" | "abilities" | "senses">(group: K, key: keyof HomebrewDraft[K], value: string) =>
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  const setEntries = (kind: (typeof entryKinds)[number], rows: EntryDraft[]) => setDraft((current) => ({ ...current, [kind]: rows }));
  const toggleCampaign = (id: string) => setDraft((current) => ({
    ...current,
    campaignIds: current.campaignIds.includes(id) ? current.campaignIds.filter((item) => item !== id) : [...current.campaignIds, id],
  }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = draftToPayload(draft);
      const { monster } = await api<{ monster: HomebrewMonster }>(initial ? `/api/homebrew/${initial.id}` : "/api/homebrew", { method: initial ? "PUT" : "POST", body });
      onSaved(monster);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const text = (id: string, label: string, value: string, onChange: (value: string) => void, extra: { hint?: string; required?: boolean; max?: number; inputMode?: "numeric"; aria?: string } = {}) =>
    <label key={id} className={styles.field} htmlFor={id}>{label}<input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={extra.required} maxLength={extra.max} inputMode={extra.inputMode} placeholder={extra.hint} aria-label={extra.aria} /></label>;

  return <form className={styles.editor} onSubmit={(event) => void submit(event)} aria-label={initial ? t.editTitle : t.newTitle}>
    <h3 style={{ margin: 0 }}>{initial ? t.editTitle : t.newTitle}</h3>
    <div className={styles.editorGrid}>
      <div className={styles.form}>
        <fieldset className={styles.group}><legend>{t.basics}</legend>
          {text("hb-name", t.name, draft.name, (value) => set("name", value), { required: true, max: 80 })}
          <div className={styles.cols}>
            <label className={styles.field} htmlFor="hb-size">{t.size}
              <select id="hb-size" value={draft.size} onChange={(event) => set("size", event.target.value)}>{sizes.map((size) => <option key={size} value={size}>{translateTerms("size", size, locale)}</option>)}</select></label>
            {text("hb-type", t.type, draft.type, (value) => set("type", value), { hint: t.typeHint, max: 40 })}
            {text("hb-alignment", t.alignment, draft.alignment, (value) => set("alignment", value), { max: 60 })}
          </div>
          <label className={styles.field} htmlFor="hb-cr">{t.cr}
            <select id="hb-cr" value={draft.cr} onChange={(event) => set("cr", event.target.value)}>{challengeRatings.map((value) => <option key={value} value={String(value)}>{ratingLabel(value)}</option>)}</select></label>
          {xp !== null && <p className={styles.hint}>{t.crHint(xp, proficiencyBonusFor(rating))}</p>}
        </fieldset>

        <fieldset className={styles.group}><legend>{t.defense}</legend>
          <div className={styles.cols}>
            {text("hb-ac", t.ac, draft.armorClass, (value) => set("armorClass", value), { inputMode: "numeric", required: true })}
            {text("hb-armor", t.armorType, draft.armorType, (value) => set("armorType", value), { max: 60 })}
            {text("hb-hp", t.hp, draft.hitPoints, (value) => set("hitPoints", value), { inputMode: "numeric", required: true })}
            {text("hb-dice", t.hitDice, draft.hitDice, (value) => set("hitDice", value), { hint: t.hitDiceHint, max: 40 })}
          </div>
          <div className={styles.cols}>
            {text("hb-vuln", t.vulnerabilities, draft.vulnerabilities, (value) => set("vulnerabilities", value))}
            {text("hb-res", t.resistances, draft.resistances, (value) => set("resistances", value))}
            {text("hb-imm", t.immunities, draft.immunities, (value) => set("immunities", value))}
            {text("hb-cond", t.conditionImmunities, draft.conditionImmunities, (value) => set("conditionImmunities", value))}
          </div>
          <p className={styles.hint}>{t.listHint}</p>
        </fieldset>

        <fieldset className={styles.group}><legend>{t.abilities}</legend>
          <div className={styles.abilities}>{abilityFields.map((key) =>
            <label className={styles.field} htmlFor={`hb-${key}`} key={key}>{t.ability[key]}
              <input id={`hb-${key}`} inputMode="numeric" value={draft.abilities[key]} onChange={(event) => setIn("abilities", key, event.target.value)} /></label>)}</div>
        </fieldset>

        <fieldset className={styles.group}><legend>{t.movement}</legend>
          <div className={styles.cols}>{speedKinds.map((key) => text(`hb-speed-${key}`, t.speed[key], draft.speed[key], (value) => setIn("speed", key, value), { max: 20 }))}</div>
          <div className={styles.cols}>
            {senseKinds.map((key) => text(`hb-sense-${key}`, t.sense[key], draft.senses[key], (value) => setIn("senses", key, value), { max: 20 }))}
            {text("hb-passive", t.passive, draft.passivePerception, (value) => set("passivePerception", value), { inputMode: "numeric" })}
          </div>
          {text("hb-languages", t.languages, draft.languages, (value) => set("languages", value), { max: 200 })}
        </fieldset>

        {entryKinds.map((kind) => <fieldset className={styles.group} key={kind}><legend>{t.entries[kind]}</legend>
          {draft[kind].map((row, index) => <div className={styles.entry} key={index}>
            <div className={styles.entryHead}>
              {text(`hb-${kind}-${index}-name`, t.entryName, row.name, (value) => setEntries(kind, draft[kind].map((item, i) => (i === index ? { ...item, name: value } : item))), { max: 80, aria: `${t.entries[kind]} ${index + 1}: ${t.entryName}` })}
              <button type="button" className="button button-quiet" onClick={() => setEntries(kind, draft[kind].filter((_, i) => i !== index))} aria-label={`${t.removeEntry}: ${row.name || t.entries[kind]}`}>{t.removeEntry}</button>
            </div>
            <label className={styles.field} htmlFor={`hb-${kind}-${index}-desc`}>{t.entryDesc}
              <textarea id={`hb-${kind}-${index}-desc`} aria-label={`${t.entries[kind]} ${index + 1}: ${t.entryDesc}`} value={row.desc} maxLength={2000} onChange={(event) => setEntries(kind, draft[kind].map((item, i) => (i === index ? { ...item, desc: event.target.value } : item)))} /></label>
          </div>)}
          {draft[kind].length < MAX_ENTRIES && <div><button type="button" className="button button-quiet" onClick={() => setEntries(kind, [...draft[kind], { name: "", desc: "" }])}>+ {t.addEntry}</button></div>}
        </fieldset>)}

        <fieldset className={styles.group}><legend>{t.sharing}</legend>
          {locked && <p className={styles.notice} role="status">{t.locked}</p>}
          {visibilities.map((value) => {
            const disabled = locked && value !== "private";
            return <label key={value} className={`${styles.radio} ${draft.visibility === value ? styles.radioOn : ""}`} style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
              <input type="radio" name="hb-visibility" value={value} checked={draft.visibility === value} disabled={disabled} onChange={() => set("visibility", value)} />
              <span>{t.visibility[value][0]}<small>{t.visibility[value][1]}</small></span>
            </label>;
          })}
          {draft.visibility === "campaign" && (campaigns.length
            ? <div role="group" aria-label={t.pickCampaigns} style={{ display: "grid", gap: 6 }}>{campaigns.map((campaign) =>
              <label key={campaign.id} className={styles.radio}><input type="checkbox" checked={draft.campaignIds.includes(campaign.id)} onChange={() => toggleCampaign(campaign.id)} /><span>{campaign.name}</span></label>)}</div>
            : <p className={styles.hint}>{t.noCampaigns}</p>)}
        </fieldset>
      </div>

      <aside className={styles.preview} aria-label={t.preview}>
        <h3>{t.preview}</h3>
        <MonsterSheet monster={preview} locale={locale} />
      </aside>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.footer}>
      <button type="button" className="button button-quiet" onClick={onCancel}>{t.cancel}</button>
      <button type="submit" className="button button-primary" disabled={busy}>{busy ? t.saving : `✦ ${t.save}`}</button>
    </div>
  </form>;
}
