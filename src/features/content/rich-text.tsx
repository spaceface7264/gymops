import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { contentExtensions, proseClassName } from './schema'

/**
 * Read-only rendering of a stored document. It is the same Tiptap schema the
 * editor uses, so anything unknown in the JSON is dropped rather than injected
 * into the page.
 */
export function RichText({ doc }: { doc: JSONContent }) {
  const editor = useEditor(
    {
      extensions: contentExtensions,
      content: doc,
      editable: false,
      editorProps: { attributes: { class: proseClassName } },
    },
    [doc],
  )

  return <EditorContent editor={editor} />
}
