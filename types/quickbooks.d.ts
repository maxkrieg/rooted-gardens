// Minimal ambient types for `intuit-oauth` and `node-quickbooks` — neither ships
// official TypeScript types. Only the members actually called by lib/quickbooks/*
// are declared here (confirmed against the installed packages' JS source), kept
// in sync as later tasks (5.3, 5.4) add more QBO API calls.

declare module 'intuit-oauth' {
  interface OAuthClientConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
  }

  interface AuthResponseJson {
    token_type: string
    access_token: string
    expires_in: number
    refresh_token: string
    x_refresh_token_expires_in: number
  }

  interface AuthResponse {
    getJson(): AuthResponseJson
  }

  class OAuthClient {
    constructor(config: OAuthClientConfig)
    static scopes: { Accounting: string }
    token: { realmId?: string }
    authorizeUri(params: { scope: string[]; state: string }): string
    createToken(uri: string): Promise<AuthResponse>
    refreshUsingToken(refreshToken: string): Promise<AuthResponse>
  }

  export = OAuthClient
}

declare module 'node-quickbooks' {
  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      token: string,
      tokenSecret: false,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: number | null,
      oauthVersion: '2.0',
      refreshToken: string,
    )
  }

  export = QuickBooks
}
