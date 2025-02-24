import type { Cookies, RequestEvent, ServerLoad, ServerLoadEvent } from '@sveltejs/kit';
import { redirect as redir } from '@sveltejs/kit';
import { parse } from './cookie-es-main/index.js';

//const d = console.debug;

const cookieName = 'flash';
const httpOnly = false;
const path = '/';
const maxAge = 120;

/////////////////////////////////////////////////////////////////////

export function loadFlashMessage<S extends ServerLoad, E extends ServerLoadEvent>(cb: S) {
  return async (event: E) => {
    const flash = loadFlash(event).flash;
    const loadFunction = await cb(event);
    return { flash, ...loadFunction } as ReturnType<S>;
  };
}

export function loadFlash<T extends ServerLoadEvent>(
  event: T
): { flash: App.PageData['flash'] | undefined } {
  //d('=== loadFlash: ' + event.route.id + ' ===');

  const header = event.request.headers.get('cookie') || '';
  if (!header.includes(cookieName + '=')) {
    //d('No flash cookie found.');
    return { [cookieName]: undefined };
  }

  const cookies = parse(header) as Record<string, string>;
  const dataString = cookies[cookieName];

  let data = undefined;

  if (dataString) {
    // Detect if event is XMLHttpRequest, basically by checking if the browser
    // is honoring the sec-fetch-dest header, or accepting json.
    // event.isDataRequest is also used.
    const setFetchDest = event.request.headers.get('sec-fetch-dest');
    const accept = event.request.headers.get('accept');

    if (
      event.isDataRequest ||
      setFetchDest == 'empty' ||
      accept == '*/*' ||
      accept?.includes('application/json')
    ) {
      //d('Possible fetch request, keeping cookie for client.');
    } else {
      //d('Flash cookie found, clearing');
      event.cookies.delete(cookieName, { path });
    }

    try {
      data = JSON.parse(dataString);
    } catch (e) {
      // Ignore data if parsing error
    }

    //d('Setting flash message: ', data);
  }

  return {
    [cookieName]: data
  };
}

export const load = loadFlash;

/////////////////////////////////////////////////////////////////////

type RedirectStatus = Parameters<typeof redir>[0];

export function redirect(status: RedirectStatus, location: string | URL): ReturnType<typeof redir>;

export function redirect(
  message: App.PageData['flash'],
  event: RequestEvent
): ReturnType<typeof redir>;

export function redirect(
  location: string | URL,
  message: App.PageData['flash'],
  event: RequestEvent
): ReturnType<typeof redir>;

export function redirect(
  status: RedirectStatus,
  location: string | URL,
  message: App.PageData['flash'],
  event: RequestEvent
): ReturnType<typeof redir>;

export function redirect(
  status: unknown,
  location: unknown,
  message?: unknown,
  event?: RequestEvent
): ReturnType<typeof redir> {
  switch (arguments.length) {
    case 2:
      if (typeof status === 'number') {
        return realRedirect(status as RedirectStatus, `${location}`);
      } else {
        const message = status as App.PageData['flash'];
        const event = location as RequestEvent;
        // Remove the named action, if it exists
        const redirectUrl = new URL(event.url);
        for (const [key] of redirectUrl.searchParams) {
          if (key.startsWith('/')) {
            redirectUrl.searchParams.delete(key);
          }
          break;
        }
        return realRedirect(303, redirectUrl, message, event);
      }

    case 3:
      return realRedirect(
        303,
        status as string | URL,
        location as App.PageData['flash'],
        message as RequestEvent
      );

    case 4:
      return realRedirect(
        status as RedirectStatus,
        location as string | URL,
        message as App.PageData['flash'],
        event
      );

    default:
      throw new Error('Invalid redirect arguments');
  }
}

function realRedirect(
  status: RedirectStatus,
  location: string | URL,
  message?: App.PageData['flash'],
  event?: RequestEvent
) {
  if (!message) return redir(status, location.toString());
  if (!event) throw new Error('RequestEvent is required for redirecting with flash message');

  event.cookies.set(cookieName, JSON.stringify(message), { httpOnly, path, maxAge });
  return redir(status, location.toString());
}

export function setFlash(message: App.PageData['flash'], event: RequestEvent | Cookies) {
  const cookies = 'cookies' in event ? event.cookies : event;
  cookies.set(cookieName, JSON.stringify(message), { httpOnly, path, maxAge });
}
