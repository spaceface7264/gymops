import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading2,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useUploadContentImage } from './queries'
import { contentExtensions, proseClassName } from './schema'

type RichTextEditorProps = {
  doc: JSONContent
  onChange: (doc: JSONContent) => void
  /** Scope uploaded images belong to; null is company-wide. */
  gymId: string | null
  disabled?: boolean
  'aria-label'?: string
}

/**
 * The one rich-text editor (P3-01), used by both the news and the guide forms.
 * Images go straight into the `content` bucket and the document keeps their
 * object path, never a signed URL.
 */
export function RichTextEditor({
  doc,
  onChange,
  gymId,
  disabled = false,
  'aria-label': ariaLabel,
}: RichTextEditorProps) {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const upload = useUploadContentImage()

  const editor = useEditor({
    extensions: contentExtensions,
    content: doc,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(proseClassName, 'min-h-48 px-3 py-2'),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    // `doc` is the initial value; the form owns it from here, so the editor is
    // not re-created on every keystroke.
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  })

  if (!editor) return null

  // `mutate`, not `mutateAsync`: a refused upload belongs in the mutation's
  // error state, which renders the message below, not in an unhandled rejection.
  const onPickImage = (file: File | undefined) => {
    if (!file) return
    upload.mutate(
      { file, gymId },
      {
        onSuccess: (path) =>
          editor.chain().focus().setImage({ src: path, alt: file.name }).run(),
      },
    )
  }

  const applyLink = () => {
    const url = linkUrl?.trim()
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkUrl(null)
  }

  return (
    <div className="border-input bg-card rounded-xl border">
      <div className="flex flex-wrap items-center gap-1 border-b p-1">
        <ToolbarButton
          editor={editor}
          label={t('content.bold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('content.italic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('content.heading')}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('content.bulletList')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('content.orderedList')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('content.link')}
          active={editor.isActive('link')}
          onClick={() =>
            setLinkUrl((current) =>
              current === null
                ? ((editor.getAttributes('link').href as string) ?? '')
                : null,
            )
          }
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('content.image')}
          onClick={() => fileInput.current?.click()}
          busy={upload.isPending}
        >
          <ImageIcon className="size-4" />
        </ToolbarButton>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t('content.image')}
          onChange={(event) => {
            void onPickImage(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      {linkUrl !== null && (
        <div className="flex items-center gap-2 border-b p-2">
          <Input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://"
            aria-label={t('content.linkUrl')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
            }}
          />
          <Button type="button" size="sm" onClick={applyLink}>
            {t('content.linkApply')}
          </Button>
        </div>
      )}

      {upload.isError && (
        <p role="alert" className="text-destructive border-b px-3 py-2 text-sm">
          {t('content.uploadFailed')}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  editor,
  label,
  active = false,
  busy = false,
  onClick,
  children,
}: {
  editor: Editor
  label: string
  active?: boolean
  busy?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      aria-label={label}
      aria-pressed={active}
      disabled={!editor.isEditable || busy}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
