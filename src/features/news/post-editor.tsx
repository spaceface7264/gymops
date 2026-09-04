import type { JSONContent } from '@tiptap/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  emptyDoc,
  isEmptyDoc,
  MissingRequirements,
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
    return <LoadingState rows={5} />
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

  const missing = [
    title.trim() === '' && t('news.needsTitle'),
    isEmptyDoc(body) && t('news.needsBody'),
    !scope.canPublishIn(gymId) && t('news.needsPermission'),
  ].filter((reason): reason is string => Boolean(reason))
  const canSave = missing.length === 0

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
      <PageHeader title={post ? t('news.editTitle') : t('news.createTitle')} />

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-scope`}>{t('news.scope')}</Label>
        <Select
          value={gymId ?? 'company'}
          onValueChange={(value) => {
            // Radix keeps a hidden native select for form submission, and it
            // fires an empty value whenever the current one matches no option
            // — here, the render before the profile that decides the scope
            // arrives. Taking it would scope the post to nobody.
            if (value === '') return
            setChosenGymId(value === 'company' ? null : value)
          }}
        >
          <SelectTrigger id={`${fieldId}-scope`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {/* Only an admin may publish company-wide (spec §2.1). */}
              {scope.canPublishCompanyWide && (
                <SelectItem value="company">{t('news.companyWide')}</SelectItem>
              )}
              {scope.publishableGyms.map((gym) => (
                <SelectItem key={gym.id} value={gym.id}>
                  {gym.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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

      <div className="flex min-h-11 items-center gap-3">
        <Checkbox
          id={`${fieldId}-ack`}
          checked={requiresAck}
          onCheckedChange={(checked) => setRequiresAck(checked === true)}
        />
        <Label htmlFor={`${fieldId}-ack`}>{t('news.requireAcknowledgement')}</Label>
      </div>

      <MissingRequirements reasons={missing} />

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
