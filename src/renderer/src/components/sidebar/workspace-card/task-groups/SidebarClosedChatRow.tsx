import React, { useCallback, useState } from 'react'
import { Moon, X } from 'lucide-react'
import { toast } from 'sonner'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
import { formatAgentTypeLabel } from '../../../../../../shared/agent-status/presentation/agent-type-label'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { useNow } from '@/lib/window-activity/use-now'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import type { SidebarClosedChat } from '../../../../../../shared/agent-task-groups/sidebar-closed-chat-record'
import { useWorktreeAgentDisplay } from '../activity/use-worktree-agent-display'
import { AGENT_ROW_TAB_ID_ATTR, CLOSED_CHAT_SESSION_ATTR } from './agent-task-group-workspace-key'
import { reopenSidebarClosedChat } from './sidebar-closed-chats'

const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation()

/** A closed chat in its old place, dimmed like a sleeping workspace; a click reopens it. */
export const SidebarClosedChatRow = React.memo(function SidebarClosedChatRow({
  chat,
  worktreeId,
  workspaceKey,
  groupId
}: {
  chat: SidebarClosedChat
  worktreeId: string
  workspaceKey: string
  groupId: string | null
}): React.JSX.Element {
  const t = useTranslate()
  const now = useNow(30_000)
  const compact = useWorktreeAgentDisplay().agentActivityDisplayMode === 'compact'
  const forget = useAppStore((s) => s.forgetSidebarClosedChat)
  const [pending, setPending] = useState(false)
  const title = chat.title || formatAgentTypeLabel(chat.agent)
  const reopenLabel = t('auto.components.sidebar.SidebarClosedChatRow.reopen', 'Reopen {{title}}', {
    title
  })
  const removeLabel = t(
    'auto.components.sidebar.SidebarClosedChatRow.remove',
    'Remove from Sidebar'
  )

  const reopen = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent) => {
      event.stopPropagation()
      setPending(true)
      reopenSidebarClosedChat({ chat, worktreeId, workspaceKey, groupId })
        .catch(() => {
          toast.error(
            t(
              'auto.components.sidebar.SidebarClosedChatRow.reopenFailed',
              'Could not reopen this chat.'
            )
          )
        })
        .finally(() => setPending(false))
    },
    [chat, groupId, t, workspaceKey, worktreeId]
  )

  return (
    <div
      {...{ [AGENT_ROW_TAB_ID_ATTR]: chat.rowTabId, [CLOSED_CHAT_SESSION_ATTR]: chat.sessionId }}
      data-worktree-sleeping-dim=""
      className={cn('min-w-0', compact && 'ms-2')}
    >
      <div
        role="treeitem"
        tabIndex={0}
        aria-label={reopenLabel}
        title={reopenLabel}
        draggable={false}
        data-workspace-agent-row=""
        className={cn(
          'group/closed-chat worktree-agent-row-hover flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-sm px-1 text-[11px] leading-none text-muted-foreground',
          !compact && 'text-xs',
          pending && 'cursor-progress opacity-75'
        )}
        onClick={reopen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            reopen(event)
          }
        }}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
        onDoubleClick={stopPropagation}
        onDragStart={stopPropagation}
      >
        <Moon className="size-[11px] shrink-0" aria-hidden="true" />
        {chat.agent ? (
          <span className="inline-flex shrink-0" title={formatAgentTypeLabel(chat.agent)}>
            <AgentTypeIcon agentType={chat.agent} size={13} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {chat.closedAt > 0 ? (
          <span className="shrink-0 text-[10px] tabular-nums group-hover/closed-chat:hidden group-focus-within/closed-chat:hidden">
            {formatShortTimeAgo(chat.closedAt, now)}
          </span>
        ) : null}
        <button
          type="button"
          className="hidden size-4 shrink-0 items-center justify-center rounded-sm hover:text-foreground focus-visible:flex focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring group-hover/closed-chat:flex group-focus-within/closed-chat:flex"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={(event) => {
            event.stopPropagation()
            forget(workspaceKey, chat.sessionId)
          }}
          onMouseDown={stopPropagation}
          onPointerDown={stopPropagation}
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
})
