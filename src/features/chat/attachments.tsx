import { Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSignedAttachmentUrl, type ChatAttachment } from './queries'

/**
 * What came with a message. The `chat` bucket is private, so every file is
 * signed to be shown; images are shown, anything else is a link with its name.
 */
export function Attachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (attachments.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2 pt-1">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <Attachment attachment={attachment} />
        </li>
      ))}
    </ul>
  )
}

function Attachment({ attachment }: { attachment: ChatAttachment }) {
  const { t } = useTranslation()
  const url = useSignedAttachmentUrl(attachment.path)
  const name = attachment.path.split('/').pop() ?? attachment.path
  const isImage = attachment.mime_type?.startsWith('image/') ?? false

  if (!url.data) {
    return (
      <span className="text-muted-foreground text-xs">
        {url.isError ? t('chat.attachmentFailed') : t('chat.attachmentLoading')}
      </span>
    )
  }

  if (isImage) {
    return (
      <a href={url.data} target="_blank" rel="noreferrer noopener">
        <img
          src={url.data}
          alt={t('chat.attachmentAlt')}
          className="max-h-40 rounded-md object-cover"
        />
      </a>
    )
  }

  return (
    <a
      href={url.data}
      target="_blank"
      rel="noreferrer noopener"
      className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs underline-offset-2 hover:underline"
    >
      <Paperclip className="size-3" aria-hidden="true" />
      {name}
    </a>
  )
}
