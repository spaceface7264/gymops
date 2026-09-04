/**
 * The handle that summons the assistant in a channel (P8-05). There is no bot
 * user behind it: the composer offers it beside the colleagues, the function
 * looks for it in the message, and neither ever puts it in `mentions`.
 */
export const assistantHandle = 'assistant'

export const mentionsAssistant = (body: string) => /@assistant\b/i.test(body)
