import { Fragment, type ReactNode } from 'react'

/**
 * The "light markdown" of spec §2.2: `**bold**`, `*italic*`, `` `code` `` and
 * bare links, plus the line breaks somebody actually typed. Chat messages and
 * the assistant's answers (P8-04) are both rendered with it.
 *
 * Written out rather than pulled in, and it returns React nodes rather than
 * HTML: a chat message is the one thing in this app that arrives from another
 * user and is rendered verbatim, so there is nothing here that could ever put
 * their text through `dangerouslySetInnerHTML`. Anything it does not
 * understand stays as the characters they typed.
 */
const pattern =
  /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param mentions the names this text addresses, as `@Name` appears in it;
 *   each is set in the accent so the person named can find their line. Only
 *   names the caller resolved count: an @ typed at random stays plain text.
 */
export function Markdown({ body, mentions = [] }: { body: string; mentions?: string[] }) {
  const tokens =
    mentions.length === 0
      ? pattern
      : new RegExp(
          `${pattern.source}|(@(?:${mentions.map(escape).join('|')}))(?![\\p{L}\\p{N}])`,
          'gu',
        )

  return (
    <p className="break-words whitespace-pre-wrap">
      {body.split('\n').map((line, index) => (
        <Fragment key={index}>
          {index > 0 && '\n'}
          {renderLine(line, tokens)}
        </Fragment>
      ))}
    </p>
  )
}

function renderLine(line: string, tokens: RegExp): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0

  for (const match of line.matchAll(tokens)) {
    const [token] = match
    const at = match.index

    if (at > last) nodes.push(line.slice(last, at))
    nodes.push(<Token key={at} token={token} />)
    last = at + token.length
  }

  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}

function Token({ token }: { token: string }) {
  if (token.startsWith('@'))
    return <span className="text-accent-foreground font-medium">{token}</span>
  if (token.startsWith('**')) return <strong>{token.slice(2, -2)}</strong>
  if (token.startsWith('*')) return <em>{token.slice(1, -1)}</em>
  if (token.startsWith('`'))
    return (
      <code className="bg-muted rounded px-1 py-0.5 text-[0.875em]">
        {token.slice(1, -1)}
      </code>
    )

  // A link into this app stays in this app: a new tab would leave the PWA.
  const internal = token.startsWith(`${window.location.origin}/`)

  return (
    <a
      href={token}
      target={internal ? undefined : '_blank'}
      rel={internal ? undefined : 'noreferrer noopener'}
      className="underline underline-offset-2"
    >
      {token}
    </a>
  )
}
