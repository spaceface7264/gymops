import { useState } from 'react'

/**
 * Whether somebody has typed or picked anything in a form yet. The list of
 * what a form still needs (`MissingRequirements`) is information for a form
 * in progress, not a greeting: an untouched form keeps its button disabled
 * and says nothing until the first keystroke (P7M-07).
 */
export function useFormTouched() {
  const [touched, setTouched] = useState(false)
  const touch = () => setTouched(true)
  return { touched, formProps: { onInput: touch, onChange: touch } }
}
