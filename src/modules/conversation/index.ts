export {
  CONVERSATION_CHANNELS,
  channelLabels,
  ConversationNotFoundError,
  formatRelativeTime,
  isConversationUnread,
  sendMessageInputSchema,
} from "./domain";
export type { ConversationChannelValue, MessageSenderValue, SendMessageInput } from "./domain";
export {
  findOrCreateConversation,
  getConversation,
  listConversations,
  listConversationsForClient,
  listMessages,
  markAsRead,
  messageExistsForExternalId,
  sendMessage,
} from "./service";
export type { ConversationDetail, ConversationListItem, MessageItem } from "./service";
