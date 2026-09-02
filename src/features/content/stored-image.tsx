import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { useSignedContentUrl } from './queries'

/**
 * An image node whose `src` is an object path in the private `content` bucket,
 * resolved to a signed URL only while it is on screen.
 */
export function StoredImage({ node }: NodeViewProps) {
  const { t } = useTranslation()
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : null
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : ''
  const { data: url, isError } = useSignedContentUrl(src)

  return (
    <NodeViewWrapper className="my-4">
      {isError ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          {t('content.imageUnavailable')}
        </p>
      ) : (
        <img
          src={url ?? undefined}
          alt={alt}
          className="max-h-96 rounded-md border object-contain"
        />
      )}
    </NodeViewWrapper>
  )
}
