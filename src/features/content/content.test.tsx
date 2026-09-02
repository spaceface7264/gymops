import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contentImagePath,
  docText,
  emptyDoc,
  excerpt,
  isEmptyDoc,
  RichText,
  RichTextEditor,
  toDoc,
} from '@/features/content'
import { renderWithProviders } from '@/test/render'

const upload = vi.fn<(path: string, file: File) => Promise<{ error: null }>>()
const createSignedUrl =
  vi.fn<(path: string) => Promise<{ data: { signedUrl: string }; error: null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string, file: File) => upload(path, file),
        createSignedUrl: (path: string) => createSignedUrl(path),
      }),
    },
  },
}))

const paragraph = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

beforeEach(() => {
  vi.clearAllMocks()
  upload.mockResolvedValue({ error: null })
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.test/signed.png' },
    error: null,
  })
})

describe('document helpers', () => {
  it('reads the text out of a Tiptap document the way SQL tiptap_text() does', () => {
    expect(docText(paragraph('New chalk policy'))).toBe('New chalk policy')
    expect(docText(emptyDoc)).toBe('')
  })

  it('treats anything that is not a document as an empty one', () => {
    expect(toDoc(null)).toEqual(emptyDoc)
    expect(toDoc('not a document')).toEqual(emptyDoc)
    expect(toDoc(paragraph('kept'))).toEqual(paragraph('kept'))
  })

  it('counts a document holding only an image as not empty', () => {
    expect(isEmptyDoc(emptyDoc)).toBe(true)
    expect(isEmptyDoc(paragraph('   '))).toBe(true)
    expect(
      isEmptyDoc({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'a/b.png' } }],
      }),
    ).toBe(false)
  })

  it('truncates an excerpt on a whole word and marks it', () => {
    expect(excerpt(paragraph('short'))).toBe('short')
    expect(excerpt(paragraph('a'.repeat(200)))).toHaveLength(181)
    expect(excerpt(paragraph('a'.repeat(200)))).toMatch(/…$/)
  })

  it('scopes an upload path by gym, so storage RLS can read it back', () => {
    expect(contentImagePath('11111111-1111-1111-1111-111111111111', 'photo.PNG')).toMatch(
      /^11111111-1111-1111-1111-111111111111\/[0-9a-f-]{36}\.png$/,
    )
    expect(contentImagePath(null, 'photo.jpeg')).toMatch(/^company\/[0-9a-f-]{36}\.jpeg$/)
    expect(contentImagePath(null, 'no-extension')).toMatch(/\.png$/)
  })
})

describe('RichText', () => {
  it('renders a stored document', async () => {
    renderWithProviders(<RichText doc={paragraph('Unlock the front door')} />)

    expect(await screen.findByText('Unlock the front door')).toBeInTheDocument()
  })

  it('signs the object path of an image instead of showing it raw', async () => {
    renderWithProviders(
      <RichText
        doc={{
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: 'company/photo.png', alt: 'A wall' } },
          ],
        }}
      />,
    )

    const image = await screen.findByAltText('A wall')
    await waitFor(() =>
      expect(image).toHaveAttribute('src', 'https://storage.test/signed.png'),
    )
    expect(createSignedUrl).toHaveBeenCalledWith('company/photo.png')
  })
})

describe('RichTextEditor', () => {
  it('reports what the author types', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <RichTextEditor
        doc={emptyDoc}
        onChange={onChange}
        gymId={null}
        aria-label="Body"
      />,
    )

    await userEvent.type(screen.getByLabelText('Body'), 'Chalk')

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const last = onChange.mock.lastCall?.[0] as Parameters<typeof docText>[0]
    expect(docText(last)).toBe('Chalk')
  })

  it('uploads an image into the gym the content belongs to and keeps the path', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <RichTextEditor
        doc={emptyDoc}
        onChange={onChange}
        gymId="11111111-1111-1111-1111-111111111111"
        aria-label="Body"
      />,
    )

    await userEvent.upload(
      screen.getByLabelText('Image', { selector: 'input' }),
      new File(['x'], 'wall.png', { type: 'image/png' }),
    )

    await waitFor(() => expect(upload).toHaveBeenCalled())
    expect(upload.mock.lastCall?.[0]).toMatch(/^11111111-1111-1111-1111-111111111111\//)
    await waitFor(() => {
      const last = onChange.mock.lastCall?.[0] as
        { content?: { type?: string }[] } | undefined
      expect(last?.content?.some((node) => node.type === 'image')).toBe(true)
    })
  })

  it('says so when an upload fails rather than dropping the image silently', async () => {
    upload.mockRejectedValue(new Error('storage refused'))
    renderWithProviders(
      <RichTextEditor doc={emptyDoc} onChange={vi.fn()} gymId={null} aria-label="Body" />,
    )

    await userEvent.upload(
      screen.getByLabelText('Image', { selector: 'input' }),
      new File(['x'], 'wall.png', { type: 'image/png' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The image could not be uploaded',
    )
  })

  it('turns the selection into a link', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <RichTextEditor
        doc={paragraph('handbook')}
        onChange={onChange}
        gymId={null}
        aria-label="Body"
      />,
    )

    await userEvent.click(screen.getByLabelText('Body'))
    await userEvent.keyboard('{Control>}a{/Control}')
    await userEvent.click(screen.getByRole('button', { name: 'Link' }))
    await userEvent.type(screen.getByLabelText('Link address'), 'https://example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const last = JSON.stringify(onChange.mock.lastCall?.[0])
      expect(last).toContain('https://example.test')
    })
  })
})
