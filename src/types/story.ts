export type StoryAuthor = {
  id: string
  username: string | null
  display_name: string | null
  profile_img_url: string | null
  is_verified?: boolean | null
}

export type Story = {
  id: string
  author_id: string
  image_url: string
  caption: string | null
  created_at: string
  expires_at: string
  author?: StoryAuthor | StoryAuthor[] | null
}
