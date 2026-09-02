import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { contentImagePath } from './doc'

export const contentKeys = {
  signedUrl: (path: string) => ['content', 'signed-url', path] as const,
}

/** Signed URLs last an hour; the query is refetched a few minutes before that. */
const signedUrlSeconds = 3600

/**
 * The `content` bucket is private (spec §3), so an image node stores the object
 * path and the URL is signed when it is displayed. Storing the signed URL in
 * the document instead would put an expiry inside saved content.
 */
export function useSignedContentUrl(path: string | null) {
  return useQuery({
    queryKey: contentKeys.signedUrl(path ?? ''),
    enabled: path !== null,
    staleTime: (signedUrlSeconds - 300) * 1000,
    gcTime: signedUrlSeconds * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('content')
        .createSignedUrl(path ?? '', signedUrlSeconds)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export type ContentUpload = { file: File; gymId: string | null }

/** Returns the object path to put in the image node, not a URL. */
export function useUploadContentImage() {
  return useMutation({
    mutationFn: async ({ file, gymId }: ContentUpload) => {
      const path = contentImagePath(gymId, file.name)
      const { error } = await supabase.storage
        .from('content')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      return path
    },
  })
}
