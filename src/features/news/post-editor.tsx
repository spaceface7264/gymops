import type { JSONContent } from '@tiptap/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  emptyDoc,
  isEmptyDoc,
  RichTextEditor,
  toDoc,
  usePublishScope,
} from '@/features/content'
import { useGymScope } from '@/features/gyms'
import {
  useCreatePost,
  useNewsPost,
  useUpdatePost,
  type PostInput,
  type NewsPost,
} from './queries'

/** Route component for `/news/new` and `/news/:postId/edit`. */
export function PostEditorPage() {
  const { postId } = useParams<{ postId: string }>()
  const { t } = useTranslation()
  const existing = useNewsPost(postId)

  if (postId && existing.isPending) {
    return <p className="text-muted-foreground text-sm">{t('news.loading')}</p>
  }
  if (postId && !existing.data) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('news.loadFailed')}
      </p>
    )
  }

  // Remounted per post id, so the form state starts from the loaded post.
  return <PostEditor key={postId ?? 'new'} post={existing.data} />
}

function PostEditor({ post }: { post?: NewsPost }) {
  const { t } = useTranslation()
  const fieldId = useId()
  const navigate = useNavigate()
  const scope = usePublishScope()
  const { gymId: currentGym } = useGymScope()
  const create = useCreatePost()
  const update = useUpdatePost()
  const save = post ? update : create

  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState<JSONContent>(() =>
    post ? toDoc(post.body) : emptyDoc,
  )
  const [requiresAck, setRequiresAck] = useState(post?.requires_ack ?? false)
  // `undefined` means the author has not picked a scope yet, so the default
  // below still applies. It cannot be the initial state of `gymId` itself: the
  // profile that decides where they may publish arrives a render later, and a
  // default captured before it lands leaves the form posting company-wide
  // while the select shows a gym.
  const [chosenGymId, setChosenGymId] = useState<string | null | undefined>(
    post ? post.gym_id : undefined,
  )
  // A new post defaults to the gym in the switcher, which is where the author
  // is standing; "all gyms" means they were looking company-wide.
  const defaultGymId = scope.canPublishIn(currentGym)
    ? currentGym
    : scope.canPublishCompanyWide
      ? null
      : (scope.publishableGyms[0]?.id ?? null)
  const gymId = chosenGymId === undefined ? defaultGymId : chosenGymId

  const canSave = title.trim() !== '' && !isEmptyDoc(body) && scope.canPublishIn(gymId)

  const submit = (status: PostInput['status']) => {
    const input: PostInput = { gymId, title, body, requiresAck, status }

    if (post) {
      update.mutate(
        { id: post.id, ...input },
        { onSuccess: () => void navigate(`/news/${post.id}`) },
      )
    } else {
      create.mutate(input, { onSuccess: (id) => void navigate(`/news/${id}`) })
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit(post?.status ?? 'draft')
      }}
    >
      <h1 className="text-2xl font-semibold">
        {post ? t('news.editTitle') : t('news.createTitle')}
      </h1>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-scope`}>{t('news.scope')}</Label>
        <select
          id={`${fieldId}-scope`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={gymId ?? 'company'}
          onChange={(event) =>
            setChosenGymId(event.target.value === 'company' ? null : event.target.value)
          }
        >
          {/* Only an admin may publish company-wide (spec §2.1). */}
          {scope.canPublishCompanyWide && (
            <option value="company">{t('news.companyWide')}</option>
          )}
          {scope.publishableGyms.map((gym) => (
            <option key={gym.id} value={gym.id}>
              {gym.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-title`}>{t('news.postTitle')}</Label>
        <Input
          id={`${fieldId}-title`}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-body`}>{t('news.body')}</Label>
        <RichTextEditor
          doc={body}
          onChange={setBody}
          gymId={gymId}
          aria-label={t('news.body')}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${fieldId}-ack`}
          type="checkbox"
          className="size-4"
          checked={requiresAck}
          onChange={(event) => setRequiresAck(event.target.checked)}
        />
        <Label htmlFor={`${fieldId}-ack`}>{t('news.requireAcknowledgement')}</Label>
      </div>

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('news.saveFailed')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={!canSave || save.isPending}>
          {post?.status === 'published' ? t('news.save') : t('news.saveDraft')}
        </Button>
        {post?.status !== 'published' && (
          <Button
            type="button"
            disabled={!canSave || save.isPending}
            onClick={() => submit('published')}
          >
            {t('news.publish')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => void navigate(post ? `/news/${post.id}` : '/news')}
        >
          {t('news.cancel')}
        </Button>
      </div>
    </form>
  )
}
