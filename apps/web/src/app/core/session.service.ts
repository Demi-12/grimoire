import { computed, Injectable, signal } from "@angular/core";
import { authClient } from "./auth-client";

type SessionState = ReturnType<typeof authClient.useSession.get>;

/**
 * The better-auth session as signals. `authClient.useSession` is a store that fetches /api/auth/get-session
 * on first use and again after sign-in, sign-out, 2FA and when the tab regains focus; this mirrors it.
 */
@Injectable({ providedIn: "root" })
export class SessionService {
  private readonly state = signal<SessionState>(authClient.useSession.get());

  /** `{ user, session }` when signed in, otherwise null. */
  readonly data = computed(() => this.state().data);
  /** True while a check is in flight. It goes true again on every refetch, not only the first. */
  readonly isPending = computed(() => this.state().isPending);
  readonly accountId = computed(() => this.state().data?.user.id);

  constructor() {
    // Lives as long as the app, so the subscription is never torn down.
    authClient.useSession.subscribe((value) => this.state.set(value));
  }
}
