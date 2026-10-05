export type AccountAddress = { id: number; label: string; line1: string; city: string; postal_code: string }

export type AccountAddressForm = { label: string; line1: string; city: string; postalCode: string; instructions: string }

export type VoucherValidationResult = { valid?: boolean; balance?: number; message?: string }
