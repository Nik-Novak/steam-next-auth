# Steam Next Auth

[![npm version](https://badge.fury.io/js/steam-next-auth.svg)](https://badge.fury.io/js/steam-next-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/repository-GitHub-blue)](https://github.com/nik-novak/steam-next-auth)

`steam-next-auth` is a custom provider for NextAuth.js v5 (Auth.js) that allows you to authenticate users using their Steam accounts. It supports the App Router and NextAuth V5 (Auth.js) only. For older versions of NextAuth and pages router implementation check out: https://github.com/Nekonyx/next-auth-steam

## Installation

To install the package, run:

```bash
npm install steam-next-auth
```

## Usage

To use the Steam provider in your NextAuth configuration, follow these steps:

1. Import the provider in your `auth.ts` file:

    ```javascript
    import NextAuth from 'next-auth';
    import SteamProvider from 'steam-next-auth';

    export const { auth, handlers, signIn, signOut } = NextAuth(req=>({
      // ...
      providers: [
        SteamProvider({
          clientSecret: process.env.NEXTAUTH_STEAM_SECRET!,
          callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/fuckoffnextauth`
        }),
        // ...add more providers here
      ],
      // Add any additional NextAuth.js configuration here
    });
    ```

2. Ensure you have `NEXTAUTH_STEAM_SECRET` (I found mine online, just search for steam OpenID 2.0 examples) and `NEXTAUTH_URL` set in your environment variables.
3. Because NextAuth V5 decided to be a ****, there's a strict enforcement on the structure of requests and responses. So we have to *fool* it with a fake endpoint. So insert an api endpoint like this:

```javascript
export type RouteURL = '/api/auth/fuckoffnextauth/[provider]';
type Params = {params:{provider:string}};

export async function GET(req: NextRequest, { params }:Params):Promise<Response>{
  const provider = params.provider;
  const {searchParams} = new URL(req.url);
  searchParams.set('code', '123'); //inject a fake code to make nextauth v5 happy
  return Response.redirect(`${process.env.NEXTAUTH_URL}/api/auth/callback/${provider}?${searchParams.toString()}`); //this should be your normal nextauth callback url
}

export async function POST(req: NextRequest):Promise<Response>{
  return Response.json({token: '123'}); //fake token endpoint
}
//You can hardcode provider to be 'steam'
```

## Example
Check out https://github.com/Nik-Novak/Mind-Knight for a working example. Specifically pay attention to `{root}/auth.ts` and `{root}/src/app/api/auth/fuckoffnextauth/[provider]/route.ts`.
