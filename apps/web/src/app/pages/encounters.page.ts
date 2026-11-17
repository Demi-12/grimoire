import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import type { Creature } from "@grimoire/shared/rules";
import { EncounterBuilderComponent } from "../components/encounter-builder.component";
import { PageHeaderComponent } from "../components/page-header.component";
import { I18nService } from "../core/i18n.service";
import { ToolkitStore } from "../core/toolkit.store";

/** `/encounters`: the encounter builder, with the person's own creature catalog in a panel underneath. */
@Component({
  selector: "app-encounters-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncounterBuilderComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    <header appPageHeader [kicker]="t('encounters.kicker')" [title]="t('encounters.title')" [description]="t('encounters.description')" actions>
      <button type="button" class="button button-quiet" [attr.aria-expanded]="store.showCatalog()" (click)="store.showCatalog.set(!store.showCatalog())">
        {{ store.showCatalog() ? t("encounters.closeCatalog") : t("encounters.catalog", { count: store.ownCreatures().length }) }}
      </button>
    </header>
    <app-encounter-builder [creatures]="store.creatures()" [characters]="store.characters()" [campaigns]="store.campaigns()" />
    @if (store.catalogError()) { <p class="import-message" role="alert">{{ t("catalog.error." + store.catalogError()) }}</p> }
    @if (store.showCatalog()) {
      <section class="catalog-panel">
        <div class="catalog-heading"><div><p class="eyebrow">{{ t("catalog.kicker") }}</p><h2>{{ t("catalog.title") }}</h2><p>{{ t("catalog.description") }}</p></div></div>
        <form class="creature-form" (submit)="addCreature($event)">
          <label>{{ t("catalog.name") }}<input #name required maxlength="60" [value]="creatureName()" (input)="creatureName.set(name.value)" [placeholder]="t('catalog.namePlaceholder')" /></label>
          <label>{{ t("catalog.xp") }}<input #xp type="number" min="1" max="100000" [value]="creatureXp()" (input)="creatureXp.set(+xp.value)" /></label>
          <button class="button button-primary" type="submit">{{ t("catalog.add") }}</button>
        </form>
        <div class="catalog-list">
          @for (creature of store.creatures(); track creature.id) {
            <div class="catalog-row">
              <span aria-hidden="true">✦</span>
              <b>{{ creature.source === "Ejemplo editable" ? t("creature.sample." + creature.xp + ".name") : creature.name }}</b>
              <small>{{ creature.source === "Ejemplo editable" ? t("creature.sample.source") : creature.source === "Catálogo propio" ? t("catalog.customSource") : creature.source }}</small>
              <strong>{{ formatXp(creature) }} XP</strong>
              @if (creature.source === "Catálogo propio") { <button class="small-action danger-action" (click)="store.removeCreature(creature)">{{ t("catalog.remove") }}</button> }
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class EncountersPage {
  protected readonly store = inject(ToolkitStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly creatureName = signal("");
  protected readonly creatureXp = signal(100);

  protected formatXp(creature: Creature): string {
    return creature.xp.toLocaleString(this.i18n.locale() === "es" ? "es-ES" : "en-US");
  }

  protected async addCreature(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.creatureName().trim();
    if (!name || this.creatureXp() < 1) return;
    if (await this.store.saveCreature({ name, xp: this.creatureXp(), source: "Catálogo propio" })) this.creatureName.set("");
  }
}
