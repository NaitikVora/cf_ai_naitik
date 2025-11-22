import { DurableObject } from 'cloudflare:workers';

export interface ReviewEntry {
  id: string;
  timestamp: number;
  code: string;
  language: string;
  review: string;
  context?: string;
}

export interface SessionState {
  reviews: ReviewEntry[];
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * ReviewSession Durable Object
 * Manages state and history for code review sessions
 */
export class ReviewSession extends DurableObject {
  private state: SessionState;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = {
      reviews: [],
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
  }

  /**
   * Initialize state from storage or create new
   */
  async initialize() {
    const stored = await this.ctx.storage.get<SessionState>('state');
    if (stored) {
      this.state = stored;
      this.state.lastAccessedAt = Date.now();
    }
  }

  /**
   * Add a new review to the session
   */
  async addReview(code: string, language: string, review: string, context?: string): Promise<ReviewEntry> {
    await this.initialize();

    const entry: ReviewEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      code,
      language,
      review,
      context,
    };

    this.state.reviews.push(entry);
    this.state.lastAccessedAt = Date.now();

    await this.ctx.storage.put('state', this.state);

    return entry;
  }

  /**
   * Get all reviews in this session
   */
  async getReviews(): Promise<ReviewEntry[]> {
    await this.initialize();
    this.state.lastAccessedAt = Date.now();
    await this.ctx.storage.put('state', this.state);
    return this.state.reviews;
  }

  /**
   * Get a specific review by ID
   */
  async getReview(id: string): Promise<ReviewEntry | null> {
    await this.initialize();
    const review = this.state.reviews.find((r) => r.id === id);
    return review || null;
  }

  /**
   * Get the latest review
   */
  async getLatestReview(): Promise<ReviewEntry | null> {
    await this.initialize();
    if (this.state.reviews.length === 0) return null;
    return this.state.reviews[this.state.reviews.length - 1];
  }

  /**
   * Get session metadata
   */
  async getMetadata() {
    await this.initialize();
    return {
      reviewCount: this.state.reviews.length,
      createdAt: this.state.createdAt,
      lastAccessedAt: this.state.lastAccessedAt,
    };
  }

  /**
   * Clear all reviews in this session
   */
  async clearReviews() {
    this.state.reviews = [];
    this.state.lastAccessedAt = Date.now();
    await this.ctx.storage.put('state', this.state);
  }

  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/reviews':
          if (request.method === 'GET') {
            const reviews = await this.getReviews();
            return Response.json({ reviews });
          }
          break;

        case '/add-review':
          if (request.method === 'POST') {
            const body = await request.json<{ code: string; language: string; review: string; context?: string }>();
            const entry = await this.addReview(body.code, body.language, body.review, body.context);
            return Response.json(entry);
          }
          break;

        case '/metadata':
          if (request.method === 'GET') {
            const metadata = await this.getMetadata();
            return Response.json(metadata);
          }
          break;

        case '/clear':
          if (request.method === 'POST') {
            await this.clearReviews();
            return Response.json({ success: true });
          }
          break;
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(`Error: ${error}`, { status: 500 });
    }
  }
}
