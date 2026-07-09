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
  interface QboAddr {
    Address?: string
  }
  interface QboPhone {
    FreeFormNumber?: string
  }
  interface QboBillAddr {
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string // QBO's field name for US state
    PostalCode?: string
  }
  interface QboCustomer {
    Id: string
    SyncToken: string
    DisplayName: string
    CompanyName?: string
    PrimaryEmailAddr?: QboAddr
    PrimaryPhone?: QboPhone
    BillAddr?: QboBillAddr
  }
  interface QboCreateCustomerInput {
    DisplayName: string
    PrimaryEmailAddr?: QboAddr
    PrimaryPhone?: QboPhone
    BillAddr?: QboBillAddr
  }
  interface QboUpdateCustomerInput {
    Id: string
    SyncToken: string
    DisplayName: string
    PrimaryEmailAddr?: QboAddr
    PrimaryPhone?: QboPhone
    BillAddr?: QboBillAddr
    sparse?: boolean
  }
  /** QBO's "Fault" error shape — surfaces two ways depending on whether the
   *  library's HTTP layer caught a non-2xx (axios-wrapped, `.response.data.Fault`)
   *  or received a 200 with a Fault body anyway (raw `.Fault`). */
  interface QboFaultError {
    Message?: string
    code?: string
  }
  interface QboFaultBody {
    Fault?: { Error?: QboFaultError[]; type?: string }
  }
  interface QboApiError extends QboFaultBody {
    response?: { data?: QboFaultBody }
  }
  interface QboLine {
    DetailType: 'SalesItemLineDetail'
    Amount: number
    Description?: string
    SalesItemLineDetail: { ItemRef: { value: string } }
  }
  interface QboCreateInvoiceInput {
    CustomerRef: { value: string }
    Line: QboLine[]
  }
  interface QboInvoice {
    Id: string
    SyncToken: string
    DocNumber?: string
  }
  interface QboItem {
    Id: string
    Name: string
  }
  interface QboItemQueryResponse {
    QueryResponse: { Item?: QboItem[] }
  }

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
    createCustomer(
      customer: QboCreateCustomerInput,
      callback: (err: QboApiError | null, result: QboCustomer) => void,
    ): void
    getCustomer(
      id: string,
      callback: (err: QboApiError | null, result: QboCustomer) => void,
    ): void
    updateCustomer(
      customer: QboUpdateCustomerInput,
      callback: (err: QboApiError | null, result: QboCustomer) => void,
    ): void
    createInvoice(
      invoice: QboCreateInvoiceInput,
      callback: (err: QboApiError | null, result: QboInvoice) => void,
    ): void
    findItems(
      criteria: Record<string, string>,
      callback: (err: QboApiError | null, result: QboItemQueryResponse) => void,
    ): void
  }

  export = QuickBooks
}
