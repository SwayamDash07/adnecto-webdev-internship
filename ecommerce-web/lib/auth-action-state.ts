export type AuthActionState = {
  formError?: string
  fieldErrors?: { email?: string; password?: string }
  destination?: string
}

export const initialAuthActionState: AuthActionState = {}
