import StarterKit from '@tiptap/starter-kit'
import { StoredImageExtension } from './stored-image-extension'

/** The one Tiptap schema: what the editor writes is exactly what the viewer reads. */
export const contentExtensions = [
  StarterKit.configure({
    link: { openOnClick: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
  }),
  StoredImageExtension,
]

/** Shared prose styling, so a guide reads the same in the editor and the viewer. */
export const proseClassName =
  'prose prose-sm max-w-none focus:outline-none [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-6 [&_a]:underline'
