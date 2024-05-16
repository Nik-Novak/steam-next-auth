
import { SteamProfile, SteamProviderOptions } from '../src/types/steam';
import { NextRequest } from 'next/server';
import { NextApiRequest } from 'next';
import { OAuthConfig } from 'next-auth/providers';
declare module 'steam-next-auth' {
  export default function SteamProvider(req: Request | NextRequest | NextApiRequest, options: SteamProviderOptions): OAuthConfig<SteamProfile>;
}