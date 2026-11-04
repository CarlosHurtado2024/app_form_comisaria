import { createContext, useContext } from 'react'
import type { FieldValue, FormData } from '../form/types'

export interface FormApi {
  data: FormData
  set: (key: string, value: FieldValue) => void
}

export const FormContext = createContext<FormApi | null>(null)

export function useForm(): FormApi {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('useForm debe usarse dentro de FormContext')
  return ctx
}
