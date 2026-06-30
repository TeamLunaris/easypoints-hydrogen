import {createHydrogenContext} from '@shopify/hydrogen';
import {
  createEasyPointsClient,
  type EasyPointsClient,
} from '@lunaris/easypoints-hydrogen/server';
import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

// The easyPoints loyalty client is mounted as `context.loyalty` so loaders/actions can read
// the customer's balance and calculate/redeem points. It holds the Bearer token and is
// server-only (the `@lunaris/easypoints-hydrogen/server` entry guards against browser imports).
interface LoyaltyContext {
  loyalty: EasyPointsClient;
}

declare global {
  // Make `context.loyalty` (and `context.get(...)`) available on the Hydrogen context.
  interface HydrogenAdditionalContext extends LoyaltyContext {}

  // The merchant supplies the easyPoints credentials via these env vars (see `.env.example`).
  interface Env {
    EASY_POINTS_API_TOKEN?: string;
    EASY_POINTS_API_ENDPOINT?: string;
  }

  // Augment HydrogenCustomCartFragment with the codegen'd cart fragment type so
  // that context.cart.get() and all cart mutations return the extended cart type.
  interface HydrogenCustomCartFragment extends CartApiQueryFragment {}
}

/**
 * Creates Hydrogen context for React Router 7.9.x
 * Returns HydrogenRouterContextProvider with hybrid access patterns
 * */
export async function createHydrogenRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const additionalContext: LoyaltyContext = {
    loyalty: createEasyPointsClient({
      cache,
      waitUntil,
      request,
      token: env.EASY_POINTS_API_TOKEN ?? '',
      endpoint: env.EASY_POINTS_API_ENDPOINT,
    }),
  };

  const hydrogenContext = createHydrogenContext(
    {
      env,
      request,
      cache,
      waitUntil,
      session,
      // Or detect from URL path based on locale subpath, cookies, or any other strategy
      i18n: {language: 'EN', country: 'US'},
      cart: {
        queryFragment: CART_QUERY_FRAGMENT,
      },
    },
    additionalContext,
  );

  // Bind the loyalty client to the request's Hydrogen handles so it can query the
  // customer metafield and the storefront for points math.
  hydrogenContext.loyalty.init(hydrogenContext);

  return hydrogenContext;
}
