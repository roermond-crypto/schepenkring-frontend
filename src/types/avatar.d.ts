export type SubscriptionPlan = "small" | "medium" | "big"

export interface Avatar {
  id: string
  name: string
  role: string
  description: string
  functions: string[]
  image: string
  required_plan: SubscriptionPlan
  created_at: string
  updated_at: string
}

export type CreateAvatarDto = Omit<Avatar, 'id' | 'created_at' | 'updated_at'>
export type UpdateAvatarDto = Partial<CreateAvatarDto>
