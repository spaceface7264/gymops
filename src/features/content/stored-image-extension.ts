import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { StoredImage } from './stored-image'

/**
 * The image node used by every document: `src` is an object path in the private
 * `content` bucket, and `StoredImage` signs it when the node is rendered.
 */
export const StoredImageExtension = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StoredImage)
  },
})
