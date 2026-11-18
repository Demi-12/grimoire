import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { Router } from "@angular/router";
import { CharacterBuilderComponent } from "../components/character-builder.component";
import { PageHeaderComponent } from "../components/page-header.component";
import { I18nService } from "../core/i18n.service";
import { ToolkitStore } from "../core/toolkit.store";

/**
 * `/characters`, `/characters/new` and `/characters/<id>`: one page for the three addresses (see the
 * matcher in app.routes.ts), so the list, the creator and an open sheet share one CharacterBuilder
 * and nothing is torn down when the address changes between them.
 */
@Component({
  selector: "app-characters-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CharacterBuilderComponent, PageHeaderComponent],
  host: { class: "contents" },
  template: `
    <!-- With a sheet open the character's name is the visible heading; keep the page title for screen readers only. -->
    <header appPageHeader [hidden]="selectedId() !== null" [kicker]="t('characters.kicker')" [title]="t('characters.title')" titleId="characters-title" [description]="t('characters.description')"></header>
    <app-character-builder [characters]="store.ownCharacters()" [allCharacters]="store.characters()" [campaigns]="store.memberCampaigns()"
      [onSave]="store.saveCharacter" [onDelete]="store.deleteCharacter" [selectedId]="selectedId()" [onSelect]="select"
      [startCreating]="creating()" [onCreatingStarted]="creatingStarted" />
    <p class="local-data-note">{{ t("characters.localData") }}</p>
  `,
})
export class CharactersPage {
  protected readonly store = inject(ToolkitStore);
  protected readonly t = inject(I18nService).t;
  private readonly router = inject(Router);

  /** From the route: "new", a character id, or nothing for the list. */
  readonly id = input<string>();

  /** `/characters/new` opens the step-by-step creator. */
  protected readonly creating = computed(() => this.id() === "new");
  /** `/characters/<id>`: that character's full sheet is open. */
  protected readonly selectedId = computed(() => { const id = this.id(); return id && id !== "new" ? id : null; });

  protected readonly select = (id: string | null): void => {
    void this.router.navigateByUrl(id ? `/characters/${encodeURIComponent(id)}` : "/characters");
  };

  /** The creator is open: put the list's address back (replacing), so Back leaves the page. */
  protected readonly creatingStarted = (): void => {
    void this.router.navigateByUrl("/characters", { replaceUrl: true });
  };
}
