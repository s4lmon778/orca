/** A closed chat the sidebar keeps showing where it was, so it can be reopened in one click. */
export type SidebarClosedChat = {
  sessionId: string
  /** The id its sidebar row had, which its task group membership names. */
  rowTabId: string
  title: string
  agent?: string
  /** Orders it among the workspace's other conversations, as its live row was. */
  startedAt: number
  closedAt: number
}

export const MAX_SIDEBAR_CLOSED_CHATS_PER_WORKSPACE = 50
const MAX_CLOSED_CHAT_TITLE_LENGTH = 200
const MAX_ID_LENGTH = 512

export function isAgentTaskGroupRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Ids and keys stored with task groups: non-empty and bounded. */
export function isAgentTaskGroupId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

const isRecord = isAgentTaskGroupRecord
const isId = isAgentTaskGroupId

function finiteTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/** Newest-closed last; one entry per conversation, the most recent ones kept. */
export function normalizeSidebarClosedChats(value: unknown): SidebarClosedChat[] {
  if (!Array.isArray(value)) {
    return []
  }
  const bySession = new Map<string, SidebarClosedChat>()
  for (const raw of value) {
    if (!isRecord(raw) || !isId(raw.sessionId) || !isId(raw.rowTabId)) {
      continue
    }
    const title =
      typeof raw.title === 'string'
        ? raw.title.replace(/\s+/g, ' ').trim().slice(0, MAX_CLOSED_CHAT_TITLE_LENGTH)
        : ''
    bySession.delete(raw.sessionId)
    bySession.set(raw.sessionId, {
      sessionId: raw.sessionId,
      rowTabId: raw.rowTabId,
      title,
      ...(isId(raw.agent) ? { agent: raw.agent } : {}),
      startedAt: finiteTime(raw.startedAt),
      closedAt: finiteTime(raw.closedAt)
    })
  }
  return [...bySession.values()].slice(-MAX_SIDEBAR_CLOSED_CHATS_PER_WORKSPACE)
}
