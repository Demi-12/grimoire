/**
 * The bestiary the controllers serve: the Open5e catalog (monster-upstream.ts fetches and caches it),
 * searched and paged here, and single stat blocks.
 */
import { Injectable } from "@nestjs/common";
import { fetchMonsterCatalog, fetchMonsterDetail, type CompactMonster } from "./monster-upstream.js";

export interface MonsterSearch {
  /** Challenge rating to keep; undefined for any. */
  rating: number | undefined;
  /** Book key to keep; empty for any. */
  source: string;
  /** Lower-cased text the name must contain; empty for any. */
  search: string;
  page: number;
  limit: number;
}

@Injectable()
export class MonstersService {
  /** Lower-cased names, worked out once per catalog build instead of on every search request. */
  private readonly searchNames = new WeakMap<CompactMonster[], string[]>();

  private namesFor(monsters: CompactMonster[]): string[] {
    let names = this.searchNames.get(monsters);
    if (!names) this.searchNames.set(monsters, names = monsters.map((monster) => monster.name.toLocaleLowerCase("en-US")));
    return names;
  }

  /** One page of the catalog entries that match, with the total and the books to filter by. */
  async search({ rating, source, search, page, limit }: MonsterSearch) {
    const { monsters, sources } = await fetchMonsterCatalog();
    const names = this.namesFor(monsters);
    const matches = monsters.filter((monster, index) => (rating === undefined || monster.cr === rating)
      && (!source || monster.sourceKey === source)
      && (!search || names[index].includes(search)));
    const results = matches.slice((page - 1) * limit, page * limit)
      .map(({ index, name, cr, type, source: book }) => ({ index, name, cr, type, source: book }));
    return { count: matches.length, sources, results };
  }

  /** The whole compact catalog, for the encounter builder. */
  catalog() {
    return fetchMonsterCatalog();
  }

  /** One stat block by Open5e key or old slug; null when Open5e doesn't know it. */
  detail(slug: string) {
    return fetchMonsterDetail(slug);
  }
}
