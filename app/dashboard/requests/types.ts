export interface Request {
  id: string
  type: 'HOUSEHOLD_UPDATE' | 'ADD_PERSON' | 'REMOVE_PERSON' | 'CULTURAL_CENTER_BOOKING'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  description: string
  data: string | null
  user: {
    id: string
    name: string
    email: string
  }
  household: {
    id: string
    householdId: string
    address: string
  } | null
  createdAt: string
  updatedAt: string
}
