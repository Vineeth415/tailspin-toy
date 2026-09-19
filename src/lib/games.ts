import { asc, eq } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    categoryDescription: categories.description,
    publisherId: publishers.id,
    publisherName: publishers.name,
    publisherDescription: publishers.description,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    categoryDescription: string | null;
    publisherId: number | null;
    publisherName: string | null;
    publisherDescription: string | null;
};

export type GameSort = 'title-asc' | 'title-desc' | 'rating-desc' | 'rating-asc';

export interface GameQueryOptions {
    search?: string;
    categoryIds?: number[];
    publisherIds?: number[];
    sort?: GameSort;
    limit?: number;
    offset?: number;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName, description: row.categoryDescription ?? null }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName, description: row.publisherDescription ?? null }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function compareGames(a: Game, b: Game, sort: GameSort): number {
    switch (sort) {
        case 'title-desc':
            return b.title.localeCompare(a.title);
        case 'rating-desc': {
            const aRating = a.starRating ?? Number.NEGATIVE_INFINITY;
            const bRating = b.starRating ?? Number.NEGATIVE_INFINITY;
            return bRating - aRating;
        }
        case 'rating-asc': {
            const aRating = a.starRating ?? Number.POSITIVE_INFINITY;
            const bRating = b.starRating ?? Number.POSITIVE_INFINITY;
            return aRating - bRating;
        }
        case 'title-asc':
        default:
            return a.title.localeCompare(b.title);
    }
}

/** Return games with optional search, filter, sort, and pagination applied. */
export async function getGames(db: Database, options: GameQueryOptions = {}): Promise<Game[]> {
    const search = options.search?.trim().toLowerCase() ?? '';
    const categoryIds = options.categoryIds ?? [];
    const publisherIds = options.publisherIds ?? [];
    const sort = options.sort ?? 'title-asc';

    const allGames = (await baseGamesQuery(db).orderBy(asc(games.title))).map(mapGame);
    const filtered = allGames.filter((game) => {
        const matchesSearch =
            search.length === 0 || game.title.toLowerCase().includes(search);
        const matchesCategory =
            categoryIds.length === 0 || (game.category ? categoryIds.includes(game.category.id) : false);
        const matchesPublisher =
            publisherIds.length === 0 || (game.publisher ? publisherIds.includes(game.publisher.id) : false);

        return matchesSearch && matchesCategory && matchesPublisher;
    });

    filtered.sort((left, right) => compareGames(left, right, sort));

    const offset = Math.max(options.offset ?? 0, 0);
    if (options.limit !== undefined && options.limit >= 0) {
        return filtered.slice(offset, offset + options.limit);
    }

    return filtered.slice(offset);
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getGames(db, { sort: 'title-asc' });
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/** Return every publisher in name order. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select().from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
    }));
}

/** Return the publisher record or null when it does not exist. */
export async function getPublisherById(db: Database, id: number): Promise<Publisher | null> {
    const row = await db.select().from(publishers).where(eq(publishers.id, id)).limit(1);
    if (row.length === 0) {
        return null;
    }
    return { id: row[0].id, name: row[0].name, description: row[0].description ?? null };
}

/** Return every category in name order. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select().from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
    }));
}

/** Return one category, or null when it does not exist. */
export async function getCategoryById(db: Database, id: number): Promise<Category | null> {
    const row = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (row.length === 0) {
        return null;
    }
    return { id: row[0].id, name: row[0].name, description: row[0].description ?? null };
}

/** Return all games for a given publisher in title order. */
export async function getGamesByPublisher(db: Database, publisherId: number): Promise<Game[]> {
    return getGames(db, { publisherIds: [publisherId], sort: 'title-asc' });
}

/** Return all games for a given category in title order. */
export async function getGamesByCategory(db: Database, categoryId: number): Promise<Game[]> {
    return getGames(db, { categoryIds: [categoryId], sort: 'title-asc' });
}

/** Compute the catalog totals and average star rating across rated games. */
export async function getCatalogSummary(db: Database): Promise<{
    totalGames: number;
    ratedGames: number;
    averageRating: number | null;
}> {
    const allGames = await getAllGames(db);
    const ratedGames = allGames.filter((game) => typeof game.starRating === 'number' && game.starRating !== null);
    const totalRating = ratedGames.reduce((sum, game) => sum + (game.starRating ?? 0), 0);
    const averageRating = ratedGames.length > 0 ? Number((totalRating / ratedGames.length).toFixed(1)) : null;

    return {
        totalGames: allGames.length,
        ratedGames: ratedGames.length,
        averageRating,
    };
}
