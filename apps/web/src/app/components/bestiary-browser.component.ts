import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import {
  fetchMonster, fetchMonsterCatalog, formatChallenge, inferMonsterRoles, sourceLabel, type MonsterListEntry, type SourceSummary,
} from "@grimoire/shared/monster-api";
import type { Campaign, CatalogCreature, Me } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { HomebrewPanelComponent } from "./homebrew-panel.component";
import { MonsterSheetComponent } from "./monster-sheet.component";
import { SkeletonComponent, SkeletonRegionComponent, SpinnerComponent } from "./skeleton.component";

const fieldLabel = "grid gap-1.5";
const fieldCaption = "font-label text-xs font-bold tracking-[.12em] text-muted uppercase";
const list = "grid grid-cols-2 gap-2 max-[600px]:grid-cols-1";
const notice = "rounded-card border border-dashed border-control-line px-4 py-5 text-center text-sm text-muted italic";

type Locale = "en" | "es";
type AddCreature = (creature: { id: string; name: string; xp: number; source: string; roleTags: ReturnType<typeof inferMonsterRoles>; monsterSlug: string }) => void;
type BrowserCopy = {
  title: string; subtitle: string; search: string; searchPlaceholder: string; rating: string; allRatings: string; book: string; allBooks: string;
  loading: string; retry: string; errorTitle: string; errorBody: string; count: (count: number) => string; noResults: string;
  select: string; selected: string; add: string; added: string; previous: string; next: string; page: (current: number, total: number) => string;
  ratingLabel: (rating: string) => string;
};
const PAGE_SIZE = 12;
/** Wait this long after the last keystroke before asking the server, so typing "owlbear" is one request, not seven. */
const SEARCH_DEBOUNCE_MS = 250;
const ratings = ["0", "0.125", "0.25", "0.5", ...Array.from({ length: 30 }, (_, index) => String(index + 1))];

const copy = {
  en: {
    title: "The Bestiary", subtitle: "Thousands of creatures from every openly licensed 5e book (the SRD 5.2 and 5.1, Tome of Beasts, Creature Codex, the Level Up Monstrous Menagerie and more), served by Open5e. Names and stat block text are in English.",
    search: "Search creatures", searchPlaceholder: "Try “owlbear” or “dragon”…", rating: "Challenge rating", allRatings: "All ratings", book: "Book", allBooks: "All books",
    loading: "The archivist is opening the bestiary…", retry: "Retry", errorTitle: "The bestiary is out of reach.", errorBody: "Open5e, which serves the creatures, may not be answering right now. Try again in a moment.",
    count: (count: number) => `${count} creatures`, noResults: "No creatures match those runes.", select: "Open stat block", selected: "Selected", add: "Add to encounter list", added: "Added to encounter list",
    previous: "Previous", next: "Next", page: (current: number, total: number) => `Page ${current} of ${total}`,
    ratingLabel: (rating: string) => rating === "0.125" ? "1/8" : rating === "0.25" ? "1/4" : rating === "0.5" ? "1/2" : rating,
  },
  es: {
    title: "El Bestiario", subtitle: "Miles de criaturas de todos los libros de 5e con licencia libre (SRD 5.2 y 5.1, Tome of Beasts, Creature Codex, el Monstrous Menagerie de Level Up y más), servidas por Open5e. Los términos de reglas se traducen, pero los nombres y los textos de rasgos y acciones llegan solo en inglés.",
    search: "Buscar criaturas", searchPlaceholder: "Busca «owlbear» o «dragon»…", rating: "Valor de desafío", allRatings: "Todos", book: "Libro", allBooks: "Todos los libros",
    loading: "El archivero está abriendo el bestiario…", retry: "Reintentar", errorTitle: "El bestiario no está disponible.", errorBody: "Puede que Open5e, que sirve las criaturas, no responda ahora mismo. Vuelve a intentarlo en un momento.",
    count: (count: number) => `${count} criaturas`, noResults: "Ninguna criatura coincide con esos símbolos.", select: "Abrir ficha", selected: "Elegido", add: "Añadir al catálogo de encuentros", added: "Añadido al catálogo de encuentros",
    previous: "Anterior", next: "Siguiente", page: (current: number, total: number) => `Página ${current} de ${total}`,
    ratingLabel: (rating: string) => rating === "0.125" ? "1/8" : rating === "0.25" ? "1/4" : rating === "0.5" ? "1/2" : rating,
  },
} satisfies Record<Locale, BrowserCopy>;

/** The Open5e bestiary: search and filters, one page of creatures, and the stat block of the one picked. */
@Component({
  selector: "app-srd-bestiary",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonsterSheetComponent, SkeletonComponent, SkeletonRegionComponent, SpinnerComponent],
  host: { class: "contents" },
  templateUrl: "./bestiary-browser.component.html",
})
class SrdBestiaryComponent {
  private readonly i18n = inject(I18nService);

  readonly onAddCreature = input<AddCreature>();

  protected readonly t = computed(() => copy[this.i18n.locale()]);
  protected readonly locale = this.i18n.locale;
  protected readonly rating = signal("");
  protected readonly book = signal("");
  protected readonly sources = signal<SourceSummary[]>([]);
  protected readonly query = signal("");
  private readonly search = signal("");
  private readonly catalog = signal<MonsterListEntry[]>([]);
  protected readonly catalogCount = signal(0);
  protected readonly selectedSlug = signal<string | null>(null);
  private readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal("");
  private readonly retryCount = signal(0);
  protected readonly adding = signal(false);
  protected readonly addedSlug = signal("");

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.catalogCount() / PAGE_SIZE)));
  protected readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));
  protected readonly bookName = computed(() => this.sources().find((source) => source.key === this.book())?.name ?? "Open5e");
  /** The page of creatures, with the line under each name worked out once. */
  protected readonly rows = computed(() => this.catalog().map((creature) => ({
    creature,
    meta: [creature.cr !== undefined ? `CR ${formatChallenge(creature.cr)}` : "", creature.source].filter(Boolean).join(" · "),
  })));

  protected readonly fieldLabel = fieldLabel;
  protected readonly fieldCaption = fieldCaption;
  protected readonly list = list;
  protected readonly notice = notice;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly ratings = ratings;
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, index) => index);

  constructor() {
    effect((onCleanup) => {
      const query = this.query();
      const timer = setTimeout(() => this.search.set(query), SEARCH_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });

    effect((onCleanup) => {
      const challengeRating = this.rating();
      const source = this.book();
      const search = this.search();
      const page = this.page();
      this.retryCount();
      untracked(() => {
        const controller = new AbortController();
        this.loading.set(true);
        this.error.set("");
        fetchMonsterCatalog({ challengeRating, source, search, page, limit: PAGE_SIZE }, controller.signal).then((result) => {
          this.catalog.set(result.results);
          this.catalogCount.set(result.count);
          this.sources.set(result.sources);
        }).catch((cause: unknown) => {
          if (!controller.signal.aborted) this.error.set(cause instanceof Error ? cause.message : "Request failed");
        }).finally(() => { if (!controller.signal.aborted) this.loading.set(false); });
        onCleanup(() => controller.abort());
      });
    });
  }

  protected changeQuery(value: string): void {
    this.query.set(value);
    this.page.set(1);
  }

  protected changeRating(value: string): void {
    this.rating.set(value);
    this.page.set(1);
  }

  protected changeBook(value: string): void {
    this.book.set(value);
    this.page.set(1);
  }

  protected retry(): void {
    this.retryCount.update((count) => count + 1);
  }

  protected previousPage(): void {
    this.page.update((current) => Math.max(1, current - 1));
  }

  protected nextPage(): void {
    this.page.update((current) => current + 1);
  }

  protected async add(selectedSlug: string): Promise<void> {
    this.adding.set(true);
    try {
      const monster = await fetchMonster(selectedSlug);
      if (typeof monster.xp === "number" && monster.xp > 0) {
        this.onAddCreature()?.({ id: `srd-${selectedSlug}`, name: monster.name, xp: monster.xp, source: sourceLabel(monster.source), roleTags: inferMonsterRoles(monster), monsterSlug: selectedSlug });
        this.addedSlug.set(selectedSlug);
      }
    } finally { this.adding.set(false); }
  }
}

export type HomebrewProps = {
  me: Pick<Me, "id" | "name" | "role">;
  campaigns: Campaign[];
  onAddCreature: (creature: Omit<CatalogCreature, "id">) => void;
};

const tabLabels = { en: { srd: "Open5e bestiary", homebrew: "Homebrew", label: "Bestiary source" }, es: { srd: "Bestiario Open5e", homebrew: "Homebrew", label: "Origen del bestiario" } };

/** The SRD bestiary, plus a Homebrew tab when the caller can supply the signed-in user. */
@Component({
  selector: "app-bestiary-browser",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomebrewPanelComponent, SrdBestiaryComponent],
  host: { class: "contents" },
  template: `
    @if (homebrew(); as homebrew) {
      <div class="tabs" role="group" [attr.aria-label]="labels().label">
        <button type="button" [attr.aria-pressed]="tab() === 'srd'" (click)="tab.set('srd')">{{ labels().srd }}</button>
        <button type="button" [attr.aria-pressed]="tab() === 'homebrew'" (click)="tab.set('homebrew')">{{ labels().homebrew }}</button>
      </div>
      @if (tab() === "srd") {
        <app-srd-bestiary [onAddCreature]="onAddCreature()" />
      } @else {
        <app-homebrew-panel [me]="homebrew.me" [campaigns]="homebrew.campaigns" [onAddCreature]="homebrew.onAddCreature" />
      }
    } @else {
      <app-srd-bestiary [onAddCreature]="onAddCreature()" />
    }
  `,
})
export class BestiaryBrowserComponent {
  private readonly i18n = inject(I18nService);

  readonly onAddCreature = input<AddCreature>();
  readonly homebrew = input<HomebrewProps>();

  protected readonly tab = signal<"srd" | "homebrew">("srd");
  protected readonly labels = computed(() => tabLabels[this.i18n.locale()]);
}
