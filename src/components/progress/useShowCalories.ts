'use client'

import * as React from 'react'
import { readShowCalories, writeShowCalories } from '@/lib/progress/caloriesPref'

/**
 * Preferencia "Mostrar calorías estimadas". Arranca apagada y se lee del
 * dispositivo tras montar (así el render del servidor y el del cliente coinciden).
 */
export function useShowCalories(): [boolean, (value: boolean) => void] {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    setShow(readShowCalories())
  }, [])

  const update = React.useCallback((value: boolean) => {
    setShow(value)
    writeShowCalories(value)
  }, [])

  return [show, update]
}
