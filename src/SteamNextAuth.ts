import { randomUUID } from "crypto"
import { NextApiRequest } from "next"
import { OAuthConfig } from "next-auth/providers"
import { NextRequest } from "next/server"
import { RelyingParty } from 'openid'
import { SteamProfile, SteamProviderOptions } from "./types/steam"
import { AUTHORIZATION_URL, EMAIL_DOMAIN, LOGO_URL, PROVIDER_ID, PROVIDER_NAME } from "./constants/steam"


export default function SteamProvider(
  req: Request | NextRequest | NextApiRequest,
  options: SteamProviderOptions
): OAuthConfig<SteamProfile> {
  if (!options.clientSecret || options.clientSecret.length < 1)
    throw new Error('You have forgot to set your Steam API Key in the `clientSecret` option. Please visit https://steamcommunity.com/dev/apikey to get one.')
  
  const callbackUrl = new URL(options.callbackUrl)
  const realm = callbackUrl.origin
  const returnTo = `${callbackUrl.href}/${PROVIDER_ID}`
  
  return {
    clientId: PROVIDER_ID,
    clientSecret: options.clientSecret,
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    type: 'oauth',
    style: {
      logo: LOGO_URL,
      bg: '#000',
      text: '#fff',
    },
    checks: ['none'],
    authorization: {
      url: AUTHORIZATION_URL,
      params: {
        'openid.mode': 'checkid_setup',
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.return_to': returnTo,
        'openid.realm': realm
      }
    },
    token: {
      url: `${callbackUrl}/steam`,
      async conform() {
        console.log('RUN token');
        if (!req.url) {
          throw new Error('No URL found in request object')
        }

        const identifier = await verifyAssertion(req, realm, returnTo)

        if (!identifier) {
          throw new Error('Unauthenticated')
        }
        return Response.json({
          // id_token: randomUUID(),
          access_token: randomUUID(),
          steamId: identifier,
          token_type: 'Bearer'
        })
      }
    },
    
    userinfo: {
      url: `${callbackUrl}/steam`,
      async request(ctx:any) {
        const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002')

        url.searchParams.set('key', ctx.provider.clientSecret as string)
        url.searchParams.set('steamids', ctx.tokens.steamId as string)

        const response = await fetch(url)
        const data = await response.json()
        return data.response.players[0]
      }
    },
    profile(profile: SteamProfile) {
      // next.js can't serialize the session if email is missing or null, so I specify user ID
      return {
        id: profile.steamid,
        image: profile.avatarfull,
        email: `${profile.steamid}@${EMAIL_DOMAIN}`,
        name: profile.personaname
      }
    }
  }
}

/**
 * Verifies an assertion and returns the claimed identifier if authenticated, otherwise null.
 */
async function verifyAssertion(
  req: Request | NextRequest | NextApiRequest,
  realm: string,
  returnTo: string
): Promise<string | null> {
  // Here and from here on out, much of the validation will be related to this PR: https://github.com/liamcurry/passport-steam/pull/120.
  // And accordingly copy the logic from this library: https://github.com/liamcurry/passport-steam/blob/dcebba52d02ce2a12c7d27481490c4ee0bd1ae38/lib/passport-steam/strategy.js#L93
  const IDENTIFIER_PATTERN = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/
  const OPENID_CHECK = {
    ns: 'http://specs.openid.net/auth/2.0',
    claimed_id: 'https://steamcommunity.com/openid/id/',
    identity: 'https://steamcommunity.com/openid/id/'
  }

  // We need to create a new URL object to parse the query string
  // req.url in next@14 is an absolute url, but not in next@13, so example.com used as a base url
  const url = new URL(req.url!, 'https://example.com')
  const query = Object.fromEntries(url.searchParams.entries())

  if (query['openid.op_endpoint'] !== AUTHORIZATION_URL || query['openid.ns'] !== OPENID_CHECK.ns) {
    return null
  }

  if (!query['openid.claimed_id']?.startsWith(OPENID_CHECK.claimed_id)) {
    return null
  }

  if (!query['openid.identity']?.startsWith(OPENID_CHECK.identity)) {
    return null
  }

  const relyingParty = new RelyingParty(returnTo, realm, true, false, [])

  const assertion: {
    authenticated: boolean
    claimedIdentifier?: string | undefined
  } = await new Promise((resolve, reject) => {
    relyingParty.verifyAssertion(req, (error, result) => {
      if (error) {
        reject(error)
      }

      resolve(result!)
    })
  })

  if (!assertion.authenticated || !assertion.claimedIdentifier) {
    return null
  }

  const match = assertion.claimedIdentifier.match(IDENTIFIER_PATTERN)

  if (!match) {
    return null
  }

  return match[1]
}