'use client'

interface Booking {
  id: string
  studentId: string
  tutorId?: string
  lessonType: 'online' | 'atTutor' | 'travel'
  start: Date | string
  end: Date | string
}

interface AvailabilitySlot {
  start: Date | string
  end: Date | string
}

interface Tutor {
  id: string
  availability?: AvailabilitySlot[]
  bookings?: Booking[]
  travelBufferBefore?: number
  travelBufferAfter?: number
  travelBufferBeforePerStudent?: Record<string, number>
  travelBufferAfterPerStudent?: Record<string, number>
  onlineBufferBefore?: number
  onlineBufferAfter?: number
  tutorPlaceBufferBefore?: number
  tutorPlaceBufferAfter?: number
}

export const generateAvailableSlots = (
  tutor: Tutor,
  lessonType: 'online' | 'atTutor' | 'travel',
  studentId?: string
): { start: Date; end: Date }[] => {
  const slots: { start: Date; end: Date }[] = []
  const availability = tutor.availability || []

  availability.forEach(slot => {
    const baseStart = new Date(slot.start)
    const baseEnd = new Date(slot.end)

    let bufferBefore = 0
    let bufferAfter = 0

    if (lessonType === 'travel' && studentId) {
      bufferBefore = Math.max(
        tutor.travelBufferBefore || 0,
        tutor.travelBufferBeforePerStudent?.[studentId] || 0
      )
      bufferAfter = Math.max(
        tutor.travelBufferAfter || 0,
        tutor.travelBufferAfterPerStudent?.[studentId] || 0
      )
    } else if (lessonType === 'online') {
      bufferBefore = tutor.onlineBufferBefore || 0
      bufferAfter = tutor.onlineBufferAfter || 0
    } else if (lessonType === 'atTutor') {
      bufferBefore = tutor.tutorPlaceBufferBefore || 0
      bufferAfter = tutor.tutorPlaceBufferAfter || 0
    }

    // **Przesuwamy start i end slotu zgodnie z buforami**
    const adjustedStart = new Date(baseStart.getTime() + bufferBefore * 60000)
    const adjustedEnd = new Date(baseEnd.getTime() - bufferAfter * 60000)
    if (adjustedStart >= adjustedEnd) return

    // Sprawdzenie konfliktów z istniejącymi rezerwacjami
    const hasConflict = tutor.bookings?.some(b => {
      const bookingStart = new Date(b.start)
      const bookingEnd = new Date(b.end)

      let bookingBufferAfter = 0
      if (b.lessonType === 'travel' && b.studentId) {
        bookingBufferAfter = Math.max(
          tutor.travelBufferAfter || 0,
          tutor.travelBufferAfterPerStudent?.[b.studentId] || 0
        )
      } else if (b.lessonType === 'online') {
        bookingBufferAfter = tutor.onlineBufferAfter || 0
      } else if (b.lessonType === 'atTutor') {
        bookingBufferAfter = tutor.tutorPlaceBufferAfter || 0
      }

      const bookingEndWithBuffer = new Date(bookingEnd.getTime() + bookingBufferAfter * 60000)
      return adjustedStart < bookingEndWithBuffer && adjustedEnd > bookingStart
    })

    if (!hasConflict) {
      slots.push({ start: adjustedStart, end: adjustedEnd })
    }
  })

  return slots
}