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

export function Markdown({ body }: { body: string }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {body.split('\n').map((line, index) => (
        <Fragment key={index}>
          {index > 0 && '\n'}
          {renderLine(line)}
        </Fragment>
      ))}
    </p>
  )
}

function renderLine(line: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0

  for (const match of line.matchAll(pattern)) {
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
  if (token.startsWith('**')) return <strong>{token.slice(2, -2)}</strong>
  if (token.startsWith('*')) return <em>{token.slice(1, -1)}</em>
  if (token.startsWith('`'))
    return (
      <code className="bg-muted rounded px-1 py-0.5 text-xs">{token.slice(1, -1)}</code>
    )

  return (
    <a
      href={token}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2"
    >
      {token}
    </a>
  )
}
