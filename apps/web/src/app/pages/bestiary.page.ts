import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { BestiaryBrowserComponent } from "../components/bestiary-browser.component";
import { PageHeaderComponent } from "../components/page-header.component";
import type { CatalogCreature } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { ToolkitStore } from "../core/toolkit.store";

/** `/bestiary`: the Open5e bestiary and the homebrew monsters, both able to add to the person's catalog. */
@Component({
  selector: "app-bestiary-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BestiaryBrowserComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    <header appPageHeader [kicker]="t('bestiary.kicker')" [title]="t('bestiary.title')" [description]="t('bestiary.description')"></header>
    <app-bestiary-browser [homebrew]="homebrew()" [onAddCreature]="addFromBestiary" />
  `,
})
export class BestiaryPage {
  private readonly store = inject(ToolkitStore);
  protected readonly t = inject(I18nService).t;

  protected readonly homebrew = computed(() => ({ me: this.store.me()!, campaigns: this.store.campaigns(), onAddCreature: this.addHomebrew }));

  private readonly addHomebrew = (creature: Omit<CatalogCreature, "id">): void => {
    void this.store.saveCreature(creature);
  };

  protected readonly addFromBestiary = (creature: Omit<CatalogCreature, "id">): void => {
    void this.store.saveCreature({ name: creature.name, xp: creature.xp, source: creature.source, monsterSlug: creature.monsterSlug, roleTags: creature.roleTags });
  };
}
